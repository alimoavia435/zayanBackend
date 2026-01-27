import express from "express";
import { handleWebhook } from "../controller/paymentController.js";

const router = express.Router();

// Stripe webhook endpoint
// This will be mounted at /api/webhooks, so this route becomes /api/webhooks/stripe
router.post("/stripe", handleWebhook);

export default router;
