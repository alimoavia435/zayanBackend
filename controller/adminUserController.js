import User from "../model/User.js";
import AdminActionLog from "../model/AdminActionLog.js";
import Product from "../model/Product.js";
import Property from "../model/Property.js";
import Store from "../model/Store.js";
import Conversation from "../model/Conversation.js";

// Get all users with pagination and filters (Admin only)
export const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const role = req.query.role; // ecommerceSeller, realEstateSeller, or buyer
    const status = req.query.status; // active, suspended, banned
    const search = req.query.search; // Search by name or email

    // Build query
    const query = {};

    // Role filter
    if (role) {
      if (role === "buyer") {
        // Users who are NOT sellers
        query.roles = { $nin: ["ecommerceSeller", "realEstateSeller"] };
      } else if (role === "seller") {
        // Users who ARE sellers (either type)
        query.roles = { $in: ["ecommerceSeller", "realEstateSeller"] };
      } else if (role === "ecommerceSeller") {
        query.roles = { $in: [role] };
      } else if (role === "realEstateSeller") {
        query.roles = { $in: [role] };
      }
    }

    // Status filter
    if (status && ["active", "suspended", "banned"].includes(status)) {
      query.accountStatus = status;
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get users
    const users = await User.find(query)
      .select(
        "name firstName lastName email roles accountStatus suspendedAt bannedAt suspensionReason banReason disabledRoles createdAt lastSeen verificationStatus isVerified"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count
    const total = await User.countDocuments(query);

    // Transform users
    const transformedUsers = users.map((user) => ({
      _id: user._id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles: user.roles || [],
      accountStatus: user.accountStatus || "active",
      suspendedAt: user.suspendedAt,
      bannedAt: user.bannedAt,
      suspensionReason: user.suspensionReason,
      banReason: user.banReason,
      disabledRoles: user.disabledRoles || [],
      createdAt: user.createdAt,
      lastSeen: user.lastSeen,
      verificationStatus: user.verificationStatus,
      isVerified: user.isVerified,
      hasEcommerceSeller: user.roles?.includes("ecommerceSeller") || false,
      hasRealEstateSeller: user.roles?.includes("realEstateSeller") || false,
      isBuyer: !user.roles?.some((r) =>
        ["ecommerceSeller", "realEstateSeller"].includes(r)
      ),
    }));

    return res.json({
      success: true,
      users: transformedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getUsers error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get users",
    });
  }
};

// Get user details with activity summary (Admin only)
export const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const user = await User.findById(userId).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get activity counts
    const [
      productsCount,
      propertiesCount,
      storesCount,
      conversationsCount,
    ] = await Promise.all([
      Product.countDocuments({ owner: userId }),
      Property.countDocuments({ owner: userId }),
      Store.countDocuments({ owner: userId }),
      Conversation.countDocuments({
        $or: [{ buyerId: userId }, { sellerId: userId }],
      }),
    ]);

    return res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        roles: user.roles || [],
        accountStatus: user.accountStatus || "active",
        suspendedAt: user.suspendedAt,
        bannedAt: user.bannedAt,
        suspensionReason: user.suspensionReason,
        banReason: user.banReason,
        disabledRoles: user.disabledRoles || [],
        verificationStatus: user.verificationStatus,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastSeen: user.lastSeen,
        hasEcommerceSeller: user.roles?.includes("ecommerceSeller") || false,
        hasRealEstateSeller: user.roles?.includes("realEstateSeller") || false,
        isBuyer: !user.roles?.some((r) =>
          ["ecommerceSeller", "realEstateSeller"].includes(r)
        ),
      },
      activity: {
        productsCount,
        propertiesCount,
        storesCount,
        conversationsCount,
      },
    });
  } catch (error) {
    console.error("getUserDetails error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get user details",
    });
  }
};

