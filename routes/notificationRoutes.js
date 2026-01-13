import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
} from "../controller/notificationController.js";

const router = express.Router();

// All routes require authentication
router.get("/", protect, getUserNotifications);
router.get("/unread-count", protect, getUnreadCount);
router.put("/:notificationId/read", protect, markAsRead);
router.put("/read-all", protect, markAllAsRead);
router.delete("/:notificationId", protect, deleteNotification);

export default router;

