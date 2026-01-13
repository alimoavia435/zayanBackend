import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    // Review type: 'product' or 'seller'
    type: {
      type: String,
      enum: ["product", "seller"],
      required: true,
    },
    // Product reference (for product reviews)
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: function() {
        return this.type === "product";
      },
    },
    // Seller reference (for seller/agent reviews)
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function() {
        return this.type === "seller";
      },
    },
    // Reviewer (buyer)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Overall rating (1-5)
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    // Category-based ratings (for seller reviews)
    categories: {
      communication: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
      },
      accuracy: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
      },
      professionalism: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
      },
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    comment: {
      type: String,
      trim: true,
      default: "",
    },
    // Seller response to the review
    sellerResponse: {
      response: {
        type: String,
        trim: true,
        default: "",
      },
      respondedAt: {
        type: Date,
        default: null,
      },
    },
    // Verification: only buyers who interacted can review (for seller reviews)
    verified: {
      type: Boolean,
      default: false,
    },
    // Conversation ID that verified this interaction (for seller reviews)
    verifiedByConversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
  },
  { timestamps: true }
);

// Ensure one review per user per product (for product reviews)
reviewSchema.index({ product: 1, user: 1 }, { unique: true, sparse: true });

// Ensure one review per user per seller (for seller reviews)
reviewSchema.index({ seller: 1, user: 1 }, { unique: true, sparse: true });

// Compound index for type-based queries
reviewSchema.index({ type: 1, product: 1 });
reviewSchema.index({ type: 1, seller: 1 });
reviewSchema.index({ type: 1, user: 1 });

const Review = mongoose.model("Review", reviewSchema);

export default Review;

