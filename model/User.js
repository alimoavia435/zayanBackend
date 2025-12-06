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
    
    // Last seen timestamp for chat functionality
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
