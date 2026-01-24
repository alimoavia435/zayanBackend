import mongoose from "mongoose";

const userSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["ecommerceSeller", "realEstateSeller"],
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["active", "expired", "cancelled"],
      default: "active",
      index: true,
    },
    autoRenew: {
      type: Boolean,
      required: true,
      default: true,
    },
    usage: {
      listingsUsed: {
        type: Number,
        default: 0,
      },
      featuredUsed: {
        type: Number,
        default: 0,
      },
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
userSubscriptionSchema.index({ userId: 1, role: 1, status: 1 });
userSubscriptionSchema.index({ userId: 1, status: 1, endDate: 1 });
userSubscriptionSchema.index({ endDate: 1, status: 1 }); // For finding expired subscriptions

// Method to check if subscription is active
userSubscriptionSchema.methods.isActive = function () {
  const now = new Date();
  return (
    this.status === "active" &&
    this.startDate <= now &&
    this.endDate >= now
  );
};

const UserSubscription = mongoose.model("UserSubscription", userSubscriptionSchema);

export default UserSubscription;

