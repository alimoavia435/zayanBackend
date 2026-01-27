import Product from "../model/Product.js";
import Category from "../model/Category.js";
import Store from "../model/Store.js";
import Review from "../model/Review.js";
import UserSubscription from "../model/UserSubscription.js";
import SubscriptionPlan from "../model/SubscriptionPlan.js";
import { buildProfileResponse } from "./profileController.js";

export const createProduct = async (req, res) => {
  try {
    const {
      store,
      category,
      name,
      description,
      price,
      currency,
      unit,
      images,
      stock,
      sku,
    } = req.body;

    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!store || !category || !name || !price) {
      return res.status(400).json({
        message: "Please provide store, category, name, and price",
      });
    }

    // Check subscription limits for ecommerceSeller role
    const userId = req.user._id;
    const subscription = await UserSubscription.findOne({
      userId,
      role: "ecommerceSeller",
      status: "active",
    }).populate("planId");

    if (subscription) {
      // Check if subscription is still valid (housekeeping only, does not block creation)
      const now = new Date();
      if (subscription.endDate < now) {
        subscription.status = "expired";
        await subscription.save();
      }
    }

    // Verify that the category belongs to the store
    const categoryDoc = await Category.findOne({
      _id: category,
      store: store,
      owner: req.user._id,
    });

    if (!categoryDoc) {
      return res.status(400).json({
        message: "Category not found or does not belong to this store",
      });
    }

    const product = await Product.create({
      store,
      category,
      owner: req.user._id,
      name,
      description: description || "",
      price,
      currency: currency || "USD",
      unit: unit || "piece",
      images: images || [],
      stock: stock || 0,
      sku: sku || "",
    });

    // Increment products count in category
    await Category.findByIdAndUpdate(category, {
      $inc: { products: 1 },
    });

    // Update subscription usage if subscription exists
    if (subscription && subscription.status === "active") {
      subscription.usage.listingsUsed += 1;
      await subscription.save();
    }

    return res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("createProduct error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Get all products of the authenticated user
export const getProducts = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { store, category } = req.query;

    // Build filter
    const filter = { owner: req.user._id };
    if (store) {
      filter.store = store;
    }
    if (category) {
      filter.category = category;
    }

    const products = await Product.find(filter)
      .populate("store", "name")
      .populate("category", "name icon")
      .sort({ createdAt: -1 });

    return res.json({
      message: "Products fetched successfully",
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("getProducts error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Get product by id
export const getProductById = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const product = await Product.findOne({
      _id: id,
      owner: req.user._id,
    })
      .populate("store", "name")
      .populate("category", "name icon");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json({
      message: "Product fetched successfully",
      product,
    });
  } catch (error) {
    console.error("getProductById error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Get product by id for buyer (public view - any active product)
export const getProductByIdForBuyer = async (req, res) => {
  try {
    const { id } = req.params;

    // Find any active product (buyers can view any active product)
    const product = await Product.findOne({
      _id: id,
      status: "active",
    })
      .populate("store", "name location bannerImage")
      .populate("category", "name icon")
      .populate("owner", "firstName lastName email avatar")
      .lean();

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Increment views
    await Product.findByIdAndUpdate(id, { $inc: { views: 1 } });

    // Get store owner info for seller card
    const storeId =
      typeof product.store === "object" ? product.store._id : product.store;
    const store = await Store.findById(storeId).lean();
    let sellerInfo = null;
    if (store && store.owner) {
      const sellerProfile = await buildProfileResponse(
        store.owner.toString(),
        "ecommerce_seller",
      );
      if (sellerProfile) {
        sellerInfo = {
          name:
            `${sellerProfile.firstName || ""} ${sellerProfile.lastName || ""}`.trim() ||
            "Unknown Seller",
          avatar: sellerProfile.avatar || "U",
          rating: sellerProfile.rating || 0,
          email: sellerProfile.email || "",
        };
      }
    }

    // Get reviews count
    const reviewsCount = await Review.countDocuments({ product: id });

    // Check if current user has liked this product
    const userId = req.user?._id?.toString();
    const isLiked =
      userId && product.likedBy
        ? product.likedBy.some(
            (likedUserId) => likedUserId.toString() === userId,
          )
        : false;

    // Format response
    const formattedProduct = {
      _id: product._id.toString(),
      name: product.name,
      description: product.description || "",
      price: product.price,
      currency: product.currency || "USD",
      unit: product.unit || "piece",
      images: product.images || [],
      stock: product.stock || 0,
      rating: product.rating || 0,
      reviewsCount,
      sales: product.sales || 0,
      views: (product.views || 0) + 1,
      likes: product.likes || 0,
      isLiked,
      store: product.store,
      category: product.category,
      owner: product.owner,
      sellerInfo,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    return res.json({
      message: "Product fetched successfully",
      product: formattedProduct,
    });
  } catch (error) {
    console.error("getProductByIdForBuyer error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Update product
export const updateProduct = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const {
      name,
      description,
      price,
      currency,
      unit,
      images,
      stock,
      sku,
      status,
      category,
    } = req.body;

    const product = await Product.findOne({
      _id: id,
      owner: req.user._id,
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // If category is being changed, verify it belongs to the same store
    if (category && category !== product.category.toString()) {
      const categoryDoc = await Category.findOne({
        _id: category,
        store: product.store,
        owner: req.user._id,
      });

      if (!categoryDoc) {
        return res.status(400).json({
          message: "Category not found or does not belong to this store",
        });
      }

      // Decrement old category, increment new category
      await Category.findByIdAndUpdate(product.category, {
        $inc: { products: -1 },
      });
      await Category.findByIdAndUpdate(category, {
        $inc: { products: 1 },
      });
    }

    // Update fields if provided
    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = price;
    if (currency !== undefined) product.currency = currency;
    if (unit !== undefined) product.unit = unit;
    if (images !== undefined) product.images = images;
    if (stock !== undefined) product.stock = stock;
    if (sku !== undefined) product.sku = sku;
    if (status !== undefined) product.status = status;
    if (category !== undefined) product.category = category;

    await product.save();

    return res.json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("updateProduct error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Delete product
export const deleteProduct = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const product = await Product.findOne({
      _id: id,
      owner: req.user._id,
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Decrement products count in category
    await Category.findByIdAndUpdate(product.category, {
      $inc: { products: -1 },
    });

    await Product.findByIdAndDelete(id);

    return res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("deleteProduct error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Get products by store ID for buyers (public view)
export const getProductsByStoreId = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { storeId } = req.params;
    const {
      searchTerm,
      category,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    // Build filter - only active products from the specified store
    const filter = {
      store: storeId,
      status: "active",
    };

    if (category) {
      filter.category = category;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = order === "asc" ? 1 : -1;

    // Find products
    let products = await Product.find(filter)
      .populate("store", "name")
      .populate("category", "name icon")
      .sort(sort)
      .lean();

    // Apply search term filter (searches in name, description)
    if (searchTerm) {
      const searchRegex = new RegExp(searchTerm, "i");
      products = products.filter(
        (product) =>
          searchRegex.test(product.name) ||
          searchRegex.test(product.description || ""),
      );
    }

    // Format response
    const formattedProducts = products.map((product) => ({
      _id: product._id.toString(),
      name: product.name,
      description: product.description || "",
      price: product.price,
      currency: product.currency || "USD",
      unit: product.unit || "piece",
      images: product.images || [],
      stock: product.stock || 0,
      rating: product.rating || 0,
      sales: product.sales || 0,
      views: product.views || 0,
      store: product.store,
      category: product.category,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }));

    return res.json({
      message: "Products fetched successfully",
      count: formattedProducts.length,
      products: formattedProducts,
    });
  } catch (error) {
    console.error("getProductsByStoreId error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Get all products for buyers (public view - all active products)
export const getAllProductsForBuyer = async (req, res) => {
  try {
    const {
      searchTerm,
      category,
      store,
      sortBy = "createdAt",
      order = "desc",
      minPrice,
      maxPrice,
    } = req.query;

    // Build filter - only active products
    const filter = {
      status: "active",
    };

    if (category) {
      filter.category = category;
    }

    if (store) {
      filter.store = store;
    }

    // Build sort object - always prioritize featured listings first
    const sort = { isFeatured: -1 };
    sort[sortBy] = order === "asc" ? 1 : -1;

    // Find products
    let products = await Product.find(filter)
      .populate("store", "name location")
      .populate("category", "name icon")
      .populate("owner", "firstName lastName")
      .sort(sort)
      .lean();

    // Apply search term filter (searches in name, description)
    if (searchTerm) {
      const searchRegex = new RegExp(searchTerm, "i");
      products = products.filter(
        (product) =>
          searchRegex.test(product.name) ||
          searchRegex.test(product.description || ""),
      );
    }

    // Apply price filter
    if (minPrice || maxPrice) {
      products = products.filter((product) => {
        const price = product.price || 0;
        if (minPrice && price < parseFloat(minPrice)) return false;
        if (maxPrice && price > parseFloat(maxPrice)) return false;
        return true;
      });
    }

    // Get current user ID
    const userId = req.user?._id?.toString();

    // Format response
    const formattedProducts = products.map((product) => {
      // Check if current user has liked this product
      const isLiked =
        userId && product.likedBy
          ? product.likedBy.some(
              (likedUserId) => likedUserId.toString() === userId,
            )
          : false;

      return {
        _id: product._id.toString(),
        name: product.name,
        description: product.description || "",
        price: product.price,
        currency: product.currency || "USD",
        unit: product.unit || "piece",
        images: product.images || [],
        stock: product.stock || 0,
        rating: product.rating || 0,
        sales: product.sales || 0,
        views: product.views || 0,
        likes: product.likes || 0,
        isLiked,
        store: product.store,
        category: product.category,
        owner: product.owner,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };
    });

    return res.json({
      message: "Products fetched successfully",
      count: formattedProducts.length,
      products: formattedProducts,
    });
  } catch (error) {
    console.error("getAllProductsForBuyer error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Helper function to update product rating based on reviews
const updateProductRating = async (productId) => {
  try {
    const reviews = await Review.find({ type: "product", product: productId });
    if (reviews.length === 0) {
      await Product.findByIdAndUpdate(productId, { rating: 0 });
      return;
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;
    const roundedRating = Math.round(averageRating * 10) / 10; // Round to 1 decimal place

    await Product.findByIdAndUpdate(productId, { rating: roundedRating });
  } catch (error) {
    console.error("updateProductRating error", error);
  }
};

// Helper function to update store rating based on product ratings
export const updateStoreRating = async (storeId) => {
  try {
    const products = await Product.find({ store: storeId, status: "active" });
    if (products.length === 0) {
      await Store.findByIdAndUpdate(storeId, { rating: 0 });
      return;
    }

    const totalRating = products.reduce(
      (sum, product) => sum + (product.rating || 0),
      0,
    );
    const averageRating = totalRating / products.length;
    const roundedRating = Math.round(averageRating * 10) / 10; // Round to 1 decimal place

    await Store.findByIdAndUpdate(storeId, { rating: roundedRating });
  } catch (error) {
    console.error("updateStoreRating error", error);
  }
};

// Create a review for a product
export const createProductReview = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const { rating, title, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ message: "Rating must be between 1 and 5" });
    }

    // Check if product exists and is active
    const product = await Product.findOne({ _id: id, status: "active" });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Create new review with type 'product' (allowing multiple reviews)
    const review = await Review.create({
      type: "product",
      product: id,
      user: req.user._id,
      rating,
      title: title || "",
      comment: comment || "",
    });

    // Update product rating
    await updateProductRating(id);

    // Update store rating
    const storeId =
      typeof product.store === "object" ? product.store._id : product.store;
    await updateStoreRating(storeId);

    // Get buyer profile using buildProfileResponse
    const buyerProfile = await buildProfileResponse(
      req.user._id.toString(),
      "ecommerce_buyer",
    );

    // Format user info from profile
    let userName = "Anonymous";
    let userAvatar = "U";
    let userEmail = "";

    if (buyerProfile) {
      const firstName = buyerProfile.firstName || "";
      const lastName = buyerProfile.lastName || "";
      userName = `${firstName} ${lastName}`.trim() || "Anonymous";
      userAvatar = buyerProfile.avatar || userName.charAt(0) || "U";
      userEmail = buyerProfile.email || "";
    }

    return res.status(201).json({
      message: "Review created successfully",
      review: {
        _id: review._id.toString(),
        product: review.product.toString(),
        user: {
          _id: req.user._id.toString(),
          name: userName,
          avatar: userAvatar,
          email: userEmail,
        },
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
      },
    });
  } catch (error) {
    console.error("createProductReview error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Get reviews for a product
export const getProductReviews = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product exists
    const product = await Product.findOne({ _id: id, status: "active" });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const reviews = await Review.find({
      type: "product",
      product: id,
    })
      .populate("user", "_id")
      .sort({ createdAt: -1 })
      .lean();

    // Format reviews with buyer profile information
    const formattedReviews = await Promise.all(
      reviews.map(async (review) => {
        // Get buyer profile using buildProfileResponse
        const buyerProfile = await buildProfileResponse(
          review.user._id.toString(),
          "ecommerce_buyer",
        );

        // Format user info from profile
        let userName = "Anonymous";
        let userAvatar = "U";
        let userEmail = "";

        if (buyerProfile) {
          const firstName = buyerProfile.firstName || "";
          const lastName = buyerProfile.lastName || "";
          userName = `${firstName} ${lastName}`.trim() || "Anonymous";
          userAvatar = buyerProfile.avatar || userName.charAt(0) || "U";
          userEmail = buyerProfile.email || "";
        }

        return {
          _id: review._id.toString(),
          product: review.product.toString(),
          user: {
            _id: review.user._id.toString(),
            name: userName,
            avatar: userAvatar,
            email: userEmail,
            verificationStatus: buyerProfile?.verificationStatus || null,
            isVerified: buyerProfile?.isVerified || false,
          },
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt,
        };
      }),
    );

    return res.json({
      message: "Reviews fetched successfully",
      count: formattedReviews.length,
      reviews: formattedReviews,
    });
  } catch (error) {
    console.error("getProductReviews error", error);
    return res.status(500).json({ message: error.message });
  }
};

export const likeProduct = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const userId = req.user._id;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if user already liked the product
    const isLiked = product.likedBy.some(
      (likedUserId) => likedUserId.toString() === userId.toString(),
    );

    if (isLiked) {
      return res.status(400).json({ message: "Product already liked" });
    }

    // Add user to likedBy array and increment likes count
    product.likedBy.push(userId);
    product.likes = product.likedBy.length;
    await product.save();

    return res.json({
      message: "Product liked successfully",
      likes: product.likes,
      isLiked: true,
    });
  } catch (error) {
    console.error("likeProduct error", error);
    return res.status(500).json({ message: error.message });
  }
};

export const unlikeProduct = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const userId = req.user._id;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if user has liked the product
    const isLiked = product.likedBy.some(
      (likedUserId) => likedUserId.toString() === userId.toString(),
    );

    if (!isLiked) {
      return res.status(400).json({ message: "Product not liked" });
    }

    // Remove user from likedBy array and decrement likes count
    product.likedBy = product.likedBy.filter(
      (likedUserId) => likedUserId.toString() !== userId.toString(),
    );
    product.likes = product.likedBy.length;
    await product.save();

    return res.json({
      message: "Product unliked successfully",
      likes: product.likes,
      isLiked: false,
    });
  } catch (error) {
    console.error("unlikeProduct error", error);
    return res.status(500).json({ message: error.message });
  }
};
