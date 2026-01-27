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
  const name =
    `${firstName} ${lastName}`.trim() || fallbackName || "Unknown User";
  const avatarSource = merged.avatar || (name ? name.charAt(0) : "U");

  return {
    id: merged._id?.toString?.() || userObject._id?.toString?.() || null,
    name,
    avatar: avatarSource,
    averageResponseMinutes: merged.averageResponseMinutes ?? null,
    lastSeen: userObject.lastSeen || merged.lastSeen || null,
  };
};

const normalizeConversation = (conversation, requestUserId) => {
  // ARCHITECTURAL DECISION: Dynamically determine role based on identity and context
  const isBuyer =
    conversation.buyerId?._id?.toString() === requestUserId?.toString() ||
    conversation.buyerId?.toString() === requestUserId?.toString();

  const isSeller =
    conversation.sellerId?._id?.toString() === requestUserId?.toString() ||
    conversation.sellerId?.toString() === requestUserId?.toString();

  // Determine profile roles based on contextType
  // defaults based on contextType
  let buyerProfileRole =
    conversation.contextType === "property"
      ? "realestate_buyer"
      : "ecommerce_buyer";
  let sellerProfileRole =
    conversation.contextType === "property"
      ? "realestate_seller"
      : "ecommerce_seller";

  if (conversation.isSupportChat) {
    buyerProfileRole = "ecommerce_buyer"; // or a generic role
    sellerProfileRole = "admin";
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
              name: conversation.productId.store?.name || "",
              location: conversation.productId.store?.location || "",
            }
          : null,
      }
    : null;

  return {
    id: conversation._id,
    buyer: normalizeUser(
      conversation.buyerId,
      conversation.buyerId
        ? getProfile(conversation.buyerId, buyerProfileRole, sellerProfileRole)
        : null,
    ),
    seller: normalizeUser(
      conversation.sellerId,
      conversation.sellerId
        ? getProfile(conversation.sellerId, sellerProfileRole, buyerProfileRole)
        : null,
    ),
    property,
    product,
    contextType:
      conversation.contextType ||
      (conversation.productId ? "product" : "property"),
    contextId:
      conversation.contextId ||
      conversation.productId ||
      conversation.propertyId,
    lastMessage: conversation.lastMessage,
    lastMessageSenderId:
      conversation.lastMessageSender?._id?.toString?.() ||
      conversation.lastMessageSender?.toString?.() ||
      null,
    updatedAt: conversation.updatedAt,
    createdAt: conversation.createdAt,
    isSupportChat: conversation.isSupportChat || false,
    // Add context-aware metadata for UI routing
    myRole: isBuyer ? "buyer" : isSeller ? "seller" : "unknown",
  };
};

