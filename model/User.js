import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    firstName: { type: String },
    lastName: { type: String },

    email: { type: String, required: true, unique: true },
    roles: { type: [String], default: [] },

    password: { type: String, required: true },
    
    // Role-based profiles
    profiles: {
      type: Map,
      of: {
        firstName: { type: String },
        lastName: { type: String },
        phone: { type: String },
        bio: { type: String },
        specialization: { type: String },
        agency: { type: String },
        certifications: { type: String },
        languages: { type: [String], default: [] },
        avatar: { type: String },
        rating: { type: Number, default: 0 },
        country: { type: String },
        state: { type: String },
        city: { type: String },
        averageResponseMinutes: { type: Number, default: null },
        responseSamples: { type: Number, default: 0 },
      },
      default: {},
    },

    // Legacy fields for backward compatibility (will be migrated to profiles)
    phone: { type: String },
    bio: { type: String },
    specialization: { type: String },
    agency: { type: String },
    certifications: { type: String },
    languages: { type: [String], default: [] },
    avatar: { type: String },
    rating: { type: Number, default: 0 },
    country: String,
    state: String,
    city: String,
    
    isVerified: { type: Boolean, default: false },
    otpCode: { type: String },
    otpExpiresAt: { type: Date },
    passwordResetOtp: { type: String },
    passwordResetExpiresAt: { type: Date },
    passwordResetOtpVerifiedAt: { type: Date },
    
    // Seller/Agent verification system
    verificationStatus: { 
      type: String, 
      enum: ["pending", "approved", "rejected"], 
      default: null 
    },
    verificationDocuments: { type: [String], default: [] },
    
    // Last seen timestamp for chat functionality
    lastSeen: { type: Date, default: Date.now },
    
    // Account status management
    accountStatus: {
      type: String,
      enum: ["active", "suspended", "banned"],
      default: "active",
    },
    suspendedAt: { type: Date, default: null },
    bannedAt: { type: Date, default: null },
    suspensionReason: { type: String, default: null },
    banReason: { type: String, default: null },
    
    // Role management
    disabledRoles: { type: [String], default: [] }, // Roles that have been force-disabled by admin
    
    // Chat moderation
    chatAccess: {
      type: String,
      enum: ["active", "suspended", "restricted"],
      default: "active",
    },
    chatSuspendedAt: { type: Date, default: null },
    chatSuspensionReason: { type: String, default: null },
    chatWarnings: [
      {
        warning: String,
        reason: String,
        warnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
        warnedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
