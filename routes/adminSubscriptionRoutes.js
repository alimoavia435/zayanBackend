import express from "express";
import {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getUserSubscriptions,
  getSubscriptionAnalytics,
  updateUserSubscription,
} from "../controller/adminSubscriptionController.js";
import { protectAdmin, checkPermission } from "../middleware/adminAuthMiddleware.js";

const router = express.Router();

// All routes require admin authentication and system_settings permission
router.use(protectAdmin);
router.use(checkPermission("system_settings"));

// Plan management
router.get("/plans", getPlans);
router.post("/plans", createPlan);
router.put("/plans/:id", updatePlan);
router.delete("/plans/:id", deletePlan);

// User subscriptions
router.get("/users", getUserSubscriptions);
router.put("/users/:id", updateUserSubscription);

// Analytics
router.get("/analytics", getSubscriptionAnalytics);

export default router;

