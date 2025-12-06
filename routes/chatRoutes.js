import express from "express";
import {
  startConversation,
  getUserConversations,
  getConversationMessages,
  sendMessage,
  updateLastSeen,
} from "../controller/chatController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/start", protect, startConversation);
router.get("/conversations", protect, getUserConversations);
router.get("/:conversationId/messages", protect, getConversationMessages);
router.post("/message", protect, sendMessage);
router.post("/last-seen", protect, updateLastSeen);

export default router;


