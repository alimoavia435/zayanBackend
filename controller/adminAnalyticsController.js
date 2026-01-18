import User from "../model/User.js";
import Property from "../model/Property.js";
import Product from "../model/Product.js";
import Conversation from "../model/Conversation.js";
import Review from "../model/Review.js";
import AnalyticsEvent from "../model/AnalyticsEvent.js";
import Store from "../model/Store.js";

// Get platform-wide analytics overview (Admin only)
export const getPlatformAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date();
    start.setDate(start.getDate() - 30);

    // Get overall statistics
    const [
      totalUsers,
      totalSellers,
      totalBuyers,
      totalProducts,
      totalProperties,
      totalStores,
      totalConversations,
      totalReviews,
      newUsersThisPeriod,
      newProductsThisPeriod,
      newPropertiesThisPeriod,
      activeUsersThisPeriod,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ roles: { $in: ["ecommerceSeller", "realEstateSeller"] } }),
      User.countDocuments({ roles: { $nin: ["ecommerceSeller", "realEstateSeller"] } }),
      Product.countDocuments({ status: "active" }),
      Property.countDocuments({ status: "active" }),
      Store.countDocuments({ status: "active" }),
      Conversation.countDocuments({}),
      Review.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: start, $lte: end } }),
      Product.countDocuments({ createdAt: { $gte: start, $lte: end }, status: "active" }),
      Property.countDocuments({ createdAt: { $gte: start, $lte: end }, status: "active" }),
      User.countDocuments({ lastSeen: { $gte: start } }),
    ]);

    // Get analytics events statistics
    const eventStats = await AnalyticsEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$eventType",
          count: { $sum: 1 },
        },
      },
    ]);

    const formattedEvents = {
      views: 0,
      clicks: 0,
      chatsStarted: 0,
      messagesSent: 0,
      messagesReceived: 0,
    };

    eventStats.forEach((stat) => {
      if (formattedEvents.hasOwnProperty(stat._id)) {
        formattedEvents[stat._id] = stat.count;
      }
    });

    // Calculate conversion rate
    const conversionRate =
      formattedEvents.views > 0
        ? ((formattedEvents.chatsStarted / formattedEvents.views) * 100).toFixed(2)
        : 0;

    return res.json({
      success: true,
      analytics: {
        overview: {
          totalUsers,
          totalSellers,
          totalBuyers,
          totalProducts,
          totalProperties,
          totalStores,
          totalConversations,
          totalReviews,
        },
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
        growth: {
          newUsers: newUsersThisPeriod,
          newProducts: newProductsThisPeriod,
          newProperties: newPropertiesThisPeriod,
          activeUsers: activeUsersThisPeriod,
        },
        activity: {
          ...formattedEvents,
          conversionRate: parseFloat(conversionRate),
        },
      },
    });
  } catch (error) {
    console.error("getPlatformAnalytics error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get platform analytics",
    });
  }
};

// Get time series data for growth trends (Admin only)
export const getGrowthTrends = async (req, res) => {
  try {
    const { period = "30", groupBy = "day" } = req.query; // period in days, groupBy: day, week, month

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Determine date grouping
    let dateGrouping;
    if (groupBy === "week") {
      dateGrouping = {
        year: { $year: "$createdAt" },
        week: { $week: "$createdAt" },
      };
    } else if (groupBy === "month") {
      dateGrouping = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      };
    } else {
      // day
      dateGrouping = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      };
    }

    // Get user growth
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: dateGrouping,
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1 } },
    ]);

    // Get product growth
    const productGrowth = await Product.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: "active",
        },
      },
      {
        $group: {
          _id: dateGrouping,
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1 } },
    ]);

    // Get property growth
    const propertyGrowth = await Property.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: "active",
        },
      },
      {
        $group: {
          _id: dateGrouping,
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1 } },
    ]);

    return res.json({
      success: true,
      trends: {
        users: userGrowth,
        products: productGrowth,
        properties: propertyGrowth,
      },
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        groupBy,
      },
    });
  } catch (error) {
    console.error("getGrowthTrends error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get growth trends",
    });
  }
};

// Get activity metrics over time (Admin only)
export const getActivityMetrics = async (req, res) => {
  try {
    const { period = "30", groupBy = "day" } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    let dateGrouping;
    if (groupBy === "week") {
      dateGrouping = {
        year: { $year: "$createdAt" },
        week: { $week: "$createdAt" },
      };
    } else if (groupBy === "month") {
      dateGrouping = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      };
    } else {
      dateGrouping = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      };
    }

    // Get activity by event type
    const activityData = await AnalyticsEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            ...dateGrouping,
            eventType: "$eventType",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1 } },
    ]);

    return res.json({
      success: true,
      activity: activityData,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        groupBy,
      },
    });
  } catch (error) {
    console.error("getActivityMetrics error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get activity metrics",
    });
  }
};

