import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
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
    paymentIntentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "usd",
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "succeeded", "failed", "canceled"],
      default: "pending",
      index: true,
    },
    metadata: {
      type: Map,
      of: String,
    },
    processedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ paymentIntentId: 1, status: 1 });
paymentSchema.index({ createdAt: 1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;

