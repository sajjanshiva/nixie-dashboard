import React from "react";
import { X } from "lucide-react";

export default function Modal({ open, onClose, children, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div
        className={`h-[92vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-xl sm:h-[85vh] sm:rounded-2xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end px-3 pt-3 sm:hidden">
          <button onClick={onClose} className="text-slate-400"><X size={20} /></button>
        </div>
        <div className="h-full">{children}</div>
      </div>
    </div>
  );
}
