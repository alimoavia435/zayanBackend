import mongoose from "mongoose";

const featuredListingSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      required: true,
      enum: ["product", "property"],
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
      required: true,
      enum: ["Product", "Property"],
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
    priorityScore: {
      type: Number,
      required: true,
      default: 10, // Base priority score for featured listings
    },
    isBoosted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
featuredListingSchema.index({ itemType: 1, itemId: 1 });
featuredListingSchema.index({ sellerId: 1, itemType: 1 });
featuredListingSchema.index({ endDate: 1, itemType: 1 }); // For finding expired featured listings
featuredListingSchema.index({ priorityScore: -1, itemType: 1 }); // For sorting by priority

// Method to check if featured listing is active
featuredListingSchema.methods.isActive = function () {
  const now = new Date();
  return this.startDate <= now && this.endDate >= now;
};

const FeaturedListing = mongoose.model("FeaturedListing", featuredListingSchema);

export default FeaturedListing;

