import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "new_message",
        "new_review",
        "review_response",
        "listing_inquiry",
        "order_placed",
        "verification_approved",
        "verification_rejected",
        "subscription_activated",
        "subscription_expiring",
        "listing_featured_approved",
        "listing_featured_expired",
        "support_message",
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    actionUrl: {
      type: String,
      default: null, // URL to navigate when notification is clicked
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Reference to related entities (optional)
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    relatedType: {
      type: String,
      enum: ["conversation", "review", "product", "property", "order", "verification"],
      default: null,
    },
    // Filter notifications by app context: ecommerce vs real-estate
    channel: {
      type: String,
      enum: ["ecommerce", "real-estate"],
      default: null,
      index: true,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, channel: 1, read: 1, createdAt: -1 });

// TTL index to automatically delete notifications older than 90 days (optional)
// notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;

