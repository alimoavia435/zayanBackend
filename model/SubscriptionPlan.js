import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      enum: ["Basic", "Pro", "Premium"],
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    billingPeriod: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
      required: true,
      index: true,
    },
    duration: {
      type: Number,
      required: true,
      default: 30, // days
    },
    features: {
      maxListings: {
        type: Number,
        required: true,
        default: 0, // 0 means unlimited
      },
      maxStores: {
        type: Number,
        required: true,
        default: 1, // Default to 1 store for basic plans
      },
      featuredListingsCount: {
        type: Number,
        required: true,
        default: 0,
      },
      boostedVisibility: {
        type: Boolean,
        required: true,
        default: false,
      },
      prioritySupport: {
        type: Boolean,
        required: true,
        default: false,
      },
    },
    targetRole: {
      type: String,
      required: true,
      enum: ["ecommerceSeller", "realEstateSeller", "both"],
      index: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

// Compound index for efficient queries
subscriptionPlanSchema.index({ targetRole: 1, isActive: 1 });

const SubscriptionPlan = mongoose.model(
  "SubscriptionPlan",
  subscriptionPlanSchema,
);

export default SubscriptionPlan;
