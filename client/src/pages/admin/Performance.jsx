import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { getTeamMembers, getAttendanceSummary, getTasks } from "../../lib/api.js";

const WEIGHTS = { punctuality: 0.4, taskOnTime: 0.6 };

function computeStats(attendanceRows, taskRows) {
  const present = attendanceRows.filter((a) => a.status !== "absent").length;
  const total = attendanceRows.length || 1;
  const onTime = attendanceRows.filter((a) => a.status === "on_time").length;
  const late = attendanceRows.filter((a) => a.status === "late").length;
  const punctuality = Math.round((onTime / total) * 100);

  const completed = taskRows.filter((t) => t.status === "Complete");
  const onTimeTasks = completed.filter((t) => t.due_date && t.updated_at && t.updated_at.slice(0, 10) <= t.due_date);
  const overdue = taskRows.filter((t) => t.due_date && t.status !== "Complete" && t.due_date < new Date().toISOString().slice(0, 10));
  const taskOnTimePct = completed.length ? Math.round((onTimeTasks.length / completed.length) * 100) : 0;

  const score = Math.round(WEIGHTS.punctuality * punctuality + WEIGHTS.taskOnTime * taskOnTimePct);

  return {
    present, total, onTime, late, punctuality,
    assigned: taskRows.length, completed: completed.length, onTimeCompleted: onTimeTasks.length,
    overdue: overdue.length, taskOnTimePct, score,
  };
}

export default function Performance() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    (async () => {
      const members = (await getTeamMembers()).filter((m) => m.role === "staff");
      const results = await Promise.all(
        members.map(async (m) => {
          const [attendance, tasks] = await Promise.all([
            getAttendanceSummary({ staffId: m.id }),
            getTasks({ assigneeId: m.id }),
          ]);
          return { member: m, stats: computeStats(attendance, tasks) };
        })
      );
      setRows(results);
    })();
  }, []);

  const teamPunctuality = rows.length ? Math.round(rows.reduce((a, r) => a + r.stats.punctuality, 0) / rows.length) : 0;
  const teamTaskOnTime = rows.length ? Math.round(rows.reduce((a, r) => a + r.stats.taskOnTimePct, 0) / rows.length) : 0;
  const totalDone = rows.reduce((a, r) => a + r.stats.completed, 0);
  const totalOverdue = rows.reduce((a, r) => a + r.stats.overdue, 0);

  return (
    <div className="px-4 py-4 md:px-6 md:py-6">
      <p className="mb-4 text-[12.5px] text-slate-400">Punctuality (40%) + on-time task completion (60%) — this month.</p>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Punctuality", value: `${teamPunctuality}%` },
          { label: "Task On-Time", value: `${teamTaskOnTime}%` },
          { label: "Tasks Done", value: totalDone },
          { label: "Overdue", value: totalOverdue },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-100 bg-white p-4">
            <p className="text-[11px] text-slate-400">{c.label}</p>
            <p className="text-[20px] font-bold text-slate-900">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
        <table className="w-full min-w-[480px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 text-[11.5px] text-slate-400">
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Punctuality</th>
              <th className="px-4 py-3 font-medium">Task On-Time</th>
              <th className="px-4 py-3 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.member.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-800">{r.member.name}</td>
                <td className="px-4 py-3 text-slate-600">{r.stats.punctuality}%</td>
                <td className="px-4 py-3 text-slate-600">{r.stats.taskOnTimePct}%</td>
                <td className="px-4 py-3 font-semibold text-accent-text">{r.stats.score}%</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No staff data yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
