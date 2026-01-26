import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Unified Context Fields (Context-based architecture)
    contextType: {
      type: String,
      enum: ["product", "property", "support"],
      required: true,
      default: "product",
    },
    contextId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },

    // Legacy fields (kept for backward compatibility)
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: false,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: false,
    },
    lastMessage: {
      type: String,
      default: "",
    },
    lastMessageSender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Support chat flag (admin-user conversation)
    isSupportChat: {
      type: Boolean,
      default: false,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true },
);

// ENFORCE ARCHITECTURAL DECISION: Unified uniqueness based on context
// One conversation per buyer + seller + specific listing (product/property)
conversationSchema.index(
  { buyerId: 1, sellerId: 1, contextType: 1, contextId: 1 },
  { unique: true, sparse: true },
);

// Keep legacy indices for existing data during transition
conversationSchema.index(
  { buyerId: 1, sellerId: 1, propertyId: 1 },
  { unique: true, sparse: true },
);
conversationSchema.index(
  { buyerId: 1, sellerId: 1, productId: 1 },
  { unique: true, sparse: true },
);

export default mongoose.model("Conversation", conversationSchema);
