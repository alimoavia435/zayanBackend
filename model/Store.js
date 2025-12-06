import mongoose from "mongoose";

const storeSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    location: { type: String, required: true },
    bannerImage: { type: String, default: "🏪" },
    status: { type: String, default: "active", enum: ["active", "inactive"] },
    // Stats that can be calculated or stored
    products: { type: Number, default: 0 },
    followers: { type: Number, default: 0 },
    followersList: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    }],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Store = mongoose.model("Store", storeSchema);

export default Store;

