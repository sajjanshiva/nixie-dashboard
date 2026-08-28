import React, { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { getAttendanceSummary, getTasks } from "../../lib/api.js";

const WEIGHTS = { punctuality: 0.4, taskOnTime: 0.6 };

export default function MyPerformance() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [attendance, tasks] = await Promise.all([
        getAttendanceSummary({ staffId: user.id }),
        getTasks({ assigneeId: user.id }),
      ]);

      const present = attendance.filter((a) => a.status !== "absent").length;
      const total = attendance.length || 1;
      const onTime = attendance.filter((a) => a.status === "on_time").length;
      const late = attendance.filter((a) => a.status === "late").length;
      const punctuality = Math.round((onTime / total) * 100);

      const completed = tasks.filter((t) => t.status === "Complete");
      const onTimeTasks = completed.filter((t) => t.due_date && t.updated_at && t.updated_at.slice(0, 10) <= t.due_date);
      const overdue = tasks.filter((t) => t.due_date && t.status !== "Complete" && t.due_date < new Date().toISOString().slice(0, 10));
      const taskOnTimePct = completed.length ? Math.round((onTimeTasks.length / completed.length) * 100) : 0;

      const score = Math.round(WEIGHTS.punctuality * punctuality + WEIGHTS.taskOnTime * taskOnTimePct);

      setStats({
        present, total, onTime, late, punctuality,
        assigned: tasks.length, completed: completed.length, onTimeCompleted: onTimeTasks.length,
        overdue: overdue.length, taskOnTimePct, score,
      });
    })();
  }, [user]);

  if (!stats) return <div className="px-4 py-6 text-[13px] text-slate-400 md:px-6">Loading…</div>;

  return (
    <div className="px-4 py-4 md:px-6 md:py-6">
      <div className="mb-5 rounded-xl border border-slate-100 bg-white p-5 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Overall Score</p>
        <p className="text-[34px] font-bold text-accent">{stats.score}%</p>
      </div>

      <div className="mb-4 rounded-xl border border-slate-100 bg-white p-4">
        <p className="mb-3 text-[12px] font-semibold text-slate-600">Punctuality</p>
        <dl className="grid grid-cols-2 gap-y-2 text-[13px] sm:grid-cols-4">
          <div><dt className="text-slate-400">Present</dt><dd className="font-semibold text-slate-800">{stats.present}/{stats.total}</dd></div>
          <div><dt className="text-slate-400">On-time</dt><dd className="font-semibold text-slate-800">{stats.onTime}</dd></div>
          <div><dt className="text-slate-400">Late</dt><dd className="font-semibold text-slate-800">{stats.late}</dd></div>
          <div><dt className="text-slate-400">Punctuality</dt><dd className="font-semibold text-slate-800">{stats.punctuality}%</dd></div>
        </dl>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-4">
        <p className="mb-3 text-[12px] font-semibold text-slate-600">Task Performance</p>
        <dl className="grid grid-cols-2 gap-y-2 text-[13px] sm:grid-cols-4">
          <div><dt className="text-slate-400">Assigned</dt><dd className="font-semibold text-slate-800">{stats.assigned}</dd></div>
          <div><dt className="text-slate-400">Completed</dt><dd className="font-semibold text-slate-800">{stats.completed}</dd></div>
          <div><dt className="text-slate-400">Overdue</dt><dd className="font-semibold text-slate-800">{stats.overdue}</dd></div>
          <div><dt className="text-slate-400">On-time %</dt><dd className="font-semibold text-slate-800">{stats.taskOnTimePct}%</dd></div>
        </dl>
      </div>
    </div>
  );
}
