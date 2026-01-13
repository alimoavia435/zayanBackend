import mongoose from "mongoose";
import Conversation from "../model/Conversation.js";
import Message from "../model/Message.js";
import User from "../model/User.js";
import { createNotification } from "./notificationController.js";

const conversationPopulateConfig = [
  {
    path: "buyerId",
    select: "name firstName lastName avatar profiles lastSeen",
  },
  {
    path: "sellerId",
    select: "name firstName lastName avatar profiles lastSeen",
  },
  {
    path: "propertyId",
    select: "title images price city state location",
  },
  {
    path: "productId",
    select: "name images price currency unit store",
    populate: {
      path: "store",
      select: "name location",
    },
  },
];

const getProfile = (userDoc, primaryRole, fallbackRole) => {
  if (!userDoc?.profiles) return null;
  const profiles = userDoc.profiles;
  if (typeof profiles.get === "function") {
    return profiles.get(primaryRole) || profiles.get(fallbackRole) || null;
  }
  return profiles[primaryRole] || profiles[fallbackRole] || null;
};

const normalizeUser = (userDoc, profile) => {
  if (!userDoc && !profile) return null;
  const userObject = userDoc?.toObject?.() ?? userDoc ?? {};
  const merged = { ...profile, ...userObject };
  const firstName = merged.firstName || "";
  const lastName = merged.lastName || "";
  const fallbackName = merged.name || "";
  const name = `${firstName} ${lastName}`.trim() || fallbackName || "Unknown User";
  const avatarSource = merged.avatar || (name ? name.charAt(0) : "U");

  return {
    id: merged._id?.toString?.() || userObject._id?.toString?.() || null,
    name,
    avatar: avatarSource,
    averageResponseMinutes: merged.averageResponseMinutes ?? null,
    lastSeen: userObject.lastSeen || merged.lastSeen || null,
  };
};

const normalizeConversation = (conversation, role) => {
  // Determine profile roles based on context
  let buyerProfileRole = "realestate_buyer";
  let sellerProfileRole = "realestate_seller";
  
  if (role === "ecommerce_buyer" || role === "ecommerce_seller") {
    buyerProfileRole = "ecommerce_buyer";
    sellerProfileRole = "ecommerce_seller";
  }

  // Normalize property (real estate)
  const property = conversation.propertyId
    ? {
        id: conversation.propertyId._id,
        title: conversation.propertyId.title,
        images: conversation.propertyId.images,
        price: conversation.propertyId.price,
        location:
          conversation.propertyId.location ||
          `${conversation.propertyId.city || ""}, ${conversation.propertyId.state || ""}`.trim(),
      }
    : null;

  // Normalize product (ecommerce)
  const product = conversation.productId
    ? {
        id: conversation.productId._id,
        title: conversation.productId.name,
        images: conversation.productId.images || [],
        price: conversation.productId.price,
        currency: conversation.productId.currency || "USD",
        unit: conversation.productId.unit || "piece",
        store: conversation.productId.store
          ? {
              name: conversation.productId.store.name || "",
              location: conversation.productId.store.location || "",
            }
          : null,
      }
    : null;

  return {
    id: conversation._id,
    buyer: normalizeUser(
      conversation.buyerId,
      getProfile(conversation.buyerId, buyerProfileRole, sellerProfileRole)
    ),
    seller: normalizeUser(
      conversation.sellerId,
      getProfile(conversation.sellerId, sellerProfileRole, buyerProfileRole)
    ),
    property,
    product,
    lastMessage: conversation.lastMessage,
    lastMessageSenderId:
      conversation.lastMessageSender?._id?.toString?.() ||
      conversation.lastMessageSender?.toString?.() ||
      null,
    updatedAt: conversation.updatedAt,
    createdAt: conversation.createdAt,
  };
};

