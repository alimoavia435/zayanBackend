import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getSellerProfile,
  getSellerProfileById,
  updateSellerProfile,
  getTopSellers,
} from "../controller/profileController.js";

const router = express.Router();

router
  .route("/")
  .get(protect, getSellerProfile)
  .put(protect, updateSellerProfile);

// Get top sellers - Public access (for landing page)
router.get("/top-sellers", getTopSellers);

// Get seller profile by ID (for buyers to view seller profiles)
router.get("/:id", protect, getSellerProfileById);

export default router;


