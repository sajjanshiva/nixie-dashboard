import React from "react";
import { X } from "lucide-react";

export default function Modal({ open, onClose, children, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div
        className={`relative h-[92vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-xl sm:h-[85vh] sm:rounded-2xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm hover:bg-slate-50 hover:text-slate-600"
        >
          <X size={18} />
        </button>
        <div className="h-full">{children}</div>
      </div>
    </div>
  );
}