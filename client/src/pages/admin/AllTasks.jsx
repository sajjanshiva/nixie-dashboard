import React, { useEffect, useState } from "react";
import { ShoppingBag, Tag } from "lucide-react";
import { getTasks } from "../../lib/api.js";
import Modal from "../../components/Modal.jsx";
import TaskConversation from "../../components/TaskConversation.jsx";

const FILTERS = ["All", "In Progress", "Complete", "Unassigned"];

export default function AllTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [openTask, setOpenTask] = useState(null);

  useEffect(() => {
    getTasks()
      .then(setTasks)
      .finally(() => setLoading(false));
  }, []);

  const filtered = tasks.filter((t) => {
    if (filter === "All") return true;
    if (filter === "Unassigned") return !t.assignee_id;
    return t.status === filter;
  });

  function handleProgressChange(taskId, progress, status) {
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, progress, ...(status ? { status } : {}) } : t)));
  }

  return (
    <div className="px-4 py-4 md:px-6 md:py-6">
      <p className="mb-3 text-[12.5px] text-slate-400">{tasks.length} tasks · updates from clients sync automatically</p>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
              filter === f ? "bg-accent text-white" : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[13px] text-slate-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-[13px] text-slate-400">No tasks match this filter.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => setOpenTask(t)}
              className="rounded-xl border border-slate-100 bg-white p-3.5 text-left transition hover:border-accent/40 hover:shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold text-accent-text">
                  {t.status}
                </span>
                {t.source === "shopify_order" ? (
                  <ShoppingBag size={13} className="text-emerald-500" />
                ) : t.source === "manual" ? null : (
                  <Tag size={13} className="text-amber-500" />
                )}
              </div>
              <p className="truncate text-[13.5px] font-semibold text-slate-800">{t.title}</p>
              <p className="mb-2 truncate text-[12px] text-slate-400">{t.assignee?.name || t.client_name || "Unassigned"}</p>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Progress</span>
                <span>{t.progress}%</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                <div className="h-1.5 rounded-full bg-accent" style={{ width: `${t.progress}%` }} />
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!openTask} onClose={() => setOpenTask(null)} wide>
        {openTask && (
          <TaskConversation task={openTask} staffToggleLabel="Staff" onProgressChange={handleProgressChange} />
        )}
      </Modal>
    </div>
  );
}
