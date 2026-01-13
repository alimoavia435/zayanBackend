import User from "../model/User.js";
import { createNotification } from "./notificationController.js";

// Submit verification documents (Seller/Agent)
export const submitVerification = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { verificationDocuments } = req.body;

    if (!verificationDocuments || !Array.isArray(verificationDocuments) || verificationDocuments.length === 0) {
      return res.status(400).json({ message: "At least one verification document is required" });
    }

    // Check if user has seller or agent role
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hasSellerRole = user.roles?.some(role => 
      role === "ecommerceSeller" || role === "realEstateSeller"
    );

    if (!hasSellerRole) {
      return res.status(403).json({ 
        message: "Only sellers and agents can submit verification documents" 
      });
    }

    // Update user verification status and documents
    user.verificationStatus = "pending";
    user.verificationDocuments = verificationDocuments;
    await user.save();

    return res.json({
      message: "Verification documents submitted successfully",
      verificationStatus: user.verificationStatus,
      verificationDocuments: user.verificationDocuments,
    });
  } catch (error) {
    console.error("submitVerification error", error);
    return res.status(500).json({ message: "Failed to submit verification documents" });
  }
};

// Get verification status (for current user)
export const getVerificationStatus = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(userId).select("verificationStatus verificationDocuments isVerified");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is verified (approval means isVerified should be true for seller/agent verification)
    const isSellerAgentVerified = user.verificationStatus === "approved";
    
    return res.json({
      verificationStatus: user.verificationStatus,
      verificationDocuments: user.verificationDocuments || [],
      isVerified: isSellerAgentVerified,
    });
  } catch (error) {
    console.error("getVerificationStatus error", error);
    return res.status(500).json({ message: "Failed to get verification status" });
  }
};

// Get all verification requests (Admin only)
export const getVerificationRequests = async (req, res) => {
  try {
    // Find all users with pending verification who are sellers or agents
    const pendingUsers = await User.find({
      verificationStatus: "pending",
      roles: { $in: ["ecommerceSeller", "realEstateSeller"] },
    })
      .select("name email firstName lastName roles verificationStatus verificationDocuments createdAt")
      .lean();

    // Transform to include role info
    const requests = pendingUsers.map((user) => ({
      _id: user._id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles: user.roles,
      verificationStatus: user.verificationStatus,
      verificationDocuments: user.verificationDocuments || [],
      submittedAt: user.createdAt,
      hasEcommerceSeller: user.roles?.includes("ecommerceSeller") || false,
      hasRealEstateSeller: user.roles?.includes("realEstateSeller") || false,
    }));

    return res.json({
      requests,
      count: requests.length,
    });
  } catch (error) {
    console.error("getVerificationRequests error", error);
    return res.status(500).json({ message: "Failed to get verification requests" });
  }
};

// Approve verification (Admin only)
export const approveVerification = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.verificationStatus !== "pending") {
      return res.status(400).json({ 
        message: `User verification status is ${user.verificationStatus}, cannot approve` 
      });
    }

    user.verificationStatus = "approved";
    user.isVerified = true; // Set isVerified to true for approved sellers/agents
    await user.save();

    // Create notification for user
    const io = req.app?.get("io");
    try {
      await createNotification({
        userId: user._id,
        type: "verification_approved",
        title: "Verification Approved",
        message: "Congratulations! Your seller/agent verification has been approved. You can now display the verified badge on your profile.",
        actionUrl: "/settings",
        metadata: {
          verificationStatus: "approved",
        },
        relatedId: user._id,
        relatedType: "verification",
        sendEmail: true,
        io,
      });
    } catch (notifError) {
      console.error("Failed to create notification for verification approval:", notifError);
      // Don't fail verification if notification fails
    }

    return res.json({
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
    console.error("approveVerification error", error);
    return res.status(500).json({ message: "Failed to approve verification" });
  }
};

// Reject verification (Admin only)
export const rejectVerification = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.verificationStatus !== "pending") {
      return res.status(400).json({ 
        message: `User verification status is ${user.verificationStatus}, cannot reject` 
      });
    }

    user.verificationStatus = "rejected";
    user.isVerified = false;
    await user.save();

    // Create notification for user
    const io = req.app?.get("io");
    try {
      await createNotification({
        userId: user._id,
        type: "verification_rejected",
        title: "Verification Rejected",
        message: `Your verification request has been rejected. ${reason ? `Reason: ${reason}` : "Please review the requirements and resubmit."}`,
        actionUrl: "/settings",
        metadata: {
          verificationStatus: "rejected",
          reason: reason || null,
        },
        relatedId: user._id,
        relatedType: "verification",
        sendEmail: true,
        io,
      });
    } catch (notifError) {
      console.error("Failed to create notification for verification rejection:", notifError);
      // Don't fail verification if notification fails
    }

    return res.json({
      message: "Verification rejected successfully",
      reason: reason || "No reason provided",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        verificationStatus: user.verificationStatus,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("rejectVerification error", error);
    return res.status(500).json({ message: "Failed to reject verification" });
  }
};

