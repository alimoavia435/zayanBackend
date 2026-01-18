import express from "express";
import {
  getPlatformAnalytics,
  getGrowthTrends,
  getActivityMetrics,
} from "../controller/adminAnalyticsController.js";
import { protectAdmin } from "../middleware/adminAuthMiddleware.js";

const router = express.Router();

// All routes require admin authentication
router.get("/overview", protectAdmin, getPlatformAnalytics);
router.get("/trends", protectAdmin, getGrowthTrends);
router.get("/activity", protectAdmin, getActivityMetrics);

export default router;

