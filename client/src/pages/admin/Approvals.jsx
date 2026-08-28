import React, { useEffect, useState } from "react";
import { getLeaves, getReimbursements, decideLeave, decideReimbursement } from "../../lib/api.js";
import StatusPill from "../../components/StatusPill.jsx";

function RejectBox({ onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2 sm:flex-row sm:items-center">
      <input
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for rejecting…"
        className="flex-1 rounded-md border border-rose-200 bg-white px-2 py-1.5 text-[12px] outline-none"
      />
      <div className="flex gap-2">
        <button onClick={() => onConfirm(reason)} disabled={!reason.trim()} className="rounded-md bg-rose-600 px-2.5 py-1.5 text-[11.5px] font-medium text-white disabled:opacity-40">
          Confirm reject
        </button>
        <button onClick={onCancel} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[11.5px] text-slate-600">
          Cancel
        </button>
      </div>
    </div>
  );
}

function RequestCard({ item, kind, onDecide }) {
  const [confirming, setConfirming] = useState(null); // "approve" | "reject" | null
  const [rejecting, setRejecting] = useState(false);

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13.5px] font-semibold text-slate-800">
            {item.staff?.name || item.staffName}
            {kind === "leave" ? ` · ${item.type}` : ` · ₹${item.amount}`}
          </p>
          {kind === "leave" ? (
            <p className="text-[12px] text-slate-400">{item.date_from} → {item.date_to}</p>
          ) : (
            <p className="text-[12px] text-slate-400">{item.category}</p>
          )}
          <p className="mt-0.5 text-[12px] text-slate-500">{item.reason || item.note}</p>
          {item.status === "rejected" && item.reject_reason && (
            <p className="mt-1 text-[11.5px] text-rose-500">Reason: {item.reject_reason}</p>
          )}
        </div>
        {item.status !== "pending" && <StatusPill status={item.status} />}
      </div>

      {item.status === "pending" && (
        <div className="mt-2.5">
          {confirming === "approve" ? (
            <div className="flex gap-2">
              <button onClick={() => onDecide(item.id, "approved")} className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-[11.5px] font-medium text-white">
                Confirm approve
              </button>
              <button onClick={() => setConfirming(null)} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[11.5px] text-slate-600">
                Cancel
              </button>
            </div>
          ) : rejecting ? (
            <RejectBox
              onConfirm={(reason) => { onDecide(item.id, "rejected", reason); setRejecting(false); }}
              onCancel={() => setRejecting(false)}
            />
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setConfirming("approve")} className="flex-1 rounded-lg bg-emerald-50 py-1.5 text-[12px] font-medium text-emerald-700 hover:bg-emerald-100">
                Approve
              </button>
              <button onClick={() => setRejecting(true)} className="flex-1 rounded-lg bg-rose-50 py-1.5 text-[12px] font-medium text-rose-600 hover:bg-rose-100">
                Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Approvals() {
  const [tab, setTab] = useState("leaves");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [leaves, setLeaves] = useState([]);
  const [reimbursements, setReimbursements] = useState([]);

  useEffect(() => {
    getLeaves().then(setLeaves);
    getReimbursements().then(setReimbursements);
  }, []);

  async function handleDecideLeave(id, status, rejectReason) {
    await decideLeave(id, status, rejectReason || null);
    setLeaves((ls) => ls.map((l) => (l.id === id ? { ...l, status, reject_reason: rejectReason || null } : l)));
  }
  async function handleDecideReimbursement(id, status, rejectReason) {
    await decideReimbursement(id, status, rejectReason || null);
    setReimbursements((rs) => rs.map((r) => (r.id === id ? { ...r, status, reject_reason: rejectReason || null } : r)));
  }

  const list = tab === "leaves" ? leaves : reimbursements;
  const filtered = list.filter((i) => i.status === statusFilter);

  return (
    <div className="px-4 py-4 md:px-6 md:py-6">
      <p className="mb-3 text-[12.5px] text-slate-400">Review and act on leave & reimbursement requests.</p>

      <div className="mb-3 flex gap-1.5">
        {[{ id: "leaves", label: "Leaves" }, { id: "reimburse", label: "Reimbursements" }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${tab === t.id ? "bg-accent text-white" : "border border-slate-200 bg-white text-slate-500"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex gap-1.5">
        {["pending", "approved", "rejected"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${statusFilter === s ? "bg-slate-800 text-white" : "border border-slate-200 bg-white text-slate-500"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <p className="text-[13px] text-slate-400">Nothing here.</p>
        ) : tab === "leaves" ? (
          filtered.map((l) => <RequestCard key={l.id} item={l} kind="leave" onDecide={handleDecideLeave} />)
        ) : (
          filtered.map((r) => <RequestCard key={r.id} item={r} kind="reimburse" onDecide={handleDecideReimbursement} />)
        )}
      </div>
    </div>
  );
}
