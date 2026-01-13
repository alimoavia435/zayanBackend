import UserBehavior from "../model/UserBehavior.js";
import mongoose from "mongoose";

// Track user behavior
export const trackBehavior = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { itemType, itemId, action, metadata, searchQuery, searchFilters, sessionId } = req.body;

    if (!itemType || !itemId || !action) {
      return res.status(400).json({ message: "itemType, itemId, and action are required" });
    }

    // Validate itemType
    if (!["product", "property"].includes(itemType)) {
      return res.status(400).json({ message: "itemType must be 'product' or 'property'" });
    }

    // Validate action
    if (!["view", "click", "like", "share", "save", "message", "search"].includes(action)) {
      return res.status(400).json({ message: "Invalid action" });
    }

    const behavior = await UserBehavior.create({
      userId,
      itemType,
      itemId,
      action,
      metadata: metadata || {},
      searchQuery: searchQuery || null,
      searchFilters: searchFilters || {},
      sessionId: sessionId || null,
    });

    return res.status(201).json({
      message: "Behavior tracked successfully",
      behavior,
    });
  } catch (error) {
    console.error("trackBehavior error", error);
    return res.status(500).json({ message: "Failed to track behavior" });
  }
};

// Get recently viewed items
export const getRecentlyViewed = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { itemType, limit = 20 } = req.query;

    const filter = {
      userId,
      action: "view",
    };

    if (itemType && ["product", "property"].includes(itemType)) {
      filter.itemType = itemType;
    }

    // Get unique recently viewed items (most recent view per item)
    const recentViews = await UserBehavior.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: { itemType: "$itemType", itemId: "$itemId" },
          lastViewedAt: { $first: "$createdAt" },
          viewCount: { $sum: 1 },
        },
      },
      { $sort: { lastViewedAt: -1 } },
      { $limit: parseInt(limit) },
    ]);

    const items = recentViews.map((view) => ({
      itemType: view._id.itemType,
      itemId: view._id.itemId,
      lastViewedAt: view.lastViewedAt,
      viewCount: view.viewCount,
    }));

    return res.status(200).json({
      message: "Recently viewed items retrieved successfully",
      items,
    });
  } catch (error) {
    console.error("getRecentlyViewed error", error);
    return res.status(500).json({ message: "Failed to retrieve recently viewed items" });
  }
};

// Get user behavior insights
export const getUserBehaviorInsights = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const insights = await UserBehavior.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            itemType: "$itemType",
            action: "$action",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const formattedInsights = {
      totalActions: 0,
      byType: { product: 0, property: 0 },
      byAction: {},
    };

    insights.forEach((insight) => {
      formattedInsights.totalActions += insight.count;
      formattedInsights.byType[insight._id.itemType] =
        (formattedInsights.byType[insight._id.itemType] || 0) + insight.count;
      formattedInsights.byAction[insight._id.action] =
        (formattedInsights.byAction[insight._id.action] || 0) + insight.count;
    });

    return res.status(200).json({
      message: "User behavior insights retrieved successfully",
      insights: formattedInsights,
      period: `${days} days`,
    });
  } catch (error) {
    console.error("getUserBehaviorInsights error", error);
    return res.status(500).json({ message: "Failed to retrieve behavior insights" });
  }
};

