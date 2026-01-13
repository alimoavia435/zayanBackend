import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["superAdmin", "moderator", "support"],
      default: "support",
      required: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Hash password before saving
adminSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password
adminSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to update last login
adminSchema.methods.updateLastLogin = async function () {
  this.lastLogin = new Date();
  await this.save();
};

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;

