import express from "express";
import {
  submitVerification,
  getVerificationStatus,
  getVerificationRequests,
  approveVerification,
  rejectVerification,
} from "../controller/verificationController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Seller/Agent routes - require authentication
router.post("/submit", protect, submitVerification);
router.get("/status", protect, getVerificationStatus);

// Admin routes - require authentication and admin role
router.get("/requests", protect, admin, getVerificationRequests);
router.post("/approve/:userId", protect, admin, approveVerification);
router.post("/reject/:userId", protect, admin, rejectVerification);

export default router;

