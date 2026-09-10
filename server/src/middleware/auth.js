import { supabaseAdmin } from "../lib/supabaseAdmin.js";

// Verifies the Supabase-issued JWT sent from the client (Authorization:
// Bearer <token>), then loads that user's profile (name, role) from the
// database. Every protected route relies on req.user being set correctly
// here — this is the actual security boundary, not anything in the UI.
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Missing auth token" });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ message: "Invalid or expired session" });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();
  if (profileError || !profile) return res.status(401).json({ message: "No profile found for this user" });

  // First-ever authenticated request for this person — stamp it. Used by
  // Performance to know when tracking should actually start for them,
  // instead of when their account row happened to be created (which
  // could be days/weeks before they actually started using the app).
  if (!profile.activated_at) {
    const now = new Date().toISOString();
    await supabaseAdmin.from("profiles").update({ activated_at: now }).eq("id", profile.id);
    profile.activated_at = now;
  }

  req.user = profile; // { id, name, email, role, activated_at }
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) return res.status(403).json({ message: `Requires ${role} role` });
    next();
  };
}