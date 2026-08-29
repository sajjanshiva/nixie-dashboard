import "dotenv/config";
import express from "express";
import cors from "cors";

import { requireAuth } from "./middleware/auth.js";
import messagesRoute from "./routes/messages.js";
import tasksRoute from "./routes/tasks.js";
import attendanceRoute from "./routes/attendance.js";
import teamRoute from "./routes/team.js";
import imagekitAuthRoute from "./routes/imagekitAuth.js";
import shopifyWebhooks from "./routes/webhooksShopify.js";
import whatsappWebhooks from "./routes/webhooksWhatsapp.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));

// Shopify + WhatsApp webhooks need the RAW request body (for signature
// verification), so both are mounted BEFORE express.json() and only
// apply to their own paths.
app.use("/webhooks/shopify", express.raw({ type: "application/json" }), shopifyWebhooks);
app.use("/webhooks/whatsapp", express.raw({ type: "application/json" }), whatsappWebhooks);

// Everything else uses normal JSON parsing.
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

// All routes below require a valid Supabase session.
app.use("/api/messages", requireAuth, messagesRoute);
app.use("/api/tasks", requireAuth, tasksRoute);
app.use("/api/attendance", requireAuth, attendanceRoute);
app.use("/api/team", requireAuth, teamRoute);
app.use("/api/imagekit-auth", requireAuth, imagekitAuthRoute);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Teamflow server running on http://localhost:${port}`));