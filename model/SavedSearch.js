import mongoose from "mongoose";

const savedSearchSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: true,
      trim: true,
    },
    searchQuery: {
      type: String,
      default: "",
    },
    filters: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Alert settings
    alertsEnabled: {
      type: Boolean,
      default: true,
    },
    lastAlertSent: {
      type: Date,
      default: null,
    },
    alertFrequency: {
      type: String,
      enum: ["daily", "weekly", "real-time"],
      default: "daily",
    },
    // Track how many new items were found last time
    lastNewItemsCount: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries
savedSearchSchema.index({ userId: 1, itemType: 1, active: 1 });
savedSearchSchema.index({ userId: 1, active: 1, createdAt: -1 });

const SavedSearch = mongoose.model("SavedSearch", savedSearchSchema);

export default SavedSearch;

