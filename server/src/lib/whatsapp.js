// Thin wrapper around the WhatsApp Business Cloud API (Meta).
// Swap this file's internals for Twilio/Gupshup if you use a different
// provider — everything that calls sendWhatsAppMessage() stays the same.
const VERSION = process.env.WHATSAPP_API_VERSION || "v19.0";

export async function sendWhatsAppMessage(toPhone, text) {
  if (!toPhone) {
    console.warn("sendWhatsAppMessage: no phone number on this task, skipping send.");
    return { skipped: true };
  }
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    console.warn("WhatsApp credentials not configured — message not sent:", text);
    return { skipped: true };
  }

  const res = await fetch(`https://graph.facebook.com/${VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toPhone.replace(/[^\d+]/g, ""),
      type: "text",
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp send failed: ${err}`);
  }
  return res.json();
}
