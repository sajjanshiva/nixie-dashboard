// Central data layer. Most reads/writes go straight to Supabase (secured by
// the RLS policies in supabase/schema.sql). Anything that needs a secret key
// — sending a WhatsApp message, validating a GPS check-in against the office
// geofence — is routed through the Express backend (stage 2) instead, so
// those secrets never sit in the browser.

import { supabase } from "./supabaseClient.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

async function apiPost(path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function authToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

// ---------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------

export async function getTasks({ assigneeId } = {}) {
  let q = supabase.from("tasks").select("*, assignee:profiles(id, name)").order("created_at", { ascending: false });
  if (assigneeId) q = q.eq("assignee_id", assigneeId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function getTask(taskId) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, assignee:profiles(id, name)")
    .eq("id", taskId)
    .single();
  if (error) throw error;
  return data;
}

export async function createTask(task) {
  const { data, error } = await supabase.from("tasks").insert(task).select().single();
  if (error) throw error;
  return data;
}

export async function assignTask(taskId, assigneeId) {
  const { error } = await supabase.from("tasks").update({ assignee_id: assigneeId }).eq("id", taskId);
  if (error) throw error;
}

export async function updateTaskProgress(taskId, progress) {
  // Routed through the backend so the "client gets a WhatsApp update
  // automatically" step can fire from one place.
  const token = await authToken();
  return apiPost("/api/tasks/progress", { taskId, progress }, token);
}

export async function markTaskComplete(taskId) {
  const { error } = await supabase.from("tasks").update({ status: "Complete", progress: 100 }).eq("id", taskId);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Shopify inbox (orders + leads) — populated by the backend webhooks
// ---------------------------------------------------------------------

// Joins the linked task (if this order has already been assigned/converted)
// so the Orders tab can show who it's assigned to without a second query.
export async function getShopifyOrders() {
  const { data, error } = await supabase
    .from("shopify_orders")
    .select("*, task:tasks(id, assignee:profiles(id, name))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateOrderStatus(orderId, status) {
  const { error } = await supabase.from("shopify_orders").update({ status }).eq("id", orderId);
  if (error) throw error;
}

// Converts a Shopify order into a real task (same shape as manually created
// tasks / lead follow-ups), assigns it to a staff member, and links the
// order row to the new task so the Orders tab knows not to show the assign
// form again. Phone is entered manually by admin since the webhook doesn't
// always carry a reliable customer phone number.
export async function assignOrder(order, { phone, assigneeId }) {
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      title: order.order_number ? `Order ${order.order_number}` : "Shopify Order",
      client_name: order.customer_name,
      client_phone: phone,
      assignee_id: assigneeId,
      source: "shopify_order",
      shopify_order_id: order.shopify_order_id,
      shopify_order_number: order.order_number,
      shopify_items: order.items,
      shopify_price: order.price,
    })
    .select("*, assignee:profiles(id, name)")
    .single();
  if (taskError) throw taskError;

  const { error: orderError } = await supabase
    .from("shopify_orders")
    .update({ task_id: task.id, status: "assigned" })
    .eq("id", order.id);
  if (orderError) throw orderError;

  return task;
}

export async function getShopifyLeads({ assigneeId } = {}) {
  let q = supabase
    .from("shopify_leads")
    .select("*, assignee:profiles(id, name)")
    .order("created_at", { ascending: false });
  if (assigneeId) q = q.eq("assignee_id", assigneeId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function markLeadContacted(leadId) {
  const { error } = await supabase
    .from("shopify_leads")
    .update({ status: "contacted", contacted_at: new Date().toISOString() })
    .eq("id", leadId);
  if (error) throw error;
}

export async function assignLead(leadId, assigneeId) {
  const { error } = await supabase
    .from("shopify_leads")
    .update({ assignee_id: assigneeId, status: assigneeId ? "assigned" : "unassigned" })
    .eq("id", leadId);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Messages (task conversation)
// ---------------------------------------------------------------------

export async function getMessages(taskId) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export function subscribeToMessages(taskId, onInsert) {
  const channelName = `messages-task-${taskId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `task_id=eq.${taskId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// toStaff / toClient are the two composer toggles. Routed through the
// backend because toClient triggers a real WhatsApp API call.
export async function sendMessage({ taskId, text, toStaff, toClient }) {
  const token = await authToken();
  return apiPost("/api/messages/send", { taskId, text, toStaff, toClient }, token);
}

// ---------------------------------------------------------------------
// Leaves
// ---------------------------------------------------------------------

export async function getLeaves({ staffId } = {}) {
  let q = supabase.from("leaves").select("*, staff:profiles(id, name)").order("created_at", { ascending: false });
  if (staffId) q = q.eq("staff_id", staffId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function submitLeave(leave) {
  const { error } = await supabase.from("leaves").insert(leave);
  if (error) throw error;
}

export async function decideLeave(leaveId, status, rejectReason = null) {
  const { error } = await supabase.from("leaves").update({ status, reject_reason: rejectReason }).eq("id", leaveId);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Reimbursements
// ---------------------------------------------------------------------

export async function getReimbursements({ staffId } = {}) {
  let q = supabase.from("reimbursements").select("*, staff:profiles(id, name)").order("created_at", { ascending: false });
  if (staffId) q = q.eq("staff_id", staffId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function submitReimbursement(reimbursement) {
  const { error } = await supabase.from("reimbursements").insert(reimbursement);
  if (error) throw error;
}

export async function decideReimbursement(id, status, rejectReason = null) {
  const { error } = await supabase.from("reimbursements").update({ status, reject_reason: rejectReason }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// ImageKit (receipt uploads) — client asks the backend for a signature,
// then uploads directly to ImageKit so the private key never touches
// the browser.
// ---------------------------------------------------------------------

export async function getImageKitAuthParams() {
  const token = await authToken();
  const res = await fetch(`${API_BASE}/api/imagekit-auth`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Could not get ImageKit upload signature");
  return res.json(); // { signature, token, expire }
}

// ---------------------------------------------------------------------
// Attendance — check-in/out validated server-side (GPS + office geofence)
// ---------------------------------------------------------------------

export async function checkIn({ lat, lng }) {
  const token = await authToken();
  return apiPost("/api/attendance/check-in", { lat, lng }, token);
}

export async function checkOut() {
  const token = await authToken();
  return apiPost("/api/attendance/check-out", {}, token);
}

export async function getAttendanceSummary({ staffId } = {}) {
  let q = supabase.from("attendance").select("*");
  if (staffId) q = q.eq("staff_id", staffId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// Fetch the single attendance row for the current staff member for today.
// Returns null if no record exists yet (not yet checked in today).
export async function getTodayAttendance(staffId) {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("staff_id", staffId)
    .eq("date", today)
    .maybeSingle();
  if (error) throw error;
  return data; // { check_in, check_out, status, ... } or null
}

// Fetch attendance rows for a specific week — used by Home page week strip.
export async function getWeekAttendance(staffId) {
  const now = new Date();
  // Monday of current week
  const day = now.getDay(); // 0=Sun
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const from = monday.toISOString().slice(0, 10);
  const to   = sunday.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("attendance")
    .select("date, status, check_in, check_out")
    .eq("staff_id", staffId)
    .gte("date", from)
    .lte("date", to);
  if (error) throw error;
  // Return map: { "YYYY-MM-DD": { status, check_in, check_out } }
  const map = {};
  (data || []).forEach((r) => { map[r.date] = r; });
  return { map, from, to, monday };
}

// ---------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------

export async function getTeamMembers() {
  const { data, error } = await supabase.from("profiles").select("*").order("name");
  if (error) throw error;
  return data;
}

// Creating a member with a password requires the Supabase service-role
// key, which must never be in the browser — so this goes through the
// backend, which uses the Supabase Admin API server-side.
export async function addTeamMember({ name, email, password, role }) {
  const token = await authToken();
  return apiPost("/api/team/add-member", { name, email, password, role }, token);
}

// ---------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------

export async function getNotifications(userId) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data;
}

export async function markAllNotificationsRead(userId) {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
  if (error) throw error;
}