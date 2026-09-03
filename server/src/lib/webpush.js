import webpush from "web-push";
import { supabaseAdmin } from "./supabaseAdmin.js";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Sends a push to every device this user has subscribed on (laptop,
// mobile, etc. — one row per device in push_subscriptions). If a
// subscription has gone stale (browser data cleared, permission revoked,
// device uninstalled), the push service returns 404/410 — we clean those
// rows up so we don't keep retrying them forever.
export async function sendPush(userId, { text, link }) {
  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to load push subscriptions:", error.message);
    return;
  }

  const payload = JSON.stringify({
    title: "Nixie Teamflow",
    body: text,
    link: link || "/",
  });

  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(sub.subscription, payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.error("Push send failed:", err.message);
      }
    }
  }
}