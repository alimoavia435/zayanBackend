import mongoose from "mongoose";

const chatReportSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: true,
      enum: [
        "harassment",
        "spam",
        "inappropriate_content",
        "scam",
        "fake_listing",
        "other",
      ],
    },
    description: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved", "dismissed"],
      default: "pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    adminNotes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

chatReportSchema.index({ conversationId: 1, status: 1 });
chatReportSchema.index({ reportedBy: 1 });
chatReportSchema.index({ reportedUser: 1 });
chatReportSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("ChatReport", chatReportSchema);

