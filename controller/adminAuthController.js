import Admin from "../model/Admin.js";
import generateToken from "../utils/generateToken.js";

const normalizeEmail = (value = "") => value.trim().toLowerCase();

// @desc    Admin login
// @route   POST /api/admin/auth/login
// @access  Public
export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = normalizeEmail(email);

    // Find admin by email
    const admin = await Admin.findOne({ email: normalizedEmail });

    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(403).json({ message: "Admin account is deactivated" });
    }

    // Check password
    const isMatch = await admin.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Update last login
    await admin.updateLastLogin();

    // Generate token
    const token = generateToken(admin._id);

    // Return admin data (without password)
    const adminData = {
      id: admin._id,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions,
      lastLogin: admin.lastLogin,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };

    res.json({
      message: "Admin login successful",
      admin: adminData,
      token,
    });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
};

// @desc    Get current admin
// @route   GET /api/admin/auth/me
// @access  Private (Admin)
export const getCurrentAdmin = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select("-password");

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    if (!admin.isActive) {
      return res.status(403).json({ message: "Admin account is deactivated" });
    }

    const adminData = {
      id: admin._id,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions,
      lastLogin: admin.lastLogin,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };

    res.json({
      admin: adminData,
    });
  } catch (err) {
    console.error("Get current admin error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
};

