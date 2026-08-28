import React, { useEffect, useState } from "react";
import { Bell as BellIcon } from "lucide-react";
import { useAuth } from "../lib/AuthContext.jsx";
import { getNotifications, markAllNotificationsRead } from "../lib/api.js";

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!user) return;
    getNotifications(user.id).then(setItems).catch(() => {});
  }, [user]);

  const unread = items.filter((i) => !i.read).length;

  async function markRead() {
    if (!user) return;
    await markAllNotificationsRead(user.id).catch(() => {});
    setItems((its) => its.map((i) => ({ ...i, read: true })));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
        aria-label="Notifications"
      >
        <BellIcon size={19} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 max-w-[85vw] rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[12px] font-semibold text-slate-700">Notifications</span>
            <button onClick={markRead} className="text-[11px] text-accent hover:underline">
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-center text-[12px] text-slate-400">Nothing yet.</p>
          ) : (
            items.map((n) => (
              <div key={n.id} className="flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-slate-50">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-accent"}`} />
                <div>
                  <p className="text-[12.5px] text-slate-700">{n.text}</p>
                  <p className="text-[10.5px] text-slate-400">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
