import express from "express";
import {
  getReviews,
  getReviewStats,
  deleteReview,
  getReviewDetails,
} from "../controller/adminReviewController.js";
import { protectAdmin } from "../middleware/adminAuthMiddleware.js";

const router = express.Router();

// All routes require admin authentication
router.get("/", protectAdmin, getReviews);
router.get("/stats", protectAdmin, getReviewStats);
router.get("/:reviewId", protectAdmin, getReviewDetails);
router.delete("/:reviewId", protectAdmin, deleteReview);

export default router;

