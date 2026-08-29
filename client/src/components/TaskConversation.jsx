import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, Users, Send, Check, Sparkles, ChevronLeft, AlertCircle, Clock } from "lucide-react";
import Avatar from "./Avatar.jsx";
import { getMessages, subscribeToMessages, sendMessage, updateTaskProgress, markTaskComplete } from "../lib/api.js";
import { useAuth } from "../lib/AuthContext.jsx";

function Bubble({ msg }) {
  const isPending = msg._status === "pending";
  const isFailed = msg._status === "failed";

  if (msg.kind === "system") {
    return (
      <div className="my-3 flex justify-center">
        <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11.5px] text-slate-500">
          <Sparkles size={11} className="text-slate-400" />
          {msg.text}
          <span className="text-slate-300">·</span>
          {new Date(msg.created_at).toLocaleString()}
        </div>
      </div>
    );
  }
  if (msg.kind === "staff") {
    return (
      <div className={`my-2 flex items-start gap-2.5 ${isPending ? "opacity-60" : ""}`}>
        <Avatar name={msg.author_name} tone="staff" />
        <div className={`max-w-[80%] rounded-xl rounded-tl-sm border px-3.5 py-2.5 ${isFailed ? "border-rose-300 bg-rose-50" : "border-amber-200 bg-amber-50"}`}>
          <div className="mb-0.5 flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-amber-900">{msg.author_name}</span>
            <span className="rounded-full bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-800">
              <Users size={9} className="mr-1 inline -mt-0.5" />
              Staff
            </span>
          </div>
          <p className="whitespace-pre-wrap text-[14px] leading-snug text-amber-950">{msg.text}</p>
          <MsgStatus isPending={isPending} isFailed={isFailed} />
        </div>
      </div>
    );
  }
  const fromClient = msg.is_client;
  return (
    <div className={`my-2 flex items-start gap-2.5 ${fromClient ? "" : "flex-row-reverse text-right"} ${isPending ? "opacity-60" : ""}`}>
      <Avatar name={msg.author_name || "Client"} tone={fromClient ? "client" : "admin"} />
      <div
        className={`max-w-[80%] rounded-xl px-3.5 py-2.5 ${
          isFailed
            ? "border border-rose-300 bg-rose-50"
            : fromClient
            ? "rounded-tl-sm border border-emerald-200 bg-white"
            : "rounded-tr-sm border border-emerald-200 bg-emerald-50"
        }`}
      >
        <div className={`mb-0.5 flex items-center gap-1.5 ${fromClient ? "" : "justify-end"}`}>
          <span className="text-[13px] font-semibold text-slate-800">{msg.author_name}</span>
          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
            <MessageCircle size={9} />
            WhatsApp
          </span>
        </div>
        <p className="whitespace-pre-wrap text-[14px] leading-snug text-slate-800">{msg.text}</p>
        <MsgStatus isPending={isPending} isFailed={isFailed} />
      </div>
    </div>
  );
}

function MsgStatus({ isPending, isFailed }) {
  if (isFailed) {
    return (
      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-600">
        <AlertCircle size={11} /> Failed to send — try again
      </p>
    );
  }
  if (isPending) {
    return (
      <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
        <Clock size={11} /> Sending…
      </p>
    );
  }
  return null;
}

