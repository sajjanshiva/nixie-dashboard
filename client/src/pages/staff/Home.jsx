import React, { useEffect, useState } from "react";
import { MapPin, LogIn, LogOut, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { checkIn, checkOut, getTodayAttendance, getWeekAttendance } from "../../lib/api.js";
import toast from "react-hot-toast";

// Day abbreviations for the week strip
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Status dot styles for week strip
function statusDot(status, isToday, isFuture) {
  if (isFuture)  return { bg: "bg-slate-100 dark:bg-white/8", ring: "", label: "" };
  if (!status)   return { bg: "bg-slate-200 dark:bg-slate-700", ring: "", label: "Absent" };
  if (status === "on_time") return { bg: "bg-emerald-400", ring: "ring-2 ring-emerald-200 dark:ring-emerald-800", label: "On Time" };
  if (status === "late")    return { bg: "bg-amber-400",   ring: "ring-2 ring-amber-200 dark:ring-amber-800",   label: "Late" };
  if (status === "absent")  return { bg: "bg-slate-300 dark:bg-slate-600", ring: "", label: "Absent" };
  return { bg: "bg-slate-200", ring: "", label: "" };
}

// Format "HH:MM AM/PM"
function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Compute duration string between two ISO timestamps
function duration(from, to) {
  if (!from || !to) return null;
  const diff = Math.round((new Date(to) - new Date(from)) / 60000); // minutes
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Home() {
  const { user } = useAuth();
  const [today, setToday] = useState(null);   // today's attendance row or null
  const [week, setWeek]   = useState({});     // map of date → row
  const [weekMon, setWeekMon] = useState(null);
  const [busy, setBusy] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  // ── Load today + week attendance on mount ──────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [todayRow, weekData] = await Promise.all([
          getTodayAttendance(user.id),
          getWeekAttendance(user.id),
        ]);
        setToday(todayRow);
        setWeek(weekData.map);
        setWeekMon(weekData.monday);
      } catch {
        // Silent fail — buttons still functional
      } finally {
        setInitLoading(false);
      }
    })();
  }, [user]);

  // ── Check-in ─────────────────────────────────────────────────────────
  async function handleCheckIn() {
    if (!navigator.geolocation) {
      toast.error("Location isn't available on this device/browser.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await checkIn({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setToday(res);
          toast.success(`Checked in at ${fmtTime(res.checkIn || res.check_in)} — ${res.statusToday || res.status || "recorded"}`);
        } catch (e) {
          toast.error(e.message);
        } finally {
          setBusy(false);
        }
      },
      () => {
        toast.error("Location permission is required to check in.");
        setBusy(false);
      }
    );
  }

  // ── Check-out ────────────────────────────────────────────────────────
  async function handleCheckOut() {
    setBusy(true);
    try {
      const res = await checkOut();
      setToday(res);
      toast.success(`Checked out at ${fmtTime(res.checkOut || res.check_out)}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Normalise field names (backend may return camelCase or snake_case)
  const checkInTime  = today?.checkIn  || today?.check_in;
  const checkOutTime = today?.checkOut || today?.check_out;
  const statusToday  = today?.statusToday || today?.status;

  // Today's date string
  const todayStr = new Date().toISOString().slice(0, 10);
  const nowDate  = new Date();

  // Build the 7-day array (Mon → Sun)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    if (!weekMon) return { label: DAY_LABELS[i], dateStr: "", isFuture: false, isToday: false };
    const d = new Date(weekMon);
    d.setDate(weekMon.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const isFuture = dateStr > todayStr;
    const isToday  = dateStr === todayStr;
    return { label: DAY_LABELS[i], dateStr, isFuture, isToday, row: week[dateStr] };
  });

  return (
    <div className="px-4 py-5 md:px-8 md:py-7 space-y-5 max-w-xl mx-auto md:max-w-none">
      {/* Greeting */}
      <div>
        <h2 className="text-[18px] font-bold text-slate-900 dark:text-white">
          Good {nowDate.getHours() < 12 ? "morning" : nowDate.getHours() < 17 ? "afternoon" : "evening"},{" "}
          {user?.name?.split(" ")[0]} 👋
        </h2>
        <p className="mt-0.5 text-[13px] text-slate-400">
          {nowDate.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* ── Main Check-in / Check-out card ────────────────────────────── */}
      <div className="card overflow-hidden dark:bg-[#1A1D27]">
        {/* Card header bar */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-white/6">
          <Clock size={15} className="text-accent" />
          <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Attendance — Today
          </p>
        </div>

        <div className="px-5 py-5">
          {initLoading ? (
            <div className="flex items-center gap-2 text-[13px] text-slate-400">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Loading attendance…
            </div>
          ) : checkOutTime ? (
            /* ── Fully checked out for the day ─── */
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
                <div>
                  <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">
                    Work day complete
                  </p>
                  <p className="text-[12.5px] text-slate-400">
                    Duration: <span className="font-medium text-slate-600 dark:text-slate-300">{duration(checkInTime, checkOutTime) || "—"}</span>
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Status",    value: statusToday || "—", accent: statusToday === "on_time" },
                  { label: "Check In",  value: fmtTime(checkInTime) },
                  { label: "Check Out", value: fmtTime(checkOutTime) },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-slate-50 p-3 dark:bg-white/4">
                    <p className="mb-0.5 text-[10.5px] uppercase tracking-wide text-slate-400">{s.label}</p>
                    <p className={`text-[13.5px] font-bold capitalize ${s.accent ? "text-emerald-600" : "text-slate-800 dark:text-slate-100"}`}>
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : checkInTime ? (
            /* ── Checked in, not yet out ─────── */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">
                      Currently checked in
                    </p>
                    <p className="text-[12px] text-slate-400">
                      Since {fmtTime(checkInTime)} ·{" "}
                      <span className={`font-medium capitalize ${statusToday === "on_time" ? "text-emerald-600" : "text-amber-500"}`}>
                        {statusToday || "—"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCheckOut}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-slate-800 py-3.5 text-[14px] font-semibold text-white transition hover:bg-slate-900 active:scale-[0.98] disabled:opacity-50 dark:bg-white/10 dark:hover:bg-white/15"
              >
                <LogOut size={17} />
                {busy ? "Checking out…" : "Check Out"}
              </button>
            </div>
          ) : (
            /* ── Not yet checked in ─────────── */
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-white/6 dark:bg-white/4">
                <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />
                <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
                  Your location will be recorded on check-in to verify office presence.
                </p>
              </div>

              <button
                onClick={handleCheckIn}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-accent py-4 text-[15px] font-bold text-white shadow-lg shadow-accent/25 transition hover:bg-accent-dark active:scale-[0.98] disabled:opacity-50"
              >
                <LogIn size={18} />
                {busy ? "Getting location…" : "Check In"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── This Week strip ─────────────────────────────────────────────── */}
      <div className="card dark:bg-[#1A1D27]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-white/6">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            This Week
          </p>
        </div>
        <div className="px-5 py-4">
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {weekDays.map((d, i) => {
              const dot = statusDot(d.row?.status, d.isToday, d.isFuture);
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <span className={`text-[10.5px] font-medium ${d.isToday ? "text-accent font-bold" : "text-slate-400 dark:text-slate-500"}`}>
                    {d.label}
                  </span>
                  <div
                    title={dot.label || (d.isFuture ? "Upcoming" : "No record")}
                    className={`h-7 w-7 rounded-full transition ${dot.bg} ${dot.ring} ${d.isToday ? "scale-110" : ""}`}
                  />
                  {d.isToday && (
                    <span className="text-[9px] font-semibold text-accent">Today</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {[
              { color: "bg-emerald-400", label: "On Time" },
              { color: "bg-amber-400",   label: "Late" },
              { color: "bg-slate-300 dark:bg-slate-600", label: "Absent" },
              { color: "bg-slate-100 dark:bg-white/8",   label: "Upcoming" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className={`inline-block h-2 w-2 rounded-full ${l.color}`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
