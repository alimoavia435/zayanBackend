import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD", trim: true },
    unit: { type: String, default: "piece", trim: true },
    images: { type: [String], default: [] },
    stock: { type: Number, default: 0, min: 0 },
    sku: { type: String, trim: true },
    status: {
      type: String,
      default: "active",
      enum: ["active", "inactive", "out_of_stock"],
    },
    sales: { type: Number, default: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isFeatured: { type: Boolean, default: false },
    featuredUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

const Product = mongoose.model("Product", productSchema);

export default Product;
