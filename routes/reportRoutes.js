import express from "express";
import { reportConversation } from "../controller/reportController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Report conversation (requires user auth)
router.post("/", protect, reportConversation);

export default router;

