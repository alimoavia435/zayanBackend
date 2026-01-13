import ChatReport from "../model/ChatReport.js";
import Conversation from "../model/Conversation.js";
import Message from "../model/Message.js";
import User from "../model/User.js";

// Report a conversation or message
export const reportConversation = async (req, res) => {
  try {
    const { conversationId, messageId, reason, description } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!conversationId || !reason) {
      return res.status(400).json({
        message: "conversationId and reason are required",
      });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Determine reported user (the other party in the conversation)
    const reportedUser =
      conversation.buyerId.toString() === userId.toString()
        ? conversation.sellerId
        : conversation.buyerId;

    // Check if message exists if messageId provided
    if (messageId) {
      const message = await Message.findOne({
        _id: messageId,
        conversationId: conversationId,
      });
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
    }

    const report = await ChatReport.create({
      conversationId,
      messageId: messageId || null,
      reportedBy: userId,
      reportedUser,
      reason,
      description: description || "",
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Report submitted successfully",
      report,
    });
  } catch (error) {
    console.error("reportConversation error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit report",
    });
  }
};

