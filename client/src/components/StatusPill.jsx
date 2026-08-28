import React from "react";
import { Check, XCircle, Clock } from "lucide-react";

export default function StatusPill({ status }) {
  const map = {
    approved: { bg: "bg-emerald-50", text: "text-emerald-700", Icon: Check, label: "Approved" },
    rejected: { bg: "bg-rose-50", text: "text-rose-600", Icon: XCircle, label: "Rejected" },
    pending: { bg: "bg-amber-50", text: "text-amber-700", Icon: Clock, label: "Pending" },
  };
  const s = map[status] || map.pending;
  const { Icon } = s;
  return (
    <span className={`flex items-center gap-1 rounded-full ${s.bg} ${s.text} px-2 py-0.5 text-[11px] font-medium shrink-0`}>
      <Icon size={11} />
      {s.label}
    </span>
  );
}
