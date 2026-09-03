import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { getTeamMembers, getAttendanceSummary, getTasks } from "../../lib/api.js";
import Avatar from "../../components/Avatar.jsx";

const WEIGHTS = { punctuality: 0.4, taskOnTime: 0.6 };

function computeStats(attendanceRows, taskRows) {
  const total      = attendanceRows.length || 1;
  const onTime     = attendanceRows.filter((a) => a.status === "on_time").length;
  const late       = attendanceRows.filter((a) => a.status === "late").length;
  const present    = attendanceRows.filter((a) => a.status !== "absent").length;
  const punctuality = Math.round((onTime / total) * 100);

  const completed      = taskRows.filter((t) => t.status === "Complete");
  const onTimeTasks    = completed.filter(
    (t) => t.due_date && t.updated_at && t.updated_at.slice(0, 10) <= t.due_date
  );
  const overdue = taskRows.filter(
    (t) => t.due_date && t.status !== "Complete" && t.due_date < new Date().toISOString().slice(0, 10)
  );
  const taskOnTimePct = completed.length
    ? Math.round((onTimeTasks.length / completed.length) * 100)
    : 0;

  const score = Math.round(WEIGHTS.punctuality * punctuality + WEIGHTS.taskOnTime * taskOnTimePct);

  return {
    present, total, onTime, late, punctuality,
    assigned: taskRows.length, completed: completed.length,
    onTimeCompleted: onTimeTasks.length, overdue: overdue.length,
    taskOnTimePct, score,
  };
}

// Color based on score
function scoreColor(score) {
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#FF6B5E";
}

// Custom tooltip for recharts
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-lg dark:border-white/10 dark:bg-[#1e2130]">
      <p className="mb-1 text-[12px] font-semibold text-slate-700 dark:text-slate-200">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-[12px]" style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}%</span>
        </p>
      ))}
    </div>
  );
}

const PERIOD_OPTIONS = ["This Month", "Last Month", "This Year"];

export default function Performance() {
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("This Month");

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
      setLoading(false);
    })();
  }, []);

  // Team averages
  const teamPunctuality = rows.length
    ? Math.round(rows.reduce((a, r) => a + r.stats.punctuality, 0) / rows.length)
    : 0;
  const teamTaskOnTime = rows.length
    ? Math.round(rows.reduce((a, r) => a + r.stats.taskOnTimePct, 0) / rows.length)
    : 0;
  const totalDone    = rows.reduce((a, r) => a + r.stats.completed, 0);
  const totalOverdue = rows.reduce((a, r) => a + r.stats.overdue, 0);

  // Chart data
  const chartData = rows.map((r) => ({
    name: r.member.name.split(" ")[0],
    Score: r.stats.score,
    Punctuality: r.stats.punctuality,
    "Task On-Time": r.stats.taskOnTimePct,
    _score: r.stats.score,
  }));

  // Top performer
  const top = rows.length
    ? rows.reduce((best, r) => (r.stats.score > best.stats.score ? r : best), rows[0])
    : null;

  const STAT_CARDS = [
    { label: "Team Punctuality",  value: `${teamPunctuality}%`,  color: "text-emerald-600" },
    { label: "Task On-Time",      value: `${teamTaskOnTime}%`,   color: "text-accent" },
    { label: "Tasks Completed",   value: totalDone,              color: "text-slate-800 dark:text-slate-100" },
    { label: "Overdue Tasks",     value: totalOverdue,           color: "text-danger" },
  ];

  return (
    <div className="px-4 py-5 md:px-6 md:py-6 space-y-6">
      {/* Period toggle */}
      <div className="flex items-center gap-2">
        {PERIOD_OPTIONS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
              period === p
                ? "bg-accent text-white"
                : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STAT_CARDS.map((c) => (
          <div key={c.label} className="card p-4 dark:bg-[#1A1D27]">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {c.label}
            </p>
            <p className={`text-[26px] font-extrabold leading-tight ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Top performer highlight */}
      {top && (
        <div className="flex items-center gap-3 rounded-2xl border border-accent/20 bg-accent/5 px-5 py-4 dark:border-accent/20 dark:bg-accent/10">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-[18px]">
            🏆
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-accent-text dark:text-accent">
              Top Performer
            </p>
            <p className="text-[14px] font-bold text-slate-800 dark:text-slate-100">
              {top.member.name}{" "}
              <span className="text-[13px] font-medium text-slate-400">
                — Score: {top.stats.score}%
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Bar chart */}
      {!loading && chartData.length > 0 && (
        <div className="card p-5 dark:bg-[#1A1D27]">
          <p className="mb-4 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
            Performance Score by Staff
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={28} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="Score" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={scoreColor(entry._score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Score color legend */}
          <div className="mt-3 flex flex-wrap gap-4">
            {[
              { color: "#22c55e", label: "≥ 80% — Great" },
              { color: "#f59e0b", label: "50–79% — Needs improvement" },
              { color: "#FF6B5E", label: "< 50% — Attention needed" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Staff table */}
      <div className="card overflow-hidden dark:bg-[#1A1D27]">
        <div className="border-b border-slate-100 px-5 py-3.5 dark:border-white/6">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
            Staff Breakdown
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-50 text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/6">
                <th className="px-5 py-3 font-semibold">Employee</th>
                <th className="px-5 py-3 font-semibold">Punctuality</th>
                <th className="px-5 py-3 font-semibold">Task On-Time</th>
                <th className="px-5 py-3 font-semibold">Tasks Done</th>
                <th className="px-5 py-3 font-semibold">Score</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-5 py-3">
                        <div className="h-4 animate-pulse rounded-full bg-slate-100 dark:bg-white/5" />
                      </td>
                    </tr>
                  ))
                : rows.map((r) => (
                    <tr
                      key={r.member.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 dark:border-white/4 dark:hover:bg-white/3"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.member.name} className="h-7 w-7 text-[10px] shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {r.member.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                        {r.stats.punctuality}%
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                        {r.stats.taskOnTimePct}%
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                        {r.stats.completed}/{r.stats.assigned}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-bold text-white"
                          style={{ background: scoreColor(r.stats.score) }}
                        >
                          {r.stats.score}%
                        </span>
                      </td>
                    </tr>
                  ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    No staff data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
