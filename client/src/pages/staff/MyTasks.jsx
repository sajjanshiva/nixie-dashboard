import React, { useEffect, useState } from "react";
import { getTasks } from "../../lib/api.js";
import { useAuth } from "../../lib/AuthContext.jsx";
import TaskConversation from "../../components/TaskConversation.jsx";

const FILTERS = [
  { id: "all", label: "All my tasks" },
  { id: "open", label: "In progress" },
];

export default function MyTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!user) return;
    getTasks({ assigneeId: user.id }).then(setTasks);
  }, [user]);

  const filtered = tasks.filter((t) => (filter === "open" ? t.status === "In Progress" : true));

  function handleProgressChange(taskId, progress, status) {
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, progress, ...(status ? { status } : {}) } : t)));
  }

  return (
    <div className="flex h-full">
      {/* List — hidden on mobile once a task is selected */}
      <div className={`w-full flex-col border-r border-slate-100 md:flex md:w-[300px] ${selected ? "hidden md:flex" : "flex"}`}>
        <div className="flex gap-1.5 border-b border-slate-100 px-4 py-2.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium ${
                filter === f.id ? "bg-accent text-white" : "bg-slate-50 text-slate-500"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-[12.5px] text-slate-400">No tasks here.</p>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className={`flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left ${
                  selected?.id === t.id ? "bg-accent-soft" : "hover:bg-slate-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-800">{t.title}</p>
                  <p className="truncate text-[11.5px] text-slate-400">{t.client_name}</p>
                </div>
                <span className="shrink-0 text-[11px] text-slate-400">{t.progress}%</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Conversation */}
      <div className={`flex-1 ${selected ? "flex" : "hidden md:flex"} flex-col`}>
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-slate-400">
            Select a task to see the conversation
          </div>
        ) : (
          <TaskConversation
            task={selected}
            staffToggleLabel="Admin"
            onBack={() => setSelected(null)}
            onProgressChange={handleProgressChange}
          />
        )}
      </div>
    </div>
  );
}