export const startConversation = async (req, res) => {
  try {
    const { buyerId, sellerId, propertyId, productId } = req.body;

    // Validate that either propertyId or productId is provided
    if (!buyerId || !sellerId || (!propertyId && !productId)) {
      return res.status(400).json({ 
        message: "buyerId, sellerId, and either propertyId or productId are required" 
      });
    }

    const userId = req.user?._id?.toString();
    if (userId && userId !== buyerId && userId !== sellerId) {
      return res.status(403).json({ message: "You are not authorized for this conversation" });
    }

    // Build query based on whether it's property or product
    const query = propertyId
      ? { buyerId, sellerId, propertyId }
      : { buyerId, sellerId, productId };

    // Try to reuse an existing conversation
    let conversation = await Conversation.findOne(query).populate(
      conversationPopulateConfig
    );

    // Fallback: if no exact match, reuse any conversation between the same users
    // for the same channel type (property vs product) to avoid duplicate threads.
    if (!conversation) {
      const fallbackQuery = propertyId
        ? { buyerId, sellerId, propertyId: { $exists: true } }
        : { buyerId, sellerId, productId: { $exists: true } };

      conversation = await Conversation.findOne(fallbackQuery).populate(
        conversationPopulateConfig
      );
    }

    if (!conversation) {
      conversation = await Conversation.create({
        buyerId,
        sellerId,
        propertyId: propertyId || undefined,
        productId: productId || undefined,
        lastMessage: "",
        lastMessageSender: null,
      });

      conversation = await conversation.populate(conversationPopulateConfig);
    }

    // Determine role for normalization (prefer the persisted conversation's type)
    const role =
      conversation?.productId || productId
        ? "ecommerce_buyer"
        : "realestate_buyer";

    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      conversation: normalizeConversation(conversation, role),
      messages: messages.map((msg) => ({
        id: msg._id,
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        message: msg.message,
        type: msg.type,
        mediaUrl: msg.mediaUrl,
        fileName: msg.fileName,
        mimeType: msg.mimeType,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      })),
    });
  } catch (error) {
    console.error("startConversation error", error);
    return res.status(500).json({ message: "Failed to start conversation" });
  }
};

export const getUserConversations = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Get role from query parameter
    const role = req.query.role;

    // Build filter based on role
    let filter = {};
    if (role === "realestate_buyer" || role === "ecommerce_buyer") {
      // If user is acting as buyer, only show conversations where they are the buyer
      filter = { buyerId: userId };
    } else if (role === "realestate_seller" || role === "ecommerce_seller") {
      // If user is acting as seller, only show conversations where they are the seller
      filter = { sellerId: userId };
    } else {
      // If no role specified, show all conversations (backward compatibility)
      filter = {
        $or: [{ buyerId: userId }, { sellerId: userId }],
      };
    }

    const conversations = await Conversation.find(filter)
      .populate(conversationPopulateConfig)
      .sort({ updatedAt: -1 })
      .lean({ virtuals: true });

    return res.json({
      conversations: conversations.map((conversation) =>
        normalizeConversation({
          ...conversation,
          buyerId: conversation.buyerId,
          sellerId: conversation.sellerId,
          propertyId: conversation.propertyId,
          productId: conversation.productId,
        }, role)
      ),
    });
  } catch (error) {
    console.error("getUserConversations error", error);
    return res.status(500).json({ message: "Failed to load conversations" });
  }
};

