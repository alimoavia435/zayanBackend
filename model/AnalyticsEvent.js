import mongoose from "mongoose";

const analyticsEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: ["view", "click", "chat_started", "message_sent", "message_received"],
      required: true,
      index: true,
    },
    itemType: {
      type: String,
      enum: ["product", "property"],
      required: true,
      index: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      refPath: "itemModel",
    },
    itemModel: {
      type: String,
      enum: ["Product", "Property"],
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    sessionId: {
      type: String,
      index: true,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    responseTime: {
      type: Number, // in milliseconds (for chat responses)
      default: null,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
analyticsEventSchema.index({ ownerId: 1, eventType: 1, createdAt: -1 });
analyticsEventSchema.index({ itemId: 1, itemType: 1, eventType: 1, createdAt: -1 });
analyticsEventSchema.index({ createdAt: -1 });
analyticsEventSchema.index({ ownerId: 1, itemId: 1, eventType: 1 });

// TTL index to automatically delete events older than 2 years (optional, for data retention)
// analyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 }); // 2 years

const AnalyticsEvent = mongoose.model("AnalyticsEvent", analyticsEventSchema);

export default AnalyticsEvent;