// `staffToggleLabel` is "Staff" on the admin side, "Admin" on the staff
// side — same 2-toggle send rule either way: at least one must be active.
export default function TaskConversation({ task, staffToggleLabel, onBack, onProgressChange }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [toStaff, setToStaff] = useState(true);
  const [toClient, setToClient] = useState(false);
  const [text, setText] = useState("");
  const [progress, setProgress] = useState(task.progress);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    getMessages(task.id).then(setMessages).catch(() => {});
    const unsub = subscribeToMessages(task.id, (m) => {
      // Dedupe: if this exact row is already in state (e.g. it was just
      // reconciled from our own optimistic send), don't add it twice.
      setMessages((prev) => (prev.some((existing) => existing.id === m.id) ? prev : [...prev, m]));
    });
    return unsub;
  }, [task.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const canSend = text.trim().length > 0 && (toStaff || toClient) && !sending;

  async function handleSend() {
    if (!canSend) return;
    const messageText = text;
    setText("");
    setSending(true);

    // Show the message(s) immediately, marked "pending", instead of
    // waiting on the network round-trip + Realtime to display them.
    const now = new Date().toISOString();
    const tempEntries = [];
    if (toStaff) {
      tempEntries.push({ id: `temp-staff-${Date.now()}`, kind: "staff", author_name: user?.name, text: messageText, created_at: now, _status: "pending" });
    }
    if (toClient) {
      tempEntries.push({ id: `temp-client-${Date.now()}`, kind: "client", author_name: user?.name, is_client: false, text: messageText, created_at: now, _status: "pending" });
    }
    setMessages((prev) => [...prev, ...tempEntries]);

    try {
      const result = await sendMessage({ taskId: task.id, text: messageText, toStaff, toClient });
      const realRows = result?.messages || [];
      // Swap the temp/pending entries for the real DB rows (correct ids),
      // so the later Realtime event for the same rows gets deduped above
      // instead of appearing as a duplicate bubble.
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => !tempEntries.some((t) => t.id === m.id));
        const existingIds = new Set(withoutTemp.map((m) => m.id));
        const newRows = realRows.filter((r) => !existingIds.has(r.id));
        return [...withoutTemp, ...newRows];
      });
    } catch (e) {
      // Leave the pending bubbles in place, just mark them failed instead
      // of silently disappearing or popping an alert.
      setMessages((prev) => prev.map((m) => (tempEntries.some((t) => t.id === m.id) ? { ...m, _status: "failed" } : m)));
    } finally {
      setSending(false);
    }
  }

  async function handleProgressCommit(value) {
    setProgress(value);
    try {
      await updateTaskProgress(task.id, value);
      onProgressChange?.(task.id, value);
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleComplete() {
    try {
      await markTaskComplete(task.id);
      onProgressChange?.(task.id, 100, "Complete");
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 md:px-5">
        {onBack && (
          <button onClick={onBack} className="text-slate-400 hover:text-slate-600 md:hidden">
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold text-accent-text">
              {task.status}
            </span>
            {task.due_date && <span className="text-[11px] text-slate-400">Due {task.due_date}</span>}
          </div>
          <h2 className="truncate text-[15px] font-bold text-slate-900">{task.title}</h2>
          <p className="truncate text-[11.5px] text-slate-400">
            Client: {task.client_name} · Assigned to: {task.assignee?.name || "Unassigned"}
          </p>
        </div>
        <button
          onClick={handleComplete}
          className="hidden shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-emerald-700 sm:block"
        >
          Mark Complete
        </button>
      </div>

      {/* Task details — description/links/phone for manually created tasks */}
      {(task.description || task.links || task.client_phone) && (
        <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-[12px] text-slate-600 md:px-5">
          <div className="space-y-1">
            {task.client_phone && <p><span className="text-slate-400">Phone:</span> {task.client_phone}</p>}
            {task.description && <p><span className="text-slate-400">Description:</span> {task.description}</p>}
            {task.links && (
              <p>
                <span className="text-slate-400">Links:</span>{" "}
                {task.links.split("\n").filter(Boolean).map((link, i) => (
                  <a key={i} href={link.trim()} target="_blank" rel="noreferrer" className="mr-2 text-accent hover:underline">
                    {link.trim()}
                  </a>
                ))}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Progress slider */}
      <div className="border-b border-slate-100 px-4 py-3 md:px-5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Daily Progress</span>
          <span className="text-[13px] font-bold text-accent">{progress}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
          onMouseUp={(e) => handleProgressCommit(Number(e.target.value))}
          onTouchEnd={(e) => handleProgressCommit(Number(e.target.value))}
          className="w-full accent-current"
          style={{ accentColor: "var(--tw-accent, #4F46E5)" }}
        />
        <p className="mt-1 text-[10.5px] text-slate-400">Drag to update — client gets a WhatsApp update automatically.</p>
      </div>

      {/* Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 md:px-5">
        {messages.length === 0 ? (
          <p className="mt-10 text-center text-[12.5px] text-slate-400">No messages yet.</p>
        ) : (
          messages.map((m) => <Bubble key={m.id} msg={m} />)
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-slate-100 px-4 py-3 md:px-5">
        <div className="mb-2 flex gap-1.5">
          <button
            onClick={() => setToStaff((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition ${
              toStaff ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {toStaff && <Check size={12} />}
            <Users size={13} />
            {staffToggleLabel}
          </button>
          <button
            onClick={() => setToClient((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition ${
              toClient ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {toClient && <Check size={12} />}
            <MessageCircle size={13} />
            Message client
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Write a message..."
            rows={2}
            className="w-full resize-none bg-transparent text-[14px] text-slate-800 outline-none placeholder:text-slate-400"
          />
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">
              {!toStaff && !toClient
                ? "Select where this message should go."
                : toStaff && toClient
                ? "Posts internally and sends to the client on WhatsApp."
                : toStaff
                ? "Internal only — the client won't see this."
                : "Sends to the client on WhatsApp."}
            </span>
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={13} />
              Send
            </button>
          </div>
        </div>
        <button
          onClick={handleComplete}
          className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-2 text-[12.5px] font-medium text-white hover:bg-emerald-700 sm:hidden"
        >
          Mark Complete
        </button>
      </div>
    </div>
  );
}