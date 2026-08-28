import React, { useEffect, useState } from "react";
import { UserPlus, ClipboardPlus, X } from "lucide-react";
import { getTeamMembers, addTeamMember, createTask } from "../../lib/api.js";
import Avatar from "../../components/Avatar.jsx";
import Modal from "../../components/Modal.jsx";

function AddMemberForm({ onDone }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await addTeamMember(form);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <h3 className="mb-4 text-[15px] font-bold text-slate-900">Add Team Member</h3>
      <div className="space-y-3">
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] outline-none focus:border-accent" />
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] outline-none focus:border-accent" />
        <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] outline-none focus:border-accent" />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] outline-none focus:border-accent">
          <option value="staff">Employee</option>
          <option value="admin">Admin</option>
        </select>
        {error && <p className="text-[12px] text-rose-600">{error}</p>}
        <button onClick={submit} disabled={saving} className="w-full rounded-lg bg-accent py-2.5 text-[13.5px] font-medium text-white disabled:opacity-50">
          {saving ? "Adding…" : "Add"}
        </button>
      </div>
    </div>
  );
}

function NewTaskForm({ members, onDone }) {
  const [form, setForm] = useState({ title: "", description: "", client_name: "", client_phone: "", due_date: "", links: "", assignee_id: "" });
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await createTask({ ...form, assignee_id: form.assignee_id || null, source: "manual" });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <h3 className="mb-4 text-[15px] font-bold text-slate-900">Create Task</h3>
      <div className="space-y-3">
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] outline-none focus:border-accent" />
        <textarea placeholder="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] outline-none focus:border-accent" />
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Client name" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] outline-none focus:border-accent" />
          <input placeholder="Client phone" value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] outline-none focus:border-accent" />
        </div>
        <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] outline-none focus:border-accent" />
        <textarea placeholder="Links (one per line)" rows={2} value={form.links} onChange={(e) => setForm({ ...form, links: e.target.value })} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] outline-none focus:border-accent" />
        <select value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] outline-none focus:border-accent">
          <option value="">Unassigned</option>
          {members.filter((m) => m.role === "staff").map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <button onClick={submit} disabled={saving || !form.title} className="w-full rounded-lg bg-accent py-2.5 text-[13.5px] font-medium text-white disabled:opacity-50">
          {saving ? "Creating…" : "Create"}
        </button>
      </div>
    </div>
  );
}

export default function Team() {
  const [members, setMembers] = useState([]);
  const [modal, setModal] = useState(null); // "member" | "task" | null

  function reload() {
    getTeamMembers().then(setMembers);
  }
  useEffect(reload, []);

  return (
    <div className="px-4 py-4 md:px-6 md:py-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[12.5px] text-slate-400">Manage members and create tasks.</p>
        <div className="flex gap-2">
          <button onClick={() => setModal("task")} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50">
            <ClipboardPlus size={14} /> New Task
          </button>
          <button onClick={() => setModal("member")} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[12.5px] font-medium text-white hover:opacity-90">
            <UserPlus size={14} /> Add Member
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3.5">
            <Avatar name={m.name} className="h-9 w-9 text-[12px]" />
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-slate-800">{m.name}</p>
              <p className="truncate text-[11.5px] text-slate-400">{m.email}</p>
              <p className="text-[11px] font-medium capitalize text-accent-text">{m.role}</p>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!modal} onClose={() => { setModal(null); reload(); }}>
        {modal === "member" && <AddMemberForm onDone={() => { setModal(null); reload(); }} />}
        {modal === "task" && <NewTaskForm members={members} onDone={() => { setModal(null); reload(); }} />}
      </Modal>
    </div>
  );
}
