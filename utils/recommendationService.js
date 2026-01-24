import UserBehavior from "../model/UserBehavior.js";
import Product from "../model/Product.js";
import Property from "../model/Property.js";
import FeaturedListing from "../model/FeaturedListing.js";
import mongoose from "mongoose";

// Get trending items based on recent activity
export const getTrendingItems = async (itemType, limit = 10, days = 7) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Aggregate behavior data to find trending items
    const trendingData = await UserBehavior.aggregate([
      {
        $match: {
          itemType,
          action: { $in: ["view", "click", "like", "message"] },
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: "$itemId",
          viewCount: {
            $sum: { $cond: [{ $eq: ["$action", "view"] }, 1, 0] },
          },
          clickCount: {
            $sum: { $cond: [{ $eq: ["$action", "click"] }, 1, 0] },
          },
          likeCount: {
            $sum: { $cond: [{ $eq: ["$action", "like"] }, 1, 0] },
          },
          messageCount: {
            $sum: { $cond: [{ $eq: ["$action", "message"] }, 1, 0] },
          },
          totalScore: {
            $sum: {
              $cond: [
                { $eq: ["$action", "view"] },
                1,
                {
                  $cond: [
                    { $eq: ["$action", "click"] },
                    2,
                    {
                      $cond: [
                        { $eq: ["$action", "like"] },
                        3,
                        { $cond: [{ $eq: ["$action", "message"] }, 5, 0] },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      { $sort: { totalScore: -1 } },
      { $limit: limit },
    ]);

    const itemIds = trendingData.map((item) => item._id);

    let items = [];
    if (itemType === "product") {
      items = await Product.find({ _id: { $in: itemIds } })
        .populate("owner", "name firstName lastName avatar")
        .populate("store", "name location")
        .lean();
    } else if (itemType === "property") {
      items = await Property.find({ _id: { $in: itemIds } })
        .populate("owner", "name firstName lastName avatar")
        .lean();
    }

    // Get active featured/boosted listings
    const now = new Date();
    const featuredListings = await FeaturedListing.find({
      itemType,
      endDate: { $gte: now },
      startDate: { $lte: now },
    }).lean();

    // Create a map of itemId -> priorityScore
    const featuredMap = new Map();
    featuredListings.forEach((featured) => {
      const itemIdStr = featured.itemId.toString();
      const currentScore = featuredMap.get(itemIdStr) || 0;
      // Use the higher priority score if multiple featured entries exist
      featuredMap.set(itemIdStr, Math.max(currentScore, featured.priorityScore));
    });

    // Merge items with their scores and maintain order, applying featured/boosted boosts
    const itemsWithScores = trendingData
      .map((trending) => {
        const item = items.find(
          (i) => i._id.toString() === trending._id.toString()
        );
        if (!item) return null;

        const itemIdStr = item._id.toString();
        const featuredBoost = featuredMap.get(itemIdStr) || 0;
        const finalScore = trending.totalScore + featuredBoost;

        return {
          ...item,
          trendingScore: finalScore,
          baseScore: trending.totalScore,
          featuredBoost,
          viewCount: trending.viewCount,
          clickCount: trending.clickCount,
          likeCount: trending.likeCount,
          messageCount: trending.messageCount,
          isFeatured: featuredBoost > 0,
          isBoosted: featuredListings.find(
            (f) => f.itemId.toString() === itemIdStr && f.isBoosted
          ) !== undefined,
        };
      })
      .filter((item) => item !== null)
      .sort((a, b) => b.trendingScore - a.trendingScore); // Re-sort with boosted scores

    return itemsWithScores.slice(0, limit);
  } catch (error) {
    console.error("getTrendingItems error", error);
    return [];
  }
};

// Get recommendations based on user behavior
export const getRecommendations = async (userId, itemType, limit = 10) => {
  try {
    if (!userId) {
      return [];
    }

    // Get user's behavior patterns
    const userBehavior = await UserBehavior.find({
      userId,
      itemType,
      action: { $in: ["view", "like", "message"] },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    if (userBehavior.length === 0) {
      // No behavior data, return trending items as fallback
      return await getTrendingItems(itemType, limit);
    }

    // Extract categories, price ranges, and locations from viewed items
    const viewedItemIds = [...new Set(userBehavior.map((b) => b.itemId.toString()))];

    let items = [];
    if (itemType === "product") {
      items = await Product.find({ _id: { $in: viewedItemIds } })
        .select("category price currency location city state")
        .lean();
    } else if (itemType === "property") {
      items = await Property.find({ _id: { $in: viewedItemIds } })
        .select("propertyType price city state location")
        .lean();
    }

    // Analyze preferences
    const categories = {};
    const priceRanges = [];
    const locations = new Set();

    items.forEach((item) => {
      // Categories
      const category = itemType === "product" ? item.category : item.propertyType;
      if (category) {
        categories[category] = (categories[category] || 0) + 1;
      }

      // Price ranges
      if (item.price) {
        priceRanges.push(item.price);
      }

      // Locations
      if (item.city) locations.add(item.city);
      if (item.state) locations.add(item.state);
      if (item.location) locations.add(item.location);
    });

    // Get top preferred categories
    const topCategories = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => category);

    // Calculate price range
    const avgPrice = priceRanges.length > 0
      ? priceRanges.reduce((a, b) => a + b, 0) / priceRanges.length
      : null;
    const priceMin = avgPrice ? avgPrice * 0.5 : null;
    const priceMax = avgPrice ? avgPrice * 1.5 : null;

    // Build recommendation query
    const query = {
      _id: { $nin: viewedItemIds }, // Exclude already viewed items
    };

    if (topCategories.length > 0) {
      if (itemType === "product") {
        query.category = { $in: topCategories };
      } else {
        query.propertyType = { $in: topCategories };
      }
    }

    if (priceMin && priceMax) {
      query.price = { $gte: priceMin, $lte: priceMax };
    }

    if (locations.size > 0) {
      const locationArray = Array.from(locations);
      query.$or = [
        { city: { $in: locationArray } },
        { state: { $in: locationArray } },
        { location: { $in: locationArray } },
      ];
    }

    // Get active featured/boosted listings for boosting recommendations
    const now = new Date();
    const featuredListings = await FeaturedListing.find({
      itemType,
      endDate: { $gte: now },
      startDate: { $lte: now },
    }).lean();

    const featuredMap = new Map();
    featuredListings.forEach((featured) => {
      const itemIdStr = featured.itemId.toString();
      const currentScore = featuredMap.get(itemIdStr) || 0;
      featuredMap.set(itemIdStr, Math.max(currentScore, featured.priorityScore));
    });

    // Get recommended items
    let recommendedItems = [];
    if (itemType === "product") {
      recommendedItems = await Product.find(query)
        .populate("owner", "name firstName lastName avatar")
        .populate("store", "name location")
        .sort({ rating: -1, createdAt: -1 })
        .limit(limit * 2) // Get more to allow for re-sorting
        .lean();
    } else if (itemType === "property") {
      recommendedItems = await Property.find(query)
        .populate("owner", "name firstName lastName avatar")
        .sort({ rating: -1, views: -1, createdAt: -1 })
        .limit(limit * 2) // Get more to allow for re-sorting
        .lean();
    }

    // Apply featured/boosted priority boost and re-sort
    recommendedItems = recommendedItems
      .map((item) => {
        const itemIdStr = item._id.toString();
        const featuredBoost = featuredMap.get(itemIdStr) || 0;
        return {
          ...item,
          featuredBoost,
          isFeatured: featuredBoost > 0,
          isBoosted: featuredListings.find(
            (f) => f.itemId.toString() === itemIdStr && f.isBoosted
          ) !== undefined,
          // Add a sort score that includes featured boost
          sortScore: (item.rating || 0) + featuredBoost,
        };
      })
      .sort((a, b) => b.sortScore - a.sortScore)
      .slice(0, limit);

    // If not enough recommendations, fill with trending items
    if (recommendedItems.length < limit) {
      const trendingItems = await getTrendingItems(
        itemType,
        limit - recommendedItems.length
      );
      const trendingIds = recommendedItems.map((item) => item._id.toString());
      const additionalTrending = trendingItems.filter(
        (item) => !trendingIds.includes(item._id.toString())
      );
      recommendedItems = [...recommendedItems, ...additionalTrending.slice(0, limit - recommendedItems.length)];
    }

    return recommendedItems.slice(0, limit);
  } catch (error) {
    console.error("getRecommendations error", error);
    // Fallback to trending items on error
    return await getTrendingItems(itemType, limit);
  }
};

// Get similar items based on an item
export const getSimilarItems = async (itemId, itemType, limit = 8) => {
  try {
    let item = null;
    if (itemType === "product") {
      item = await Product.findById(itemId).lean();
    } else if (itemType === "property") {
      item = await Property.findById(itemId).lean();
    }

    if (!item) {
      return [];
    }

    const query = {
      _id: { $ne: itemId },
    };

    // Match by category/type
    if (itemType === "product") {
      if (item.category) {
        query.category = item.category;
      }
    } else {
      if (item.propertyType) {
        query.propertyType = item.propertyType;
      }
    }

    // Match by price range (±30%)
    if (item.price) {
      query.price = {
        $gte: item.price * 0.7,
        $lte: item.price * 1.3,
      };
    }

    // Match by location if available
    if (item.city || item.state) {
      query.$or = [];
      if (item.city) query.$or.push({ city: item.city });
      if (item.state) query.$or.push({ state: item.state });
    }

    let similarItems = [];
    if (itemType === "product") {
      similarItems = await Product.find(query)
        .populate("owner", "name firstName lastName avatar")
        .populate("store", "name location")
        .sort({ rating: -1, createdAt: -1 })
        .limit(limit)
        .lean();
    } else if (itemType === "property") {
      similarItems = await Property.find(query)
        .populate("owner", "name firstName lastName avatar")
        .sort({ rating: -1, views: -1, createdAt: -1 })
        .limit(limit)
        .lean();
    }

    return similarItems;
  } catch (error) {
    console.error("getSimilarItems error", error);
    return [];
  }
};

