import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getTrending,
  getPersonalizedRecommendations,
  getSimilar,
} from "../controller/recommendationController.js";

const router = express.Router();

// Get trending items (public)
router.get("/trending", getTrending);

// Get personalized recommendations (protected)
router.get("/recommendations", protect, getPersonalizedRecommendations);

// Get similar items (public)
router.get("/similar", getSimilar);

export default router;

