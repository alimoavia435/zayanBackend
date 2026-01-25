import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  generateProductDesc,
  generatePropertyDesc,
  suggestPrice,
  chatAssistant,
  checkAiAvailability,
  generateProfileBio,
} from "../controller/aiController.js";

const router = express.Router();

// Check AI availability (public endpoint)
router.get("/availability", checkAiAvailability);

// Generate product description (protected - sellers only)
router.post("/product/description", protect, generateProductDesc);

// Generate property description (protected - agents only)
router.post("/property/description", protect, generatePropertyDesc);

// Generate profile bio (protected - sellers/agents only)
router.post("/profile/bio", protect, generateProfileBio);

// Suggest pricing (protected - sellers/agents only)
router.post("/pricing/suggest", protect, suggestPrice);

// Chat assistant (public - buyers can use without login, but can be protected if needed)
router.post("/chat", chatAssistant);

export default router;
