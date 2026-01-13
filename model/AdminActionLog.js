import mongoose from "mongoose";

const adminActionLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    adminEmail: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "verification_approved",
        "verification_rejected",
        "user_updated",
        "user_deleted",
        "user_suspended",
        "user_banned",
        "user_reactivated",
        "user_role_disabled",
        "user_role_enabled",
        "content_removed",
        "content_approved",
        "store_disabled",
        "store_enabled",
        "product_removed",
        "product_approved",
        "property_unpublished",
        "property_published",
        "system_settings_changed",
      ],
      index: true,
    },
    targetType: {
      type: String,
      required: true,
      enum: ["user", "verification", "product", "property", "review", "system", "message", "conversation"],
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    details: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    reason: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for efficient querying
adminActionLogSchema.index({ adminId: 1, createdAt: -1 });
adminActionLogSchema.index({ action: 1, createdAt: -1 });
adminActionLogSchema.index({ targetType: 1, targetId: 1 });

const AdminActionLog = mongoose.model("AdminActionLog", adminActionLogSchema);

export default AdminActionLog;

