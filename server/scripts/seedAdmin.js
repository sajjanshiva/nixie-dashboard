import "dotenv/config";
import { supabaseAdmin } from "../src/lib/supabaseAdmin.js";

// Idempotent: safe to run this multiple times (e.g. on every server boot)
// — it only creates the admin account if one doesn't already exist for
// that email.
async function seedAdmin() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed.");
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", ADMIN_EMAIL)
    .maybeSingle();

  if (existing) {
    console.log(`Admin ${ADMIN_EMAIL} already exists — skipping.`);
    return;
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  });
  if (createError) {
    console.error("Failed to create admin auth user:", createError.message);
    process.exit(1);
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: created.user.id,
    name: ADMIN_NAME || "Admin",
    email: ADMIN_EMAIL,
    role: "admin",
  });
  if (profileError) {
    console.error("Failed to create admin profile row:", profileError.message);
    process.exit(1);
  }

  console.log(`Admin account created: ${ADMIN_EMAIL}`);
}

seedAdmin();
