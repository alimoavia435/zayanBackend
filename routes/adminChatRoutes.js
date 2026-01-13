import express from "express";
import {
  getReportedConversations,
  getConversationDetails,
  flagMessage,
  warnUser,
  suspendChatAccess,
  restoreChatAccess,
  updateReportStatus,
} from "../controller/adminChatController.js";
import {
  getSupportConversations,
  adminSendSupportMessage,
} from "../controller/supportChatController.js";
import { protectAdmin } from "../middleware/adminAuthMiddleware.js";

const router = express.Router();

// All routes require admin authentication
router.get("/reports", protectAdmin, getReportedConversations);
router.get("/conversations/:conversationId", protectAdmin, getConversationDetails);
router.post("/messages/:messageId/flag", protectAdmin, flagMessage);
router.post("/users/:userId/warn", protectAdmin, warnUser);
router.post("/users/:userId/suspend-chat", protectAdmin, suspendChatAccess);
router.post("/users/:userId/restore-chat", protectAdmin, restoreChatAccess);
router.put("/reports/:reportId/status", protectAdmin, updateReportStatus);

// Support chat routes (admin)
router.get("/support", protectAdmin, getSupportConversations);
router.post("/support/:conversationId/message", protectAdmin, adminSendSupportMessage);

export default router;

