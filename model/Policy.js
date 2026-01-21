import mongoose from "mongoose";

const policySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["privacy", "terms", "cookies"],
      required: true,
      unique: true,
    },
    content: {
      type: String, // rich text / HTML from CMS
      required: true,
    },
    version: {
      type: String,
      required: true,
      default: "1.0.0",
    },
    lastUpdated: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
);

policySchema.index({ type: 1 });

const Policy = mongoose.model("Policy", policySchema);

export default Policy;


