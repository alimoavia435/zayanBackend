import User from "../model/User.js";
import Property from "../model/Property.js";
import Product from "../model/Product.js";
import Conversation from "../model/Conversation.js";

// @desc    Get admin dashboard statistics
// @route   GET /api/admin/dashboard/stats
// @access  Private (Admin)
export const getDashboardStats = async (req, res) => {
  try {
    // Get start of today for "active chats today"
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Run all queries in parallel for better performance
    const [
      totalUsers,
      totalSellers,
      totalProperties,
      totalProducts,
      pendingVerifications,
      activeChatsToday,
    ] = await Promise.all([
      // Total users (all users)
      User.countDocuments({}),

      // Total sellers (users with ecommerceSeller or realEstateSeller role)
      User.countDocuments({
        roles: { $in: ["ecommerceSeller", "realEstateSeller"] },
      }),

      // Total properties (active)
      Property.countDocuments({ status: "active" }),

      // Total products (active)
      Product.countDocuments({ status: "active" }),

      // Pending verifications
      User.countDocuments({ verificationStatus: "pending" }),

      // Active chats today (conversations created or updated today)
      Conversation.countDocuments({
        $or: [
          { createdAt: { $gte: startOfToday } },
          { updatedAt: { $gte: startOfToday } },
        ],
      }),
    ]);

    // Revenue summary (future-ready - placeholder for now)
    const revenueSummary = {
      total: 0,
      thisMonth: 0,
      lastMonth: 0,
      growth: 0,
    };

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalSellers,
        totalProperties,
        totalProducts,
        pendingVerifications,
        activeChatsToday,
        revenueSummary,
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch dashboard statistics",
    });
  }
};

