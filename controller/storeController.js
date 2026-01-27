import Store from "../model/Store.js";
import Product from "../model/Product.js";
import Category from "../model/Category.js";
import UserSubscription from "../model/UserSubscription.js";
import SubscriptionPlan from "../model/SubscriptionPlan.js";
import { updateStoreRating } from "./productController.js";
import { buildProfileResponse } from "./profileController.js";

export const createStore = async (req, res) => {
  try {
    const { name, description, location, bannerImage } = req.body;

    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!name || !description || !location) {
      return res.status(400).json({
        message: "Please provide name, description, and location",
      });
    }

    // Use bannerImage if provided and not empty, otherwise use default emoji
    const finalBannerImage =
      bannerImage && bannerImage.trim() !== "" ? bannerImage : "🏪";

    // Check subscription limits for ecommerceSeller role
    const userId = req.user._id;
    const subscription = await UserSubscription.findOne({
      userId,
      role: "ecommerceSeller",
      status: "active",
    }).populate("planId");

    if (subscription) {
      // Check if subscription is still valid
      const now = new Date();
      if (subscription.endDate < now) {
        subscription.status = "expired";
        await subscription.save();
        return res.status(403).json({
          message:
            "Your subscription has expired. Please renew to create more stores.",
        });
      } else {
        // Check store limit
        const maxStores = subscription.planId.features.maxStores || 1;
        const currentStoreCount = await Store.countDocuments({ owner: userId });

        if (currentStoreCount >= maxStores) {
          return res.status(403).json({
            message: `You have reached your store limit of ${maxStores} store(s). Please upgrade your plan to create more stores.`,
            limit: maxStores,
            current: currentStoreCount,
          });
        }
      }
    } else {
      // Fallback: check for a free Basic plan to allow 1 store
      const basicPlan = await SubscriptionPlan.findOne({
        name: "Basic",
        targetRole: { $in: ["ecommerceSeller", "both"] },
        isActive: true,
      });

      const currentStoreCount = await Store.countDocuments({ owner: userId });
      const limit = basicPlan?.features?.maxStores || 1;

      if (currentStoreCount >= limit) {
        return res.status(403).json({
          message: `You have reached the free store limit of ${limit} store(s). Please subscribe to a plan to create more stores.`,
          limit: limit,
          current: currentStoreCount,
        });
      }
    }

    const store = await Store.create({
      owner: req.user._id,
      name,
      description,
      location,
      bannerImage: finalBannerImage,
    });

    // Update subscription usage if subscription exists
    if (subscription && subscription.status === "active") {
      subscription.usage.storesUsed = (subscription.usage.storesUsed || 0) + 1;
      await subscription.save();
    }

    return res.status(201).json({
      message: "Store created successfully",
      store,
    });
  } catch (error) {
    console.error("createStore error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Get all stores of the authenticated user
export const getStores = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const stores = await Store.find({ owner: req.user._id }).sort({
      createdAt: -1,
    });

    // Calculate actual product counts for each store
    const storesWithProductCounts = await Promise.all(
      stores.map(async (store) => {
        const productCount = await Product.countDocuments({ store: store._id });
        return {
          ...store.toObject(),
          products: productCount,
        };
      }),
    );

    return res.json({
      message: "Stores fetched successfully",
      count: storesWithProductCounts.length,
      stores: storesWithProductCounts,
    });
  } catch (error) {
    console.error("getStores error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Get store by id
export const getStoreById = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const store = await Store.findOne({
      _id: id,
      owner: req.user._id,
    });

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    // Calculate actual product count for this store
    const productCount = await Product.countDocuments({ store: store._id });

    const storeWithProductCount = {
      ...store.toObject(),
      products: productCount,
    };

    return res.json({
      message: "Store fetched successfully",
      store: storeWithProductCount,
    });
  } catch (error) {
    console.error("getStoreById error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Update store
export const updateStore = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const { name, description, location, bannerImage, status } = req.body;

    const store = await Store.findOne({
      _id: id,
      owner: req.user._id,
    });

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    // Update fields if provided
    if (name !== undefined) store.name = name;
    if (description !== undefined) store.description = description;
    if (location !== undefined) store.location = location;
    if (bannerImage !== undefined) {
      // If bannerImage is provided but empty, use default emoji
      store.bannerImage =
        bannerImage && bannerImage.trim() !== "" ? bannerImage : "🏪";
    }
    if (status !== undefined) store.status = status;

    await store.save();

    return res.json({
      message: "Store updated successfully",
      store,
    });
  } catch (error) {
    console.error("updateStore error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Delete store
export const deleteStore = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const deleted = await Store.findOneAndDelete({
      _id: id,
      owner: req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Store not found" });
    }

    // Cascading delete: Products and Categories related to this store
    await Product.deleteMany({ store: id });
    await Category.deleteMany({ store: id });

    return res.json({
      message:
        "Store and all related products and categories deleted successfully",
    });
  } catch (error) {
    console.error("deleteStore error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Get all stores for buyer (public view)
export const getAllStoresForBuyer = async (req, res) => {
  try {
    // Get query parameters for filtering
    const {
      searchTerm,
      location,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    // Build filter object
    const filter = {
      status: "active", // Only show active stores
    };

    // Add location filter
    if (location) {
      filter.location = { $regex: location, $options: "i" };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = order === "asc" ? 1 : -1;

    // Find stores
    let stores = await Store.find(filter).sort(sort).lean();

    // Apply search term filter (searches in name, description, location)
    if (searchTerm) {
      const searchRegex = new RegExp(searchTerm, "i");
      stores = stores.filter(
        (store) =>
          searchRegex.test(store.name) ||
          searchRegex.test(store.description) ||
          searchRegex.test(store.location),
      );
    }

    // Format response with seller information
    const formattedStores = await Promise.all(
      stores.map(async (store) => {
        // Calculate actual product count for this store
        const productCount = await Product.countDocuments({ store: store._id });

        // Update store rating based on product ratings (ensure it's up to date)
        await updateStoreRating(store._id);

        // Re-fetch store to get updated rating
        const updatedStore = await Store.findById(store._id).lean();

        // Check if current user is following this store
        const isFollowing =
          (req.user &&
            updatedStore?.followersList?.some(
              (followerId) => followerId.toString() === req.user._id.toString(),
            )) ||
          false;

        // Get seller profile using buildProfileResponse with ecommerce_seller role
        const sellerProfile = await buildProfileResponse(
          store.owner?.toString() || store.owner,
          "ecommerce_seller",
        );

        // Use seller profile data, fallback to owner basic data if profile not found
        let sellerName = "Unknown Seller";
        let sellerAvatar = "U";
        let sellerRating = 0;
        let sellerEmail = "";

        if (sellerProfile) {
          const firstName = sellerProfile.firstName || "";
          const lastName = sellerProfile.lastName || "";
          sellerName = `${firstName} ${lastName}`.trim() || "Unknown Seller";
          sellerAvatar = sellerProfile.avatar || sellerName.charAt(0) || "U";
          sellerRating = sellerProfile.rating || 0;
          sellerEmail = sellerProfile.email || "";
        }

        return {
          id: store._id.toString(),
          _id: store._id.toString(),
          name: store.name,
          description: store.description,
          location: store.location,
          bannerImage: store.bannerImage || "🏪",
          products: productCount,
          followers: updatedStore?.followers || store.followers || 0,
          rating: updatedStore?.rating || store.rating || 0,
          views: store.views || 0,
          isFollowing,
          seller: {
            name: sellerName,
            avatar: sellerAvatar,
            rating: sellerRating,
            email: sellerEmail,
          },
          createdAt: store.createdAt,
          updatedAt: store.updatedAt,
        };
      }),
    );

    return res.json({
      message: "Stores fetched successfully",
      count: formattedStores.length,
      stores: formattedStores,
    });
  } catch (error) {
    console.error("getAllStoresForBuyer error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Get store by id for buyer (public view)
export const getStoreByIdForBuyer = async (req, res) => {
  try {
    const { id } = req.params;

    // Find store by ID (buyers can view any active store)
    const store = await Store.findOne({
      _id: id,
      status: "active",
    }).lean();

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    // Increment views
    await Store.findByIdAndUpdate(id, { $inc: { views: 1 } });

    // Calculate actual product count for this store
    const productCount = await Product.countDocuments({ store: store._id });

    // Update store rating based on product ratings (ensure it's up to date)
    await updateStoreRating(id);

    // Re-fetch store to get updated rating
    const updatedStore = await Store.findById(id).lean();

    // Check if current user is following this store
    const isFollowing =
      (req.user &&
        updatedStore?.followersList?.some(
          (followerId) => followerId.toString() === req.user._id.toString(),
        )) ||
      false;

    // Get seller profile using buildProfileResponse with ecommerce_seller role
    const sellerProfile = await buildProfileResponse(
      store.owner?.toString() || store.owner,
      "ecommerce_seller",
    );

    // Use seller profile data, fallback to basic data if profile not found
    let sellerName = "Unknown Seller";
    let sellerAvatar = "U";
    let sellerRating = 0;
    let sellerEmail = "";
    let sellerPhone = "";

    if (sellerProfile) {
      const firstName = sellerProfile.firstName || "";
      const lastName = sellerProfile.lastName || "";
      sellerName = `${firstName} ${lastName}`.trim() || "Unknown Seller";
      sellerAvatar = sellerProfile.avatar || sellerName.charAt(0) || "U";
      sellerRating = sellerProfile.rating || 0;
      sellerEmail = sellerProfile.email || "";
      sellerPhone = sellerProfile.phone || "";
    }

    // Format response
    const formattedStore = {
      _id: store._id.toString(),
      name: store.name,
      description: store.description || "",
      location: store.location,
      bannerImage: store.bannerImage || "🏪",
      products: productCount,
      followers: updatedStore?.followers || store.followers || 0,
      rating: updatedStore?.rating || store.rating || 0,
      views: (store.views || 0) + 1,
      status: store.status,
      isFollowing,
      owner: {
        _id: store.owner?.toString() || "",
        name: sellerName,
        email: sellerEmail,
        avatar: sellerAvatar,
        rating: sellerRating,
        phone: sellerPhone,
      },
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    };

    return res.json({
      message: "Store fetched successfully",
      store: formattedStore,
    });
  } catch (error) {
    console.error("getStoreByIdForBuyer error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Get stores by seller ID (for seller profile page)
export const getStoresBySellerId = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    // Find all active stores owned by this seller
    const stores = await Store.find({
      owner: id,
      status: "active",
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Format response
    const formattedStores = stores.map((store) => {
      return {
        id: store._id.toString(),
        _id: store._id.toString(),
        name: store.name,
        description: store.description || "",
        location: store.location,
        bannerImage: store.bannerImage || "🏪",
        products: store.products || 0,
        followers: store.followers || 0,
        rating: store.rating || 0,
        views: store.views || 0,
        status: store.status,
        createdAt: store.createdAt,
        updatedAt: store.updatedAt,
      };
    });

    return res.json({
      message: "Stores fetched successfully",
      count: formattedStores.length,
      stores: formattedStores,
    });
  } catch (error) {
    console.error("getStoresBySellerId error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Follow a store
export const followStore = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const userId = req.user._id;

    // Find the store
    const store = await Store.findById(id);

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    // Check if user is already following
    if (store.followersList.includes(userId)) {
      return res
        .status(400)
        .json({ message: "You are already following this store" });
    }

    // Add user to followers list and increment count
    store.followersList.push(userId);
    store.followers = store.followersList.length;
    await store.save();

    return res.json({
      message: "Store followed successfully",
      followers: store.followers,
      isFollowing: true,
    });
  } catch (error) {
    console.error("followStore error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Unfollow a store
export const unfollowStore = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const userId = req.user._id;

    // Find the store
    const store = await Store.findById(id);

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    // Check if user is following
    if (!store.followersList.includes(userId)) {
      return res
        .status(400)
        .json({ message: "You are not following this store" });
    }

    // Remove user from followers list and decrement count
    store.followersList = store.followersList.filter(
      (followerId) => followerId.toString() !== userId.toString(),
    );
    store.followers = store.followersList.length;
    await store.save();

    return res.json({
      message: "Store unfollowed successfully",
      followers: store.followers,
      isFollowing: false,
    });
  } catch (error) {
    console.error("unfollowStore error", error);
    return res.status(500).json({ message: error.message });
  }
};