// Suspend user (Admin only)
export const suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Suspension reason is required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.accountStatus === "suspended") {
      return res.status(400).json({
        success: false,
        message: "User is already suspended",
      });
    }

    // Update user
    user.accountStatus = "suspended";
    user.suspendedAt = new Date();
    user.suspensionReason = reason;
    await user.save();

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: "user_suspended",
        targetType: "user",
        targetId: user._id,
        details: {
          userId: user._id.toString(),
          userEmail: user.email,
          userName: user.name,
          reason: reason,
        },
        reason: reason,
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
    }

    return res.json({
      success: true,
      message: "User suspended successfully",
      user: {
        _id: user._id,
        email: user.email,
        accountStatus: user.accountStatus,
      },
    });
  } catch (error) {
    console.error("suspendUser error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to suspend user",
    });
  }
};

// Ban user (Admin only)
export const banUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Ban reason is required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.accountStatus === "banned") {
      return res.status(400).json({
        success: false,
        message: "User is already banned",
      });
    }

    // Update user
    user.accountStatus = "banned";
    user.bannedAt = new Date();
    user.banReason = reason;
    await user.save();

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: "user_banned",
        targetType: "user",
        targetId: user._id,
        details: {
          userId: user._id.toString(),
          userEmail: user.email,
          userName: user.name,
          reason: reason,
        },
        reason: reason,
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
    }

    return res.json({
      success: true,
      message: "User banned successfully",
      user: {
        _id: user._id,
        email: user.email,
        accountStatus: user.accountStatus,
      },
    });
  } catch (error) {
    console.error("banUser error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to ban user",
    });
  }
};

// Reactivate user (Admin only)
export const reactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.accountStatus === "active") {
      return res.status(400).json({
        success: false,
        message: "User is already active",
      });
    }

    // Update user
    const previousStatus = user.accountStatus;
    user.accountStatus = "active";
    user.suspendedAt = null;
    user.bannedAt = null;
    user.suspensionReason = null;
    user.banReason = null;
    await user.save();

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: "user_reactivated",
        targetType: "user",
        targetId: user._id,
        details: {
          userId: user._id.toString(),
          userEmail: user.email,
          userName: user.name,
          previousStatus: previousStatus,
        },
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
    }

    return res.json({
      success: true,
      message: "User reactivated successfully",
      user: {
        _id: user._id,
        email: user.email,
        accountStatus: user.accountStatus,
      },
    });
  } catch (error) {
    console.error("reactivateUser error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to reactivate user",
    });
  }
};

// Disable user role (Admin only)
export const disableUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    if (!role || !["ecommerceSeller", "realEstateSeller"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Valid role (ecommerceSeller or realEstateSeller) is required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.roles?.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `User does not have the role: ${role}`,
      });
    }

    // Add role to disabledRoles if not already there
    if (!user.disabledRoles?.includes(role)) {
      user.disabledRoles = [...(user.disabledRoles || []), role];
      await user.save();
    }

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: "user_role_disabled",
        targetType: "user",
        targetId: user._id,
        details: {
          userId: user._id.toString(),
          userEmail: user.email,
          userName: user.name,
          disabledRole: role,
        },
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
    }

    return res.json({
      success: true,
      message: `User role ${role} disabled successfully`,
      user: {
        _id: user._id,
        email: user.email,
        disabledRoles: user.disabledRoles,
      },
    });
  } catch (error) {
    console.error("disableUserRole error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to disable user role",
    });
  }
};

// Enable user role (Admin only)
export const enableUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    if (!role || !["ecommerceSeller", "realEstateSeller"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Valid role (ecommerceSeller or realEstateSeller) is required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Remove role from disabledRoles
    if (user.disabledRoles?.includes(role)) {
      user.disabledRoles = user.disabledRoles.filter((r) => r !== role);
      await user.save();
    }

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: "user_role_enabled",
        targetType: "user",
        targetId: user._id,
        details: {
          userId: user._id.toString(),
          userEmail: user.email,
          userName: user.name,
          enabledRole: role,
        },
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
    }

    return res.json({
      success: true,
      message: `User role ${role} enabled successfully`,
      user: {
        _id: user._id,
        email: user.email,
        disabledRoles: user.disabledRoles,
      },
    });
  } catch (error) {
    console.error("enableUserRole error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to enable user role",
    });
  }
};

