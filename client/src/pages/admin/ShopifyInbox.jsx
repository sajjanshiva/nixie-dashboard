import React, { useEffect, useState } from "react";
import { getShopifyOrders, getShopifyLeads, assignTask, assignLead, getTeamMembers } from "../../lib/api.js";
import Modal from "../../components/Modal.jsx";

export default function ShopifyInbox() {
  const [tab, setTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [leads, setLeads] = useState([]);
  const [staff, setStaff] = useState([]);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    getShopifyOrders().then(setOrders);
    getShopifyLeads().then(setLeads);
    getTeamMembers().then((all) => setStaff(all.filter((m) => m.role === "staff")));
  }, []);

  async function handleAssignOrder(taskId, assigneeId) {
    await assignTask(taskId, assigneeId || null);
    setOrders((os) => os.map((o) => (o.id === taskId ? { ...o, assignee_id: assigneeId } : o)));
  }
  async function handleAssignLead(leadId, assigneeId) {
    await assignLead(leadId, assigneeId || null);
    setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, assignee_id: assigneeId, status: assigneeId ? "assigned" : "unassigned" } : l)));
  }

  return (
    <div className="px-4 py-4 md:px-6 md:py-6">
      <p className="mb-3 text-[12.5px] text-slate-400">New orders and leads arrive automatically — view details and assign to your team.</p>

      <div className="mb-4 flex gap-1.5">
        {[
          { id: "orders", label: "Orders" },
          { id: "leads", label: "Leads" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
              tab === t.id ? "bg-accent text-white" : "border border-slate-200 bg-white text-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "orders" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl border border-slate-100 bg-white p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-600">{o.shopify_order_number || "#"}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${o.assignee_id ? "bg-accent-soft text-accent-text" : "bg-slate-100 text-slate-500"}`}>
                  {o.assignee_id ? "assigned" : "unassigned"}
                </span>
              </div>
              <p className="truncate text-[13.5px] font-semibold text-slate-800">{o.client_name}</p>
              <p className="mb-2.5 truncate text-[12px] text-slate-400">{o.shopify_items} · {o.shopify_price}</p>
              <div className="flex gap-2">
                <button onClick={() => setViewing(o)} className="flex-1 rounded-lg border border-slate-200 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
                  View Details
                </button>
                <select
                  value={o.assignee_id || ""}
                  onChange={(e) => handleAssignOrder(o.id, e.target.value || null)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] text-slate-700"
                >
                  <option value="">Assign</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          {orders.length === 0 && <p className="text-[13px] text-slate-400">No orders yet.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((l) => (
            <div key={l.id} className="rounded-xl border border-slate-100 bg-white p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-amber-600">{l.lead_number || "Lead"}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${l.status === "assigned" ? "bg-accent-soft text-accent-text" : "bg-slate-100 text-slate-500"}`}>
                  {l.status}
                </span>
              </div>
              <p className="truncate text-[13.5px] font-semibold text-slate-800">{l.name}</p>
              <p className="mb-2.5 truncate text-[12px] text-slate-400">{l.outfit_type} · {l.price_estimate}</p>
              <div className="flex gap-2">
                <button onClick={() => setViewing(l)} className="flex-1 rounded-lg border border-slate-200 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
                  View Details
                </button>
                <select
                  value={l.assignee_id || ""}
                  onChange={(e) => handleAssignLead(l.id, e.target.value || null)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] text-slate-700"
                >
                  <option value="">Assign</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          {leads.length === 0 && <p className="text-[13px] text-slate-400">No leads yet.</p>}
        </div>
      )}

      <Modal open={!!viewing} onClose={() => setViewing(null)}>
        {viewing && (
          <div className="p-5">
            <h3 className="mb-4 text-[15px] font-bold text-slate-900">Order / Lead Details</h3>
            <dl className="space-y-2 text-[13px]">
              {Object.entries(viewing)
                .filter(([k]) => !["id", "assignee", "assignee_id"].includes(k))
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-slate-50 py-1.5">
                    <dt className="capitalize text-slate-400">{k.replaceAll("_", " ")}</dt>
                    <dd className="text-right text-slate-700">{String(v ?? "—")}</dd>
                  </div>
                ))}
            </dl>
            <p className="mt-4 text-[11.5px] text-slate-400">Read-only — data is fetched automatically from Shopify.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
