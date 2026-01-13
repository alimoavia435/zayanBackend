import User from "../model/User.js";
import AdminActionLog from "../model/AdminActionLog.js";
import { createNotification } from "./notificationController.js";

// Get verification requests with filters (Admin only)
export const getVerificationRequests = async (req, res) => {
  try {
    const { status } = req.query;

    // Build query
    const query = {
      roles: { $in: ["ecommerceSeller", "realEstateSeller"] },
      verificationStatus: { $in: ["pending", "approved", "rejected"] }, // Only include users with a verification status
    };

    // Add status filter if provided
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      query.verificationStatus = status;
    }
    // If no status filter, show all verification requests (all statuses)

    // Find users with verification requests
    const users = await User.find(query)
      .select(
        "name email firstName lastName roles verificationStatus verificationDocuments createdAt updatedAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    // Transform to include role info
    const requests = users.map((user) => ({
      _id: user._id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles: user.roles,
      verificationStatus: user.verificationStatus,
      verificationDocuments: user.verificationDocuments || [],
      submittedAt: user.createdAt,
      updatedAt: user.updatedAt,
      hasEcommerceSeller: user.roles?.includes("ecommerceSeller") || false,
      hasRealEstateSeller: user.roles?.includes("realEstateSeller") || false,
    }));

    // Get counts for each status
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      User.countDocuments({
        verificationStatus: "pending",
        roles: { $in: ["ecommerceSeller", "realEstateSeller"] },
      }),
      User.countDocuments({
        verificationStatus: "approved",
        roles: { $in: ["ecommerceSeller", "realEstateSeller"] },
      }),
      User.countDocuments({
        verificationStatus: "rejected",
        roles: { $in: ["ecommerceSeller", "realEstateSeller"] },
      }),
    ]);

    return res.json({
      success: true,
      requests,
      count: requests.length,
      counts: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        total: pendingCount + approvedCount + rejectedCount,
      },
    });
  } catch (error) {
    console.error("getVerificationRequests error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get verification requests",
    });
  }
};

// Get single verification request details (Admin only)
export const getVerificationDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const user = await User.findById(userId)
      .select(
        "name email firstName lastName roles verificationStatus verificationDocuments createdAt updatedAt phone bio specialization agency certifications"
      )
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is a seller/agent
    const hasSellerRole = user.roles?.some(
      (role) => role === "ecommerceSeller" || role === "realEstateSeller"
    );

    if (!hasSellerRole) {
      return res.status(400).json({
        success: false,
        message: "User is not a seller or agent",
      });
    }

    return res.json({
      success: true,
      request: {
        _id: user._id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        bio: user.bio,
        specialization: user.specialization,
        agency: user.agency,
        certifications: user.certifications,
        roles: user.roles,
        verificationStatus: user.verificationStatus,
        verificationDocuments: user.verificationDocuments || [],
        submittedAt: user.createdAt,
        updatedAt: user.updatedAt,
        hasEcommerceSeller: user.roles?.includes("ecommerceSeller") || false,
        hasRealEstateSeller: user.roles?.includes("realEstateSeller") || false,
      },
    });
  } catch (error) {
    console.error("getVerificationDetails error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get verification details",
    });
  }
};

// Approve verification (Admin only)
export const approveVerification = async (req, res) => {
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

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.verificationStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: `User verification status is ${user.verificationStatus}, cannot approve`,
      });
    }

    // Update user verification status
    user.verificationStatus = "approved";
    user.isVerified = true;
    await user.save();

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: "verification_approved",
        targetType: "verification",
        targetId: user._id,
        details: {
          userId: user._id.toString(),
          userEmail: user.email,
          userName: user.name,
          roles: user.roles,
          reason: reason || null,
        },
        reason: reason || null,
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
      // Don't fail the approval if logging fails
    }

    // Create notification for user
    const io = req.app?.get("io");
    try {
      await createNotification({
        userId: user._id,
        type: "verification_approved",
        title: "Verification Approved",
        message:
          "Congratulations! Your seller/agent verification has been approved. You can now display the verified badge on your profile.",
        actionUrl: "/settings",
        metadata: {
          verificationStatus: "approved",
          reason: reason || null,
        },
        relatedId: user._id,
        relatedType: "verification",
        sendEmail: true,
        io,
      });
    } catch (notifError) {
      console.error(
        "Failed to create notification for verification approval:",
        notifError
      );
      // Don't fail verification if notification fails
    }

    return res.json({
      success: true,
      message: "Verification approved successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        verificationStatus: user.verificationStatus,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("approveVerification error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to approve verification",
    });
  }
};

// Reject verification (Admin only)
export const rejectVerification = async (req, res) => {
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
        message: "Rejection reason is required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.verificationStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: `User verification status is ${user.verificationStatus}, cannot reject`,
      });
    }

    // Update user verification status
    user.verificationStatus = "rejected";
    user.isVerified = false;
    await user.save();

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: "verification_rejected",
        targetType: "verification",
        targetId: user._id,
        details: {
          userId: user._id.toString(),
          userEmail: user.email,
          userName: user.name,
          roles: user.roles,
          reason: reason,
        },
        reason: reason,
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
      // Don't fail the rejection if logging fails
    }

    // Create notification for user
    const io = req.app?.get("io");
    try {
      await createNotification({
        userId: user._id,
        type: "verification_rejected",
        title: "Verification Rejected",
        message: `Your verification request has been rejected. Reason: ${reason}. Please review the requirements and resubmit.`,
        actionUrl: "/settings",
        metadata: {
          verificationStatus: "rejected",
          reason: reason,
        },
        relatedId: user._id,
        relatedType: "verification",
        sendEmail: true,
        io,
      });
    } catch (notifError) {
      console.error(
        "Failed to create notification for verification rejection:",
        notifError
      );
      // Don't fail verification if notification fails
    }

    return res.json({
      success: true,
      message: "Verification rejected successfully",
      reason: reason,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        verificationStatus: user.verificationStatus,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("rejectVerification error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to reject verification",
    });
  }
};

