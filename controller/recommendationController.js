import { getTrendingItems, getRecommendations, getSimilarItems } from "../utils/recommendationService.js";
import { getRecentlyViewed } from "./behaviorController.js";

// Get trending items
export const getTrending = async (req, res) => {
  try {
    const { itemType, limit = 10, days = 7 } = req.query;

    if (!itemType || !["product", "property"].includes(itemType)) {
      return res.status(400).json({ message: "itemType must be 'product' or 'property'" });
    }

    const trending = await getTrendingItems(itemType, parseInt(limit), parseInt(days));

    return res.status(200).json({
      message: "Trending items retrieved successfully",
      items: trending,
      itemType,
    });
  } catch (error) {
    console.error("getTrending error", error);
    return res.status(500).json({ message: "Failed to retrieve trending items" });
  }
};

// Get personalized recommendations
export const getPersonalizedRecommendations = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { itemType, limit = 10 } = req.query;

    if (!itemType || !["product", "property"].includes(itemType)) {
      return res.status(400).json({ message: "itemType must be 'product' or 'property'" });
    }

    const recommendations = await getRecommendations(userId, itemType, parseInt(limit));

    return res.status(200).json({
      message: "Recommendations retrieved successfully",
      items: recommendations,
      itemType,
    });
  } catch (error) {
    console.error("getPersonalizedRecommendations error", error);
    return res.status(500).json({ message: "Failed to retrieve recommendations" });
  }
};

// Get similar items
export const getSimilar = async (req, res) => {
  try {
    const { itemId, itemType, limit = 8 } = req.query;

    if (!itemId || !itemType || !["product", "property"].includes(itemType)) {
      return res.status(400).json({ message: "itemId and itemType are required" });
    }

    const similar = await getSimilarItems(itemId, itemType, parseInt(limit));

    return res.status(200).json({
      message: "Similar items retrieved successfully",
      items: similar,
      itemType,
    });
  } catch (error) {
    console.error("getSimilar error", error);
    return res.status(500).json({ message: "Failed to retrieve similar items" });
  }
};

