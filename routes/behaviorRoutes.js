import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  trackBehavior,
  getRecentlyViewed,
  getUserBehaviorInsights,
} from "../controller/behaviorController.js";

const router = express.Router();

// Track user behavior (protected - user must be logged in)
router.post("/track", protect, trackBehavior);

// Get recently viewed items (protected)
router.get("/recently-viewed", protect, getRecentlyViewed);

// Get user behavior insights (protected)
router.get("/insights", protect, getUserBehaviorInsights);

export default router;

