import SavedSearch from "../model/SavedSearch.js";
import Product from "../model/Product.js";
import Property from "../model/Property.js";
import { createNotification } from "./notificationController.js";
import mongoose from "mongoose";

// Create or update saved search
export const saveSearch = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { itemType, name, searchQuery, filters, alertsEnabled, alertFrequency } = req.body;

    if (!itemType || !["product", "property"].includes(itemType)) {
      return res.status(400).json({ message: "itemType must be 'product' or 'property'" });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: "name is required" });
    }

    const savedSearch = await SavedSearch.create({
      userId,
      itemType,
      name: name.trim(),
      searchQuery: searchQuery || "",
      filters: filters || {},
      alertsEnabled: alertsEnabled !== undefined ? alertsEnabled : true,
      alertFrequency: alertFrequency || "daily",
    });

    return res.status(201).json({
      message: "Search saved successfully",
      savedSearch,
    });
  } catch (error) {
    console.error("saveSearch error", error);
    return res.status(500).json({ message: "Failed to save search" });
  }
};

// Get user's saved searches
export const getSavedSearches = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { itemType, active } = req.query;

    const filter = { userId };
    if (itemType && ["product", "property"].includes(itemType)) {
      filter.itemType = itemType;
    }
    if (active !== undefined) {
      filter.active = active === "true";
    }

    const savedSearches = await SavedSearch.find(filter).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      message: "Saved searches retrieved successfully",
      savedSearches,
    });
  } catch (error) {
    console.error("getSavedSearches error", error);
    return res.status(500).json({ message: "Failed to retrieve saved searches" });
  }
};

// Update saved search
export const updateSavedSearch = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { searchId } = req.params;
    const { name, searchQuery, filters, alertsEnabled, alertFrequency, active } = req.body;

    const savedSearch = await SavedSearch.findOne({ _id: searchId, userId });
    if (!savedSearch) {
      return res.status(404).json({ message: "Saved search not found" });
    }

    if (name !== undefined) savedSearch.name = name.trim();
    if (searchQuery !== undefined) savedSearch.searchQuery = searchQuery;
    if (filters !== undefined) savedSearch.filters = filters;
    if (alertsEnabled !== undefined) savedSearch.alertsEnabled = alertsEnabled;
    if (alertFrequency !== undefined) savedSearch.alertFrequency = alertFrequency;
    if (active !== undefined) savedSearch.active = active;

    await savedSearch.save();

    return res.status(200).json({
      message: "Saved search updated successfully",
      savedSearch,
    });
  } catch (error) {
    console.error("updateSavedSearch error", error);
    return res.status(500).json({ message: "Failed to update saved search" });
  }
};

// Delete saved search
export const deleteSavedSearch = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { searchId } = req.params;

    const savedSearch = await SavedSearch.findOneAndDelete({ _id: searchId, userId });
    if (!savedSearch) {
      return res.status(404).json({ message: "Saved search not found" });
    }

    return res.status(200).json({
      message: "Saved search deleted successfully",
    });
  } catch (error) {
    console.error("deleteSavedSearch error", error);
    return res.status(500).json({ message: "Failed to delete saved search" });
  }
};

// Check saved searches for new matches (to be called by a scheduled job)
export const checkSavedSearchAlerts = async (searchId = null) => {
  try {
    const filter = {
      active: true,
      alertsEnabled: true,
    };
    if (searchId) {
      filter._id = searchId;
    }

    const savedSearches = await SavedSearch.find(filter).lean();

    for (const search of savedSearches) {
      try {
        // Build query from saved search
        const query = {};
        
        // Text search
        if (search.searchQuery && search.searchQuery.trim()) {
          if (search.itemType === "product") {
            query.$or = [
              { name: { $regex: search.searchQuery, $options: "i" } },
              { description: { $regex: search.searchQuery, $options: "i" } },
            ];
          } else {
            query.$or = [
              { title: { $regex: search.searchQuery, $options: "i" } },
              { description: { $regex: search.searchQuery, $options: "i" } },
            ];
          }
        }

        // Apply filters
        if (search.filters && Object.keys(search.filters).length > 0) {
          Object.entries(search.filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== "") {
              if (key === "priceMin" || key === "priceMax") {
                if (!query.price) query.price = {};
                if (key === "priceMin") query.price.$gte = value;
                if (key === "priceMax") query.price.$lte = value;
              } else if (key === "category" || key === "propertyType") {
                query[key] = value;
              } else if (key === "city" || key === "state" || key === "location") {
                query[key] = { $regex: value, $options: "i" };
              } else {
                query[key] = value;
              }
            }
          });
        }

        // Only get items created after last alert (or all if never alerted)
        if (search.lastAlertSent) {
          query.createdAt = { $gt: search.lastAlertSent };
        }

        let newItems = [];
        if (search.itemType === "product") {
          newItems = await Product.find(query)
            .select("_id name images price createdAt")
            .limit(20)
            .lean();
        } else {
          newItems = await Property.find(query)
            .select("_id title images price createdAt")
            .limit(20)
            .lean();
        }

        if (newItems.length > 0) {
          // Update last alert time
          await SavedSearch.findByIdAndUpdate(search._id, {
            lastAlertSent: new Date(),
            lastNewItemsCount: newItems.length,
          });

          // Send notification
          const io = null; // Would need to be passed or obtained differently in scheduled context
          await createNotification({
            userId: search.userId,
            type: "listing_inquiry", // Reusing this type for search alerts
            title: "New Matches for Your Saved Search",
            message: `We found ${newItems.length} new ${search.itemType}${newItems.length > 1 ? "s" : ""} matching "${search.name}"`,
            actionUrl: `/saved-searches/${search._id}`,
            metadata: {
              searchId: search._id.toString(),
              itemType: search.itemType,
              newItemsCount: newItems.length,
            },
            relatedId: search._id,
            relatedType: "product", // or property
            sendEmail: search.alertFrequency === "real-time",
            io,
          });
        }
      } catch (searchError) {
        console.error(`Error processing saved search ${search._id}:`, searchError);
        // Continue with next search
      }
    }

    return { processed: savedSearches.length };
  } catch (error) {
    console.error("checkSavedSearchAlerts error", error);
    throw error;
  }
};

// Manual trigger for checking alerts (admin/self-service)
export const triggerSavedSearchCheck = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { searchId } = req.params;

    // Only allow users to check their own searches
    const search = await SavedSearch.findOne({ _id: searchId, userId });
    if (!search) {
      return res.status(404).json({ message: "Saved search not found" });
    }

    await checkSavedSearchAlerts(searchId);

    return res.status(200).json({
      message: "Search alert check completed",
    });
  } catch (error) {
    console.error("triggerSavedSearchCheck error", error);
    return res.status(500).json({ message: "Failed to check saved search alerts" });
  }
};

