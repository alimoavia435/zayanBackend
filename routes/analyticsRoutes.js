import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  trackEvent,
  getAnalyticsOverview,
  getTimeSeriesData,
  getTopItems,
  getResponseTimeTrends,
} from "../controller/analyticsController.js";

const router = express.Router();

// Track event (public or protected based on requirements - using protected for now)
router.post("/events/track", protect, trackEvent);

// Analytics endpoints (protected - sellers/agents only)
router.get("/overview", protect, getAnalyticsOverview);
router.get("/time-series", protect, getTimeSeriesData);
router.get("/top-items", protect, getTopItems);
router.get("/response-time-trends", protect, getResponseTimeTrends);

export default router;

