import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createSellerReview,
  getSellerReviews,
  addSellerResponse,
} from "../controller/reviewController.js";

const router = express.Router();

// Seller/Agent review routes
router.post("/seller/:sellerId", protect, createSellerReview);
router.get("/seller/:sellerId", protect, getSellerReviews);
router.post("/:reviewId/response", protect, addSellerResponse);

export default router;

