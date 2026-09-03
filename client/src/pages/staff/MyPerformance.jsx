import React, { useEffect, useState } from "react";
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { useAuth } from "../../lib/AuthContext.jsx";
import { getAttendanceSummary, getTasks } from "../../lib/api.js";

const WEIGHTS = { punctuality: 0.4, taskOnTime: 0.6 };

function scoreColor(score) {
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#FF6B5E";
}

const PERIOD_OPTIONS = ["This Month", "Last Month", "This Year"];

export default function MyPerformance() {
  const { user } = useAuth();
  const [stats, setStats]   = useState(null);
  const [period, setPeriod] = useState("This Month");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [attendance, tasks] = await Promise.all([
        getAttendanceSummary({ staffId: user.id }),
        getTasks({ assigneeId: user.id }),
      ]);

      const total       = attendance.length || 1;
      const onTime      = attendance.filter((a) => a.status === "on_time").length;
      const late        = attendance.filter((a) => a.status === "late").length;
      const present     = attendance.filter((a) => a.status !== "absent").length;
      const punctuality = Math.round((onTime / total) * 100);

      const completed    = tasks.filter((t) => t.status === "Complete");
      const onTimeTasks  = completed.filter(
        (t) => t.due_date && t.updated_at && t.updated_at.slice(0, 10) <= t.due_date
      );
      const overdue = tasks.filter(
        (t) => t.due_date && t.status !== "Complete" && t.due_date < new Date().toISOString().slice(0, 10)
      );
      const taskOnTimePct = completed.length
        ? Math.round((onTimeTasks.length / completed.length) * 100)
        : 0;
      const score = Math.round(WEIGHTS.punctuality * punctuality + WEIGHTS.taskOnTime * taskOnTimePct);

      setStats({
        present, total, onTime, late, punctuality,
        assigned: tasks.length, completed: completed.length,
        overdue: overdue.length, taskOnTimePct, score,
      });
    })();
  }, [user]);

  if (!stats) {
    return (
      <div className="px-4 py-6 md:px-6 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />
        ))}
      </div>
    );
  }

  const color = scoreColor(stats.score);

  // Radial chart data
  const radialData = [{ name: "Score", value: stats.score, fill: color }];

  // Attendance bar chart
  const attendanceChart = [
    { name: "Present",  value: stats.present,  fill: "#22c55e" },
    { name: "On Time",  value: stats.onTime,   fill: "#22D3D3" },
    { name: "Late",     value: stats.late,      fill: "#f59e0b" },
    { name: "Absent",   value: Math.max(0, stats.total - stats.present), fill: "#FF6B5E" },
  ];

  // Task chart
  const taskChart = [
    { name: "Assigned",  value: stats.assigned,   fill: "#94a3b8" },
    { name: "Done",      value: stats.completed,  fill: "#22D3D3" },
    { name: "Overdue",   value: stats.overdue,    fill: "#FF6B5E" },
  ];

  return (
    <div className="px-4 py-5 md:px-6 md:py-6 space-y-5">
      {/* Period toggle */}
      <div className="flex flex-wrap gap-1.5">
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

      {/* Score hero card */}
      <div className="card p-5 dark:bg-[#1A1D27]">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          {/* Radial score ring */}
          <div className="relative shrink-0" style={{ width: 130, height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="70%"
                outerRadius="100%"
                data={[{ value: 100, fill: "#f1f5f9" }, { ...radialData[0] }]}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "#f1f5f9" }} />
              </RadialBarChart>
            </ResponsiveContainer>
            {/* Score text overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[28px] font-extrabold leading-none" style={{ color }}>
                {stats.score}%
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Score
              </span>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="flex-1 space-y-3 w-full">
            <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
              Overall Performance Score
            </p>
            <div className="space-y-2.5">
              {/* Punctuality bar */}
              <div>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="text-slate-500 dark:text-slate-400">Punctuality (40%)</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{stats.punctuality}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/8">
                  <div className="h-2 rounded-full bg-accent transition-all" style={{ width: `${stats.punctuality}%` }} />
                </div>
              </div>
              {/* Task on-time bar */}
              <div>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="text-slate-500 dark:text-slate-400">Task On-Time (60%)</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{stats.taskOnTimePct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/8">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${stats.taskOnTimePct}%`, background: scoreColor(stats.taskOnTimePct) }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two mini charts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Attendance chart */}
        <div className="card p-4 dark:bg-[#1A1D27]">
          <p className="mb-3 text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">
            Attendance Breakdown
          </p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={attendanceChart} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v, name) => [v, name]}
                contentStyle={{ borderRadius: 10, fontSize: 12 }}
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
              />
              <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                {attendanceChart.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Task chart */}
        <div className="card p-4 dark:bg-[#1A1D27]">
          <p className="mb-3 text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">
            Task Summary
          </p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={taskChart} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                formatter={(v, name) => [v, name]}
                contentStyle={{ borderRadius: 10, fontSize: 12 }}
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
              />
              <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                {taskChart.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Days Present",  value: `${stats.present}/${stats.total}`, color: "text-emerald-600" },
          { label: "On Time",       value: stats.onTime,                      color: "text-accent-text" },
          { label: "Late",          value: stats.late,                        color: "text-amber-500" },
          { label: "Tasks Overdue", value: stats.overdue,                     color: "text-danger" },
        ].map((s) => (
          <div key={s.label} className="card p-4 dark:bg-[#1A1D27]">
            <p className="mb-1 text-[10.5px] uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className={`text-[22px] font-extrabold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
