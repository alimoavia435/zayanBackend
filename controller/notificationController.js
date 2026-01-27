import Notification from "../model/Notification.js";
import User from "../model/User.js";
import { sendNotificationEmail } from "../utils/notificationEmailTemplates.js";

// Create a notification (internal use - called by other controllers)
export const createNotification = async ({
  userId,
  type,
  title,
  message,
  actionUrl = null,
  metadata = {},
  relatedId = null,
  relatedType = null,
  sendEmail = true,
  io = null, // Socket.io instance
}) => {
  try {
    console.log("checking notification controller");
    // Create notification
    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      actionUrl,
      metadata,
      relatedId,
      relatedType,
    });

    // Get user for email
    const user = await User.findById(userId).select("name email");
    if (!user) {
      return notification;
    }
    console.log("user found sending notification");
    // Send real-time notification via Socket.io
    if (io) {
      io.to(userId.toString()).emit("new_notification", {
        notification: {
          _id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          read: notification.read,
          actionUrl: notification.actionUrl,
          createdAt: notification.createdAt,
        },
      });
    }
    console.log("notification sent successfully");
    // Send email notification (fallback)
    // if (sendEmail && user.email) {
    //   try {
    //     const emailSent = await sendNotificationEmail({
    //       to: user.email,
    //       name: user.name || "User",
    //       notification: {
    //         type: notification.type,
    //         title: notification.title,
    //         message: notification.message,
    //         actionUrl: actionUrl
    //           ? `${process.env.CLIENT_URL || "http://localhost:3000"}${actionUrl}`
    //           : null,
    //       },
    //     });

    //     if (emailSent) {
    //       notification.emailSent = true;
    //       notification.emailSentAt = new Date();
    //       await notification.save();
    //     }
    //   } catch (emailError) {
    //     console.error("Failed to send notification email:", emailError);
    //     // Don't fail the notification creation if email fails
    //   }
    // }

    return notification;
  } catch (error) {
    console.error("createNotification error", error);
    throw error;
  }
};

// Get user notifications
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 50, skip = 0, read = null } = req.query;

    const filter = { userId };
    if (read !== null) {
      filter.read = read === "true";
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const unreadCount = await Notification.countDocuments({
      userId,
      read: false,
    });

    return res.status(200).json({
      message: "Notifications retrieved successfully",
      notifications,
      unreadCount,
      total: notifications.length,
    });
  } catch (error) {
    console.error("getUserNotifications error", error);
    return res
      .status(500)
      .json({ message: "Failed to retrieve notifications" });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { notificationId } = req.params;

    const notification = await Notification.findOne({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    return res.status(200).json({
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("markAsRead error", error);
    return res
      .status(500)
      .json({ message: "Failed to mark notification as read" });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await Notification.updateMany(
      { userId, read: false },
      {
        $set: {
          read: true,
          readAt: new Date(),
        },
      },
    );

    return res.status(200).json({
      message: "All notifications marked as read",
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("markAllAsRead error", error);
    return res
      .status(500)
      .json({ message: "Failed to mark all notifications as read" });
  }
};

// Delete notification
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user._id;
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.status(200).json({
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("deleteNotification error", error);
    return res.status(500).json({ message: "Failed to delete notification" });
  }
};

// Get unread count
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const unreadCount = await Notification.countDocuments({
      userId,
      read: false,
    });

    return res.status(200).json({
      message: "Unread count retrieved successfully",
      unreadCount,
    });
  } catch (error) {
    console.error("getUnreadCount error", error);
    return res.status(500).json({ message: "Failed to retrieve unread count" });
  }
};
