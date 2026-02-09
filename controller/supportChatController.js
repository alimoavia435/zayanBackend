import Conversation from "../model/Conversation.js";
import Message from "../model/Message.js";
import User from "../model/User.js";
import Admin from "../model/Admin.js";
import { createNotification } from "./notificationController.js";

// Get or create support conversation for user
export const getSupportConversation = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Check if user has chat access
    const user = await User.findById(userId);
    if (user?.chatAccess === "suspended") {
      return res.status(403).json({
        message: "Your chat access has been suspended. Please contact support.",
      });
    }

    // Find existing support conversation
    let conversation = await Conversation.findOne({
      buyerId: userId,
      isSupportChat: true,
    })
      .populate("adminId", "email")
      .populate("buyerId", "name email avatar")
      .sort({ updatedAt: -1 });

    // If no conversation exists, create one
    if (!conversation) {
      // Assign to first available admin (or you can implement a round-robin system)
      const admin = await Admin.findOne({ role: { $in: ["superAdmin", "moderator", "support"] } });
      
      if (!admin) {
        return res.status(500).json({
          message: "No admin available for support chat",
        });
      }

      conversation = await Conversation.create({
        buyerId: userId,
        sellerId: userId, // Use same user as sellerId for support chats
        isSupportChat: true,
        adminId: admin._id,
        lastMessage: "",
        lastMessageSender: null,
      });

      conversation = await conversation.populate("adminId", "email");
      conversation = await conversation.populate("buyerId", "name email avatar");
    }

    // Get messages
    const messages = await Message.find({ conversationId: conversation._id })
      .populate("senderId", "name email avatar")
      .sort({ createdAt: 1 })
      .lean();

    // Mark admin messages
    const messagesWithAdminFlag = messages.map((msg) => ({
      ...msg,
      isAdmin: msg.isAdminMessage || false,
    }));

    return res.json({
      conversation: {
        id: conversation._id,
        buyerId: conversation.buyerId,
        adminId: conversation.adminId,
        isSupportChat: conversation.isSupportChat,
        lastMessage: conversation.lastMessage,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages: messagesWithAdminFlag.map((msg) => ({
        id: msg._id,
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        message: msg.message,
        type: msg.type,
        mediaUrl: msg.mediaUrl,
        fileName: msg.fileName,
        mimeType: msg.mimeType,
        isAdmin: msg.isAdmin,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      })),
    });
  } catch (error) {
    console.error("getSupportConversation error:", error);
    return res.status(500).json({ message: "Failed to get support conversation" });
  }
};

// Send message in support chat (user to admin)
export const sendSupportMessage = async (req, res) => {
  try {
    const { conversationId, message, mediaUrl, fileName, mimeType, type = "text" } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Check if user has chat access
    const user = await User.findById(userId);
    if (user?.chatAccess === "suspended") {
      return res.status(403).json({
        message: "Your chat access has been suspended. Please contact support.",
      });
    }

    if (!conversationId) {
      return res.status(400).json({ message: "conversationId is required" });
    }

    const trimmedMessage = message?.trim();

    if (!trimmedMessage && !mediaUrl) {
      return res.status(400).json({ message: "Message text or media is required" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!conversation.isSupportChat) {
      return res.status(400).json({ message: "This is not a support conversation" });
    }

    if (conversation.buyerId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You are not authorized for this conversation" });
    }

    // Update lastSeen
    await User.findByIdAndUpdate(userId, { lastSeen: new Date() });

    const payload = {
      conversationId,
      senderId: userId,
      message: trimmedMessage || "",
      type: mediaUrl && type === "text" ? "file" : type,
      mediaUrl,
      fileName,
      mimeType,
    };

    if (mediaUrl && mimeType?.startsWith("image/")) {
      payload.type = "image";
    }

    const newMessage = await Message.create(payload);

    conversation.lastMessage = trimmedMessage || (mediaUrl ? fileName || "Attachment" : "");
    conversation.lastMessageSender = userId;
    await conversation.save();

    // Notify admin via socket.io (admin notifications handled separately)
    // Admin will see new messages in their support chat interface

    return res.json({
      message: {
        id: newMessage._id,
        conversationId: newMessage.conversationId,
        senderId: newMessage.senderId,
        message: newMessage.message,
        type: newMessage.type,
        mediaUrl: newMessage.mediaUrl,
        fileName: newMessage.fileName,
        mimeType: newMessage.mimeType,
        createdAt: newMessage.createdAt,
        updatedAt: newMessage.updatedAt,
      },
    });
  } catch (error) {
    console.error("sendSupportMessage error:", error);
    return res.status(500).json({ message: "Failed to send message" });
  }
};

// Admin sends message in support chat
export const adminSendSupportMessage = async (req, res) => {
  try {
    const { conversationId, message, mediaUrl, fileName, mimeType, type = "text" } = req.body;
    const adminId = req.admin.id;

    if (!conversationId) {
      return res.status(400).json({ message: "conversationId is required" });
    }

    const trimmedMessage = message?.trim();

    if (!trimmedMessage && !mediaUrl) {
      return res.status(400).json({ message: "Message text or media is required" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!conversation.isSupportChat) {
      return res.status(400).json({ message: "This is not a support conversation" });
    }

    if (conversation.adminId.toString() !== adminId.toString()) {
      return res.status(403).json({ message: "You are not authorized for this conversation" });
    }

    // Use admin's user ID if available, or create a system sender
    // For now, we'll use the buyerId as a placeholder (admin messages will be identified by adminId)
    const payload = {
      conversationId,
      senderId: conversation.buyerId, // Placeholder - admin messages identified by isAdminMessage flag
      message: trimmedMessage || "",
      type: mediaUrl && type === "text" ? "file" : type,
      mediaUrl,
      fileName,
      mimeType,
      isAdminMessage: true, // Mark as admin message
    };

    if (mediaUrl && mimeType?.startsWith("image/")) {
      payload.type = "image";
    }

    const newMessage = await Message.create(payload);

    conversation.lastMessage = trimmedMessage || (mediaUrl ? fileName || "Attachment" : "");
    conversation.lastMessageSender = conversation.buyerId; // Placeholder
    await conversation.save();

    // Notify user
    try {
      await createNotification({
        userId: conversation.buyerId,
        type: "support_message",
        title: "Support Response",
        message: "You have a new message from support",
        actionUrl: `/messages/${conversationId}`,
      });
    } catch (notifError) {
      console.error("Failed to create notification:", notifError);
    }

    return res.json({
      message: {
        id: newMessage._id,
        conversationId: newMessage.conversationId,
        senderId: newMessage.senderId,
        isAdmin: newMessage.isAdminMessage || true,
        message: newMessage.message,
        type: newMessage.type,
        mediaUrl: newMessage.mediaUrl,
        fileName: newMessage.fileName,
        mimeType: newMessage.mimeType,
        createdAt: newMessage.createdAt,
        updatedAt: newMessage.updatedAt,
      },
    });
  } catch (error) {
    console.error("adminSendSupportMessage error:", error);
    return res.status(500).json({ message: "Failed to send message" });
  }
};

// Get all support conversations (admin)
export const getSupportConversations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const adminId = req.admin.id;

    const query = {
      isSupportChat: true,
      adminId: adminId, // Only show conversations assigned to this admin
    };

    const skip = (page - 1) * limit;

    const conversations = await Conversation.find(query)
      .populate("buyerId", "name email avatar")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Conversation.countDocuments(query);

    return res.json({
      success: true,
      conversations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getSupportConversations error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get support conversations",
    });
  }
};

