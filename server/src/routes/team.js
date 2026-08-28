import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { requireRole } from "../middleware/auth.js";

const router = Router();

// POST /api/team/add-member  (admin only)
// Body: { name, email, password, role }
// Creating a user with a password requires the Supabase Admin API
// (service-role key) — that's why this can't happen directly from the
// frontend.
router.post("/add-member", requireRole("admin"), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "name, email, password, and role are required" });
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) return res.status(400).json({ message: createError.message });

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: created.user.id,
    name,
    email,
    role,
  });
  if (profileError) return res.status(500).json({ message: profileError.message });

  res.json({ ok: true, userId: created.user.id });
});

export default router;