export const getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: "Invalid conversation id" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const userId = req.user?._id?.toString();
    if (userId !== conversation.buyerId.toString() && userId !== conversation.sellerId.toString()) {
      return res.status(403).json({ message: "You are not allowed to access this conversation" });
    }

    // Update lastSeen when user views conversation
    if (userId) {
      await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    }

    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 }).lean();

    return res.json({
      messages: messages.map((msg) => ({
        id: msg._id,
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        message: msg.message,
        type: msg.type,
        mediaUrl: msg.mediaUrl,
        fileName: msg.fileName,
        mimeType: msg.mimeType,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      })),
    });
  } catch (error) {
    console.error("getConversationMessages error", error);
    return res.status(500).json({ message: "Failed to load messages" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { conversationId, message, mediaUrl, fileName, mimeType, type = "text" } = req.body;
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

    const senderId = req.user?._id;
    if (!senderId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Check if user has chat access
    const user = await User.findById(senderId);
    if (user?.chatAccess === "suspended") {
      return res.status(403).json({
        message: "Your chat access has been suspended. Please contact support.",
      });
    }

    // Update lastSeen for the sender
    await User.findByIdAndUpdate(senderId, { lastSeen: new Date() });

    if (
      senderId.toString() !== conversation.buyerId.toString() &&
      senderId.toString() !== conversation.sellerId.toString()
    ) {
      return res.status(403).json({ message: "You are not part of this conversation" });
    }

    const lastConversationMessage = await Message.findOne({ conversationId }).sort({ createdAt: -1 });

    const payload = {
      conversationId,
      senderId,
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
    conversation.lastMessageSender = senderId;
    await conversation.save();

    if (senderId.toString() === conversation.sellerId.toString() && lastConversationMessage) {
      const lastSender = lastConversationMessage.senderId?.toString();
      if (lastSender && lastSender !== senderId.toString()) {
        const responseMinutes =
          (newMessage.createdAt.getTime() - lastConversationMessage.createdAt.getTime()) / 60000;
        if (!Number.isNaN(responseMinutes) && responseMinutes >= 0) {
          const sellerUser = await User.findById(conversation.sellerId);
          if (sellerUser) {
            // Determine profile key based on whether it's property or product conversation
            const profileKey = conversation.productId ? "ecommerce_seller" : "realestate_seller";
            let currentProfile =
              sellerUser.profiles?.get?.(profileKey) ||
              sellerUser.profiles?.[profileKey] ||
              {};
            const prevAvg = currentProfile?.averageResponseMinutes ?? null;
            const prevCount = currentProfile?.responseSamples ?? 0;
            const newAvg =
              prevAvg !== null
                ? (prevAvg * prevCount + responseMinutes) / (prevCount + 1)
                : responseMinutes;
            currentProfile = {
              ...currentProfile,
              averageResponseMinutes: newAvg,
              responseSamples: prevCount + 1,
            };

            if (typeof sellerUser.profiles?.set === "function") {
              sellerUser.profiles.set(profileKey, currentProfile);
            } else {
              sellerUser.profiles = sellerUser.profiles || {};
              sellerUser.profiles[profileKey] = currentProfile;
            }

            await sellerUser.save();
          }
        }
      }
    }

    const formattedMessage = {
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
    };

    const io = req.app.get("io");
    if (io) {
      const receiverId =
        senderId.toString() === conversation.buyerId.toString()
          ? conversation.sellerId.toString()
          : conversation.buyerId.toString();

      io.to(conversationId).emit("newMessage", formattedMessage);
      io.to(receiverId).emit("notification", {
        conversationId,
        message: formattedMessage,
      });

      // Get sender info for notification
      const sender = await User.findById(senderId).select("name firstName lastName");
      const senderName = sender?.name || sender?.firstName || "Someone";

      // Create notification for receiver
      try {
        await createNotification({
          userId: receiverId,
          type: "new_message",
          title: "New Message",
          message: `${senderName}: ${trimmedMessage || (mediaUrl ? fileName || "Sent an attachment" : "Sent a message")}`,
          actionUrl: conversation.productId 
            ? `/ecommerce/buyer/messages/${conversationId}`
            : `/real-estate/buyer/messages/${conversationId}`,
          metadata: {
            conversationId: conversationId.toString(),
            senderId: senderId.toString(),
            messageId: newMessage._id.toString(),
          },
          relatedId: conversationId,
          relatedType: "conversation",
          sendEmail: true,
          io,
        });
      } catch (notifError) {
        console.error("Failed to create notification for message:", notifError);
        // Don't fail the message send if notification fails
      }
    }

    return res.status(201).json({ message: formattedMessage });
  } catch (error) {
    console.error("sendMessage error", error);
    return res.status(500).json({ message: "Failed to send message" });
  }
};

export const updateLastSeen = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    await User.findByIdAndUpdate(userId, { lastSeen: new Date() });

    return res.json({ success: true, lastSeen: new Date() });
  } catch (error) {
    console.error("updateLastSeen error", error);
    return res.status(500).json({ message: "Failed to update last seen" });
  }
};


