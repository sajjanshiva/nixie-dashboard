import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { sendWhatsAppMessage } from "../lib/whatsapp.js";

const router = Router();

// POST /api/messages/send
// Body: { taskId, text, toStaff, toClient }
// The 2-toggle composer rule lives here: at least one of toStaff/toClient
// must be true (also enforced on the frontend, but never trust the client).
router.post("/send", async (req, res) => {
  const { taskId, text, toStaff, toClient } = req.body;
  if (!taskId || !text?.trim() || (!toStaff && !toClient)) {
    return res.status(400).json({ message: "taskId, text, and at least one of toStaff/toClient are required" });
  }

  const { data: task, error: taskError } = await supabaseAdmin.from("tasks").select("*").eq("id", taskId).single();
  if (taskError || !task) return res.status(404).json({ message: "Task not found" });

  const isAdmin = req.user.role === "admin";
  const isAssignee = task.assignee_id === req.user.id;
  if (!isAdmin && !isAssignee) return res.status(403).json({ message: "You don't have access to this task" });

  const inserts = [];
  if (toStaff) {
    inserts.push({ task_id: taskId, kind: "staff", author_id: req.user.id, author_name: req.user.name, text });
  }
  if (toClient) {
    inserts.push({ task_id: taskId, kind: "client", author_id: req.user.id, author_name: req.user.name, is_client: false, text });
  }

  const { error: insertError } = await supabaseAdmin.from("messages").insert(inserts);
  if (insertError) return res.status(500).json({ message: insertError.message });

  if (toClient) {
    try {
      await sendWhatsAppMessage(task.client_phone, text);
    } catch (e) {
      console.error("WhatsApp send failed:", e.message);
      // Message is already saved in the thread — don't fail the whole
      // request just because the WhatsApp API call failed.
    }
  }

  res.json({ ok: true });
});

export default router;
