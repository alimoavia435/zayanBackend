import mongoose from "mongoose";

const userBehaviorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
    },
    action: {
      type: String,
      enum: ["view", "click", "like", "share", "save", "message", "search"],
      required: true,
      index: true,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // For search actions
    searchQuery: {
      type: String,
      default: null,
    },
    searchFilters: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // For tracking session context
    sessionId: {
      type: String,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
userBehaviorSchema.index({ userId: 1, itemType: 1, createdAt: -1 });
userBehaviorSchema.index({ itemType: 1, itemId: 1, action: 1, createdAt: -1 });
userBehaviorSchema.index({ userId: 1, action: 1, createdAt: -1 });
userBehaviorSchema.index({ createdAt: -1 });

// TTL index to automatically delete old behavior data after 1 year (optional)
// userBehaviorSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

const UserBehavior = mongoose.model("UserBehavior", userBehaviorSchema);

export default UserBehavior;

