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
  { timestamps: true }
);

// Index for real estate (propertyId)
conversationSchema.index(
  { buyerId: 1, sellerId: 1, propertyId: 1 },
  { unique: true, sparse: true }
);

// Index for ecommerce (productId)
conversationSchema.index(
  { buyerId: 1, sellerId: 1, productId: 1 },
  { unique: true, sparse: true }
);

export default mongoose.model("Conversation", conversationSchema);


