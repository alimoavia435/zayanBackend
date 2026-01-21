import Conversation from "../model/Conversation.js";
import Message from "../model/Message.js";
import ChatReport from "../model/ChatReport.js";
import MessageFlag from "../model/MessageFlag.js";
import User from "../model/User.js";
import AdminActionLog from "../model/AdminActionLog.js";

// Get all reported conversations
export const getReportedConversations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status; // pending, reviewed, resolved, dismissed

    const query = {};

    if (status && ["pending", "reviewed", "resolved", "dismissed"].includes(status)) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const reports = await ChatReport.find(query)
      .populate("conversationId")
      .populate("reportedBy", "name email")
      .populate("reportedUser", "name email")
      .populate("reviewedBy", "email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await ChatReport.countDocuments(query);

    return res.json({
      success: true,
      reports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getReportedConversations error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get reported conversations",
    });
  }
};

// Get conversation details with messages (read-only for admin)
export const getConversationDetails = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId)
      .populate("buyerId", "name email avatar")
      .populate("sellerId", "name email avatar")
      .populate("propertyId", "title images price")
      .populate("productId", "name images price")
      .populate("adminId", "email")
      .lean();

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const messages = await Message.find({ conversationId })
      .populate("senderId", "name email avatar")
      .sort({ createdAt: 1 })
      .lean();

    // Get flags for messages
    const messageIds = messages.map((m) => m._id);
    const flags = await MessageFlag.find({ messageId: { $in: messageIds } })
      .populate("flaggedBy", "email")
      .lean();

    const flagsMap = {};
    flags.forEach((flag) => {
      if (!flagsMap[flag.messageId]) {
        flagsMap[flag.messageId] = [];
      }
      flagsMap[flag.messageId].push(flag);
    });

    // Attach flags to messages and mark admin messages
    const messagesWithFlags = messages.map((msg) => ({
      ...msg,
      flags: flagsMap[msg._id] || [],
      isAdminMessage: msg.isAdminMessage || false,
    }));

    return res.json({
      success: true,
      conversation,
      messages: messagesWithFlags,
    });
  } catch (error) {
    console.error("getConversationDetails error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get conversation details",
    });
  }
};

// Flag a message
export const flagMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reason, severity, notes } = req.body;
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Reason is required",
      });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    const flag = await MessageFlag.create({
      messageId,
      flaggedBy: adminId,
      reason,
      severity: severity || "medium",
      notes: notes || "",
    });

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: "content_removed",
        targetType: "system",
        targetId: messageId,
        details: {
          messageId: messageId.toString(),
          reason,
          severity: severity || "medium",
        },
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
    }

    return res.json({
      success: true,
      message: "Message flagged successfully",
      flag,
    });
  } catch (error) {
    console.error("flagMessage error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to flag message",
    });
  }
};

// Warn a user
export const warnUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { warning, reason } = req.body;
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    if (!warning || !reason) {
      return res.status(400).json({
        success: false,
        message: "Warning and reason are required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Add warning to user
    if (!user.chatWarnings) {
      user.chatWarnings = [];
    }
    user.chatWarnings.push({
      warning,
      reason,
      warnedBy: adminId,
      warnedAt: new Date(),
    });

    await user.save();

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: "user_updated",
        targetType: "user",
        targetId: userId,
        details: {
          userId: userId.toString(),
          action: "chat_warning",
          warning,
          reason,
        },
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
    }

    return res.json({
      success: true,
      message: "User warned successfully",
      user: {
        _id: user._id,
        email: user.email,
        chatWarnings: user.chatWarnings,
      },
    });
  } catch (error) {
    console.error("warnUser error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to warn user",
    });
  }
};

// Suspend user chat access
export const suspendChatAccess = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Reason is required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.chatAccess = "suspended";
    user.chatSuspendedAt = new Date();
    user.chatSuspensionReason = reason;

    await user.save();

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: "user_suspended",
        targetType: "user",
        targetId: userId,
        details: {
          userId: userId.toString(),
          action: "chat_suspended",
          reason,
        },
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
    }

    return res.json({
      success: true,
      message: "User chat access suspended successfully",
      user: {
        _id: user._id,
        email: user.email,
        chatAccess: user.chatAccess,
      },
    });
  } catch (error) {
    console.error("suspendChatAccess error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to suspend chat access",
    });
  }
};

// Restore user chat access
export const restoreChatAccess = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.chatAccess = "active";
    user.chatSuspendedAt = null;
    user.chatSuspensionReason = null;

    await user.save();

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: "user_reactivated",
        targetType: "user",
        targetId: userId,
        details: {
          userId: userId.toString(),
          action: "chat_restored",
        },
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
    }

    return res.json({
      success: true,
      message: "User chat access restored successfully",
      user: {
        _id: user._id,
        email: user.email,
        chatAccess: user.chatAccess,
      },
    });
  } catch (error) {
    console.error("restoreChatAccess error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to restore chat access",
    });
  }
};

// Update report status
export const updateReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, adminNotes } = req.body;
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    if (!status || !["pending", "reviewed", "resolved", "dismissed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status is required",
      });
    }

    const report = await ChatReport.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    report.status = status;
    report.reviewedBy = adminId;
    report.reviewedAt = new Date();
    if (adminNotes) {
      report.adminNotes = adminNotes;
    }

    await report.save();

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: "content_approved",
        targetType: "system",
        targetId: reportId,
        details: {
          reportId: reportId.toString(),
          status,
        },
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
    }

    return res.json({
      success: true,
      message: "Report status updated successfully",
      report,
    });
  } catch (error) {
    console.error("updateReportStatus error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update report status",
    });
  }
};

