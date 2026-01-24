import express from "express";
import {
  getPlans,
  subscribe,
  getMySubscription,
  cancelSubscription,
  featureListing,
  boostListing,
} from "../controller/subscriptionController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get available plans
router.get("/plans", protect, getPlans);

// Subscribe to a plan
router.post("/subscribe", protect, subscribe);

// Get current subscription
router.get("/my-subscription", protect, getMySubscription);

// Cancel subscription
router.post("/cancel", protect, cancelSubscription);

// Feature a listing
router.post("/feature-listing", protect, featureListing);

// Boost a listing
router.post("/boost-listing", protect, boostListing);

export default router;

