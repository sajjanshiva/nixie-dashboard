import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { sendWhatsAppMessage } from "../lib/whatsapp.js";

const router = Router();

// POST /api/tasks/progress
// Body: { taskId, progress }
// Routed through the backend (rather than a direct Supabase update) so the
// "client gets a WhatsApp update automatically" behavior fires from one
// single place, instead of being duplicated across every place progress
// might get changed.
router.post("/progress", async (req, res) => {
  const { taskId, progress } = req.body;
  if (!taskId || progress == null) return res.status(400).json({ message: "taskId and progress are required" });

  const { data: task, error: taskError } = await supabaseAdmin.from("tasks").select("*").eq("id", taskId).single();
  if (taskError || !task) return res.status(404).json({ message: "Task not found" });

  const isAdmin = req.user.role === "admin";
  const isAssignee = task.assignee_id === req.user.id;
  if (!isAdmin && !isAssignee) return res.status(403).json({ message: "You don't have access to this task" });

  const { error: updateError } = await supabaseAdmin
    .from("tasks")
    .update({ progress, updated_at: new Date().toISOString() })
    .eq("id", taskId);
  if (updateError) return res.status(500).json({ message: updateError.message });

  await supabaseAdmin.from("messages").insert({
    task_id: taskId,
    kind: "system",
    text: `Progress updated to ${progress}%`,
  });

  const clientText = `📊 Progress update: your task '${task.title}' is now ${progress}% complete.`;
  try {
    await sendWhatsAppMessage(task.client_phone, clientText);
    await supabaseAdmin.from("messages").insert({
      task_id: taskId,
      kind: "client",
      author_id: req.user.id,
      author_name: req.user.name,
      is_client: false,
      text: clientText,
    });
  } catch (e) {
    console.error("WhatsApp progress update failed:", e.message);
  }

  res.json({ ok: true, progress });
});

export default router;
