import express from "express";
import { createPaymentIntent, handleWebhook } from "../controller/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Webhook endpoint
router.post("/webhook", handleWebhook);

// Create payment intent (protected route)
router.post("/create-intent", protect, createPaymentIntent);

export default router;

