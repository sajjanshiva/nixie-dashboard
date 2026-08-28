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
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!hmacHeader || !secret) return false;
  const digest = crypto.createHmac("sha256", secret).update(req.body).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    // timingSafeEqual throws if the two buffers differ in length — that's
    // just an invalid signature, not a crash-worthy error.
    return false;
  }
}

// Line-item custom properties come back from Shopify as an array of
// { name, value } pairs (this is what "customAttributes" on the GraphQL
// draftOrderCreate mutation becomes in the REST webhook payload). This
// turns that array into a plain lookup object, and separately collects
// every "Secondary Fabric N" entry into a list since there can be any
// number of them (including zero).
function parseLineItemProperties(properties = []) {
  const map = {};
  const secondaryFabrics = [];
  for (const prop of properties) {
    if (/^secondary fabric/i.test(prop.name)) {
      if (prop.value) secondaryFabrics.push(prop.value);
    } else {
      map[prop.name] = prop.value;
    }
  }
  return { map, secondaryFabrics };
}

// POST /webhooks/shopify/orders-paid
// Fires only once an order's payment actually goes through (financial_status
// becomes "paid") — this is deliberately "Order payment" (orders/paid), not
// "Order creation" (orders/create), since an order can be created before
// it's actually paid (COD, manual payment, etc.) and only paid orders
// should count as real sales here.
router.post("/orders-paid", async (req, res) => {
  if (!verifyShopifyHmac(req)) return res.status(401).send("Invalid signature");

  const order = JSON.parse(req.body.toString("utf8"));

  // Defensive check even though this topic should only fire on payment.
  if (order.financial_status !== "paid") {
    return res.status(200).send("ignored (not paid)");
  }

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
    text: "Order imported from Shopify (payment confirmed)",
  });

  res.status(200).send("ok");
});

// POST /webhooks/shopify/draft-orders-create
// Draft orders from the AI outfit analyzer + "Contact Me" form on the
// Nixie site → become Shopify Inbox leads. The analyzer backend stores
// everything (outfit details AND the customer's contact info) as custom
// line-item properties on a single line item — there is no real Shopify
// customer or shipping address on these draft orders — so every field
// below is read out of that one line item's `properties` array.
router.post("/draft-orders-create", async (req, res) => {
  if (!verifyShopifyHmac(req)) return res.status(401).send("Invalid signature");

  const draft = JSON.parse(req.body.toString("utf8"));
  const lineItem = draft.line_items?.[0] || {};
  const { map, secondaryFabrics } = parseLineItemProperties(lineItem.properties);

  const { error } = await supabaseAdmin.from("shopify_leads").insert({
    lead_number: draft.name,
    name: map["Name"] || null,
    phone: map["Phone"] || null,
    email: map["Email"] || null,
    address: map["Address"] || null,
    city: map["City"] || null,
    state: map["State"] || null,
    pincode: map["Pincode"] || null,
    outfit_type: map["Outfit Type"] || lineItem.title || null,
    primary_fabric: map["Primary Fabric"] || null,
    secondary_fabrics: secondaryFabrics,
    price_estimate: lineItem.price || draft.total_price || null,
    image_url: map["Main Outfit Image"] || null,
    status: "unassigned",
  });

  if (error) {
    console.error("Failed to save Shopify lead:", error.message);
    return res.status(500).send("DB error");
  }

  res.status(200).send("ok");
});

export default router;