export const startConversation = async (req, res) => {
  try {
    const { buyerId, sellerId, propertyId, productId, isSupportChat } =
      req.body;

    // VALIDATION: Support chat has different rules
    if (isSupportChat) {
      if (!buyerId || !sellerId) {
        return res
          .status(400)
          .json({ message: "buyerId and sellerId are required for support" });
      }
    } else if (!buyerId || !sellerId || (!propertyId && !productId)) {
      return res.status(400).json({
        message:
          "buyerId, sellerId, and either propertyId or productId are required",
      });
    }

    const userId = req.user?._id?.toString();
    if (userId && userId !== buyerId && userId !== sellerId) {
      return res
        .status(403)
        .json({ message: "You are not authorized for this conversation" });
    }

    // ARCHITECTURAL DECISION: Use contextType and contextId for identification
    const contextType = propertyId
      ? "property"
      : productId
        ? "product"
        : isSupportChat
          ? "support"
          : "product";
    const contextId = propertyId || productId || sellerId; // for support, contextId could be sellerId (admin)

    // Build query based on unified context architecture
    const query = {
      buyerId,
      sellerId,
      contextType,
      contextId,
    };

    // Try to reuse an existing conversation based on exact context match
    let conversation = await Conversation.findOne(query).populate(
      conversationPopulateConfig,
    );

    // Backward compatibility: If not found by context, try legacy fields
    if (!conversation) {
      const legacyQuery = propertyId
        ? { buyerId, sellerId, propertyId }
        : { buyerId, sellerId, productId };

      conversation = await Conversation.findOne(legacyQuery).populate(
        conversationPopulateConfig,
      );
    }

    if (!conversation) {
      // Create new conversation with unified context architecture
      conversation = await Conversation.create({
        buyerId,
        sellerId,
        contextType,
        contextId,
        propertyId: propertyId || undefined,
        productId: productId || undefined,
        isSupportChat: isSupportChat || false,
        lastMessage: "",
        lastMessageSender: null,
      });

      conversation = await conversation.populate(conversationPopulateConfig);
    }

    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      conversation: normalizeConversation(conversation, userId),
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

    // Get role from query parameter (Role is now a FILTER, not a constraint on ownership)
    const roleFilter = req.query.role;

    // UNIFIED INBOX: Base filter is just the user's identity
    let filter = {
      $or: [{ buyerId: userId }, { sellerId: userId }],
    };

    // APPLY CONTEXTUAL FILTERING based on the requested UI view (role)
    if (roleFilter === "realestate_buyer") {
      filter = { buyerId: userId, contextType: "property" };
    } else if (roleFilter === "ecommerce_buyer") {
      filter = { buyerId: userId, contextType: "product" };
    } else if (roleFilter === "realestate_seller") {
      filter = { sellerId: userId, contextType: "property" };
    } else if (roleFilter === "ecommerce_seller") {
      filter = { sellerId: userId, contextType: "product" };
    }

    const conversations = await Conversation.find(filter)
      .populate(conversationPopulateConfig)
      .sort({ updatedAt: -1 })
      .lean({ virtuals: true });

    return res.json({
      conversations: conversations.map((conversation) =>
        normalizeConversation(conversation, userId),
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
    if (
      userId !== conversation.buyerId.toString() &&
      userId !== conversation.sellerId.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You are not allowed to access this conversation" });
    }

    // Update lastSeen when user views conversation
    if (userId) {
      await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    }

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .lean();

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
    const {
      conversationId,
      message,
      mediaUrl,
      fileName,
      mimeType,
      type = "text",
    } = req.body;
    if (!conversationId) {
      return res.status(400).json({ message: "conversationId is required" });
    }

    const trimmedMessage = message?.trim();

    if (!trimmedMessage && !mediaUrl) {
      return res
        .status(400)
        .json({ message: "Message text or media is required" });
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
      return res
        .status(403)
        .json({ message: "You are not part of this conversation" });
    }

    const lastConversationMessage = await Message.findOne({
      conversationId,
    }).sort({ createdAt: -1 });

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

    conversation.lastMessage =
      trimmedMessage || (mediaUrl ? fileName || "Attachment" : "");
    conversation.lastMessageSender = senderId;
    await conversation.save();

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

    // Background tasks: Response time and Notifications
    const processBackgroundTasks = async () => {
      try {
        if (
          senderId.toString() === conversation.sellerId.toString() &&
          lastConversationMessage
        ) {
          const lastSender = lastConversationMessage.senderId?.toString();
          if (lastSender && lastSender !== senderId.toString()) {
            const responseMinutes =
              (newMessage.createdAt.getTime() -
                lastConversationMessage.createdAt.getTime()) /
              60000;
            if (!Number.isNaN(responseMinutes) && responseMinutes >= 0) {
              const sellerUser = await User.findById(conversation.sellerId);
              if (sellerUser) {
                const profileKey = conversation.productId
                  ? "ecommerce_seller"
                  : "realestate_seller";
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

        // Notification logic
        const io = req.app.get("io");
        if (io) {
          const receiverId =
            senderId.toString() === conversation.buyerId.toString()
              ? conversation.sellerId.toString()
              : conversation.buyerId.toString();

          io.to(conversationId.toString()).emit("newMessage", formattedMessage);
          io.to(receiverId.toString()).emit("notification", {
            conversationId: conversationId.toString(),
            message: formattedMessage,
          });

          const sender = await User.findById(senderId).select(
            "name firstName lastName",
          );
          const senderName = sender?.name || sender?.firstName || "Someone";

          let channel = "ecommerce";
          if (conversation.contextType === "property") channel = "real-estate";
          const role =
            receiverId.toString() === conversation.sellerId.toString()
              ? "seller"
              : "buyer";

          createNotification({
            userId: receiverId,
            type: "new_message",
            title: "New Message",
            message: `${senderName}: ${trimmedMessage || (mediaUrl ? fileName || "Sent an attachment" : "Sent a message")}`,
            actionUrl: `/${channel}/${role}/messages/${conversationId}`,
            metadata: {
              conversationId: conversationId.toString(),
              senderId: senderId.toString(),
              messageId: newMessage._id.toString(),
            },
            relatedId: conversationId,
            relatedType: "conversation",
            sendEmail: true,
            io,
          }).catch((e) => console.error("Notification background error", e));
        }
      } catch (err) {
        console.error("Background task error:", err);
      }
    };

    // Trigger background tasks and return response immediately
    processBackgroundTasks();

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
