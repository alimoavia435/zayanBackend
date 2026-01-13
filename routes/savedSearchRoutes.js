import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  saveSearch,
  getSavedSearches,
  updateSavedSearch,
  deleteSavedSearch,
  triggerSavedSearchCheck,
} from "../controller/savedSearchController.js";

const router = express.Router();

// All routes require authentication
router.post("/", protect, saveSearch);
router.get("/", protect, getSavedSearches);
router.put("/:searchId", protect, updateSavedSearch);
router.delete("/:searchId", protect, deleteSavedSearch);
router.post("/:searchId/check", protect, triggerSavedSearchCheck);

export default router;

