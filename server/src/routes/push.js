import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const router = Router();

// POST /api/push/subscribe
// Called by the client right after the browser grants permission and
// creates a push subscription. Mounted with requireAuth in index.js, so
// req.user is already the logged-in profile.
router.post("/subscribe", async (req, res) => {
  const { subscription } = req.body || {};
  if (!subscription) return res.status(400).json({ message: "Missing subscription" });

  const { error } = await supabaseAdmin.from("push_subscriptions").insert({
    user_id: req.user.id,
    subscription,
  });
  if (error) return res.status(500).json({ message: error.message });

  res.json({ ok: true });
});

// POST /api/push/unsubscribe
// Removes this device's subscription (e.g. user turns notifications off).
router.post("/unsubscribe", async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ message: "Missing endpoint" });

  const { error } = await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", req.user.id)
    .eq("subscription->>endpoint", endpoint);
  if (error) return res.status(500).json({ message: error.message });

  res.json({ ok: true });
});

export default router;