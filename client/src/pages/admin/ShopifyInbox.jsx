import React, { useEffect, useState } from "react";
import { Check, X as XIcon, RotateCcw } from "lucide-react";
import { getShopifyOrders, getShopifyLeads, assignLead, getTeamMembers, updateOrderStatus } from "../../lib/api.js";
import Modal from "../../components/Modal.jsx";
import LeadDetails from "../../components/LeadDetails.jsx";

// Small inline "Assign to X? Confirm / Cancel" row — used for leads only.
// Orders don't get this control at all (see OrderStatusToggle below).
function AssignControl({ currentAssigneeId, staff, onConfirm }) {
  const [pending, setPending] = useState(null);

  if (pending) {
    return (
      <div className="flex flex-1 items-center gap-1.5">
        <span className="flex-1 truncate text-[11.5px] text-slate-600">
          Assign to <span className="font-semibold">{pending.name}</span>?
        </span>
        <button
          onClick={() => { onConfirm(pending.id); setPending(null); }}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
          aria-label="Confirm assign"
        >
          <Check size={13} />
        </button>
        <button
          onClick={() => setPending(null)}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
          aria-label="Cancel"
        >
          <XIcon size={13} />
        </button>
      </div>
    );
  }

  return (
    <select
      value={currentAssigneeId || ""}
      onChange={(e) => {
        const id = e.target.value;
        if (!id) {
          onConfirm(null);
          return;
        }
        const member = staff.find((s) => s.id === id);
        setPending(member);
      }}
      className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] text-slate-700"
    >
      <option value="">Assign</option>
      {staff.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  );
}

// Reversible "Mark as Assigned" / "Unassign" toggle for real paid orders —
// this just marks that admin has claimed/handled the order in the feed;
// it does NOT assign it to a staff member or create a task (see the
// "orders are view-only" note in the Orders tab below).
function OrderStatusToggle({ status, onToggle }) {
  const isAssigned = status === "assigned";
  return (
    <button
      onClick={() => onToggle(isAssigned ? "unassigned" : "assigned")}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium ${
        isAssigned ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-accent text-white hover:opacity-90"
      }`}
    >
      {isAssigned ? <RotateCcw size={12} /> : <Check size={12} />}
      {isAssigned ? "Unassign" : "Mark as Assigned"}
    </button>
  );
}

export default function ShopifyInbox() {
  const [tab, setTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [leads, setLeads] = useState([]);
  const [staff, setStaff] = useState([]);
  const [viewingRef, setViewingRef] = useState(null); // { type: "order" | "lead", id }

  useEffect(() => {
    getShopifyOrders().then(setOrders);
    getShopifyLeads().then(setLeads);
    getTeamMembers().then((all) => setStaff(all.filter((m) => m.role === "staff")));
  }, []);

  async function handleToggleOrderStatus(orderId, status) {
    await updateOrderStatus(orderId, status);
    setOrders((os) => os.map((o) => (o.id === orderId ? { ...o, status } : o)));
  }
  async function handleAssignLead(leadId, assigneeId) {
    await assignLead(leadId, assigneeId || null);
    setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, assignee_id: assigneeId, status: assigneeId ? "assigned" : "unassigned" } : l)));
  }

  const viewing = !viewingRef
    ? null
    : viewingRef.type === "order"
    ? orders.find((o) => o.id === viewingRef.id)
    : leads.find((l) => l.id === viewingRef.id);

  return (
    <div className="px-4 py-4 md:px-6 md:py-6">
      <p className="mb-3 text-[12.5px] text-slate-400">New orders and leads arrive automatically from Shopify.</p>

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
                <span className="text-[11px] font-semibold text-emerald-600">{o.order_number || "#"}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${o.status === "assigned" ? "bg-accent-soft text-accent-text" : "bg-slate-100 text-slate-500"}`}>
                  {o.status}
                </span>
              </div>
              <p className="truncate text-[13.5px] font-semibold text-slate-800">{o.customer_name}</p>
              <p className="mb-2.5 truncate text-[12px] text-slate-400">{o.items} · {o.price}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setViewingRef({ type: "order", id: o.id })} className="flex-1 rounded-lg border border-slate-200 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
                  View Details
                </button>
                <OrderStatusToggle status={o.status} onToggle={(status) => handleToggleOrderStatus(o.id, status)} />
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
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${l.status === "unassigned" ? "bg-slate-100 text-slate-500" : "bg-accent-soft text-accent-text"}`}>
                  {l.status}
                </span>
              </div>
              <p className="truncate text-[13.5px] font-semibold text-slate-800">{l.name}</p>
              <p className="mb-2.5 truncate text-[12px] text-slate-400">{l.outfit_type} · {l.price_estimate}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setViewingRef({ type: "lead", id: l.id })} className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
                  Details
                </button>
                <AssignControl currentAssigneeId={l.assignee_id} staff={staff} onConfirm={(id) => handleAssignLead(l.id, id)} />
              </div>
            </div>
          ))}
          {leads.length === 0 && <p className="text-[13px] text-slate-400">No leads yet.</p>}
        </div>
      )}

      <Modal open={!!viewing} onClose={() => setViewingRef(null)}>
        {viewing && (
          <div className="p-5">
            <h3 className="mb-4 text-[15px] font-bold text-slate-900">
              {viewingRef.type === "lead" ? "Lead Details" : "Order Details"}
            </h3>
            {viewingRef.type === "lead" ? (
              <LeadDetails lead={viewing} />
            ) : (
              <dl className="space-y-2 text-[13px]">
                {Object.entries(viewing)
                  .filter(([k]) => !["id"].includes(k))
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 border-b border-slate-50 py-1.5">
                      <dt className="capitalize text-slate-400">{k.replaceAll("_", " ")}</dt>
                      <dd className="text-right text-slate-700">{String(v ?? "—")}</dd>
                    </div>
                  ))}
              </dl>
            )}
            <p className="mt-4 text-[11.5px] text-slate-400">Read-only — data is fetched automatically from Shopify.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}