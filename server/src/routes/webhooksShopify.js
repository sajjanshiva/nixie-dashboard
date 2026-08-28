import { Router } from "express";
import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const router = Router();

// Shopify webhooks send the raw JSON body and an HMAC signature computed
// over those exact bytes — so this router uses express.raw() (mounted in
// index.js) instead of the app-wide express.json(), and verifies the
// signature BEFORE trusting anything in the payload.
function verifyShopifyHmac(req) {
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
  if (!hmacHeader) return false;
  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(req.body) // raw Buffer
    .digest("base64");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
}

// POST /webhooks/shopify/orders-create
// A real, paid order → becomes a Teamflow task (source: shopify_order).
router.post("/orders-create", async (req, res) => {
  if (!verifyShopifyHmac(req)) return res.status(401).send("Invalid signature");

  const order = JSON.parse(req.body.toString("utf8"));
  const items = (order.line_items || []).map((li) => `${li.quantity}x ${li.title}`).join(", ");

  const { data: task, error } = await supabaseAdmin
    .from("tasks")
    .insert({
      title: `Shopify Order ${order.name} — ${order.customer?.first_name || "Customer"}`,
      client_name: [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ") || order.email,
      client_phone: order.customer?.phone || order.shipping_address?.phone || null,
      status: "In Progress",
      source: "shopify_order",
      shopify_order_id: String(order.id),
      shopify_order_number: order.name,
      shopify_items: items,
      shopify_price: `${order.currency} ${order.total_price}`,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to save Shopify order:", error.message);
    return res.status(500).send("DB error");
  }

  await supabaseAdmin.from("messages").insert({
    task_id: task.id,
    kind: "system",
    text: "Order imported from Shopify",
  });

  res.status(200).send("ok");
});

// POST /webhooks/shopify/draft-orders-create
// Draft orders from the AI price analyzer + "Contact Me" form on the
// Nixie site → become Shopify Inbox leads, not tasks (informational until
// they convert into a real order).
//
// NOTE: adjust the field paths below (note_attributes, line_items, etc.)
// to match exactly how the price analyzer / contact form actually writes
// data into the draft order — this is a best-effort mapping since the
// analyzer's payload shape wasn't fully specified.
router.post("/draft-orders-create", async (req, res) => {
  if (!verifyShopifyHmac(req)) return res.status(401).send("Invalid signature");

  const draft = JSON.parse(req.body.toString("utf8"));
  const attr = (name) => draft.note_attributes?.find((a) => a.name === name)?.value;

  const { error } = await supabaseAdmin.from("shopify_leads").insert({
    lead_number: draft.name,
    name: [draft.customer?.first_name, draft.customer?.last_name].filter(Boolean).join(" ") || attr("name"),
    phone: draft.customer?.phone || attr("phone"),
    outfit_type: attr("outfit_type") || draft.line_items?.[0]?.title,
    price_estimate: attr("price_estimate") || draft.total_price,
    image_url: attr("image_url"),
    message: attr("message") || draft.note,
    status: "unassigned",
  });

  if (error) {
    console.error("Failed to save Shopify lead:", error.message);
    return res.status(500).send("DB error");
  }

  res.status(200).send("ok");
});

export default router;
