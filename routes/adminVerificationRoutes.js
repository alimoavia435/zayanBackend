import express from "express";
import {
  getVerificationRequests,
  getVerificationDetails,
  approveVerification,
  rejectVerification,
} from "../controller/adminVerificationController.js";
import { protectAdmin } from "../middleware/adminAuthMiddleware.js";

const router = express.Router();

// All routes require admin authentication
router.get("/requests", protectAdmin, getVerificationRequests);
router.get("/:userId", protectAdmin, getVerificationDetails);
router.post("/approve/:userId", protectAdmin, approveVerification);
router.post("/reject/:userId", protectAdmin, rejectVerification);

export default router;

