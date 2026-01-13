import mongoose from "mongoose";

const messageFlagSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      required: true,
    },
    flaggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

messageFlagSchema.index({ messageId: 1 });
messageFlagSchema.index({ flaggedBy: 1 });

export default mongoose.model("MessageFlag", messageFlagSchema);

