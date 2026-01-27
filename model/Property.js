import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    location: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    beds: { type: Number, required: true, min: 0 },
    baths: { type: Number, required: true, min: 0 },
    sqft: { type: Number, required: true, min: 0 },
    yearBuilt: { type: Number },
    propertyType: { type: String, required: true },
    amenities: { type: [String], default: [] },
    images: {
      type: [String],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one image is required",
      },
    },
    status: { type: String, default: "active" },
    views: { type: Number, default: 0 },
    inquiries: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    featuredUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

const Property = mongoose.model("Property", propertySchema);

export default Property;
