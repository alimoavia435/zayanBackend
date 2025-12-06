import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "📦" },
    products: { type: Number, default: 0 },
    status: { type: String, default: "active", enum: ["active", "inactive"] },
  },
  { timestamps: true }
);

const Category = mongoose.model("Category", categorySchema);

export default Category;

