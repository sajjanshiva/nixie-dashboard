import React, { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { checkIn, checkOut, getTasks } from "../../lib/api.js";

export default function Home() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null); // { checkIn, checkOut, statusToday }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [taskSummary, setTaskSummary] = useState({ done: 0, total: 0 });

  useEffect(() => {
    if (!user) return;
    getTasks({ assigneeId: user.id }).then((tasks) => {
      setTaskSummary({ done: tasks.filter((t) => t.status === "Complete").length, total: tasks.length });
    });
  }, [user]);

  async function handleCheckIn() {
    setError("");
    if (!navigator.geolocation) {
      setError("Location isn't available on this device/browser.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await checkIn({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setStatus(res);
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      },
      () => {
        setError("Location permission is required to check in.");
        setBusy(false);
      }
    );
  }

  async function handleCheckOut() {
    setBusy(true);
    try {
      const res = await checkOut();
      setStatus(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-4 md:px-6 md:py-6">
      <h2 className="mb-4 text-[16px] font-bold text-slate-900">Good day, {user?.name?.split(" ")[0]} 👋</h2>

      <div className="mb-4 rounded-xl border border-slate-100 bg-white p-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Attendance</p>
        {status?.checkOut ? (
          <p className="text-[13.5px] text-slate-700">
            Checked in: {new Date(status.checkIn).toLocaleTimeString()} · Checked out: {new Date(status.checkOut).toLocaleTimeString()}
          </p>
        ) : status?.checkIn ? (
          <div>
            <p className="mb-3 text-[13.5px] text-slate-700">
              🟢 Checked in — {new Date(status.checkIn).toLocaleTimeString()} ({status.statusToday})
            </p>
            <button onClick={handleCheckOut} disabled={busy} className="rounded-lg bg-slate-800 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">
              {busy ? "…" : "Check Out"}
            </button>
          </div>
        ) : (
          <button onClick={handleCheckIn} disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">
            {busy ? "Getting location…" : "Check In"}
          </button>
        )}
        {error && <p className="mt-2 text-[12px] text-rose-600">{error}</p>}
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4">
        <CheckCircle2 size={20} className="text-emerald-500" />
        <p className="text-[13.5px] text-slate-700">
          Today's tasks: <span className="font-semibold">{taskSummary.done} / {taskSummary.total}</span> completed
        </p>
      </div>
    </div>
  );
}
