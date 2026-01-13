import express from "express";
import { getDashboardStats } from "../controller/adminDashboardController.js";
import { protectAdmin } from "../middleware/adminAuthMiddleware.js";

const router = express.Router();

// All routes require admin authentication
router.get("/stats", protectAdmin, getDashboardStats);

export default router;

