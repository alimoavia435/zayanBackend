import Review from "../model/Review.js";
import User from "../model/User.js";
import Product from "../model/Product.js";
import AdminActionLog from "../model/AdminActionLog.js";

// Get all reviews with pagination and filters (Admin only)
export const getReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const type = req.query.type; // "product" or "seller"
    const rating = req.query.rating; // 1-5
    const search = req.query.search; // Search in comment or title

    // Build query
    const query = {};

    if (type && ["product", "seller"].includes(type)) {
      query.type = type;
    }

    if (rating) {
      const ratingNum = parseInt(rating);
      if (ratingNum >= 1 && ratingNum <= 5) {
        query.rating = ratingNum;
      }
    }

    if (search) {
      query.$or = [
        { comment: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    // Get reviews with populated references
    const reviews = await Review.find(query)
      .populate("user", "name email firstName lastName")
      .populate("product", "name title images")
      .populate("seller", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count
    const total = await Review.countDocuments(query);

    return res.json({
      success: true,
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getReviews error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get reviews",
    });
  }
};

// Get review statistics (Admin only)
export const getReviewStats = async (req, res) => {
  try {
    const [totalReviews, productReviews, sellerReviews, ratingDistribution, recentReviews] = await Promise.all([
      Review.countDocuments(),
      Review.countDocuments({ type: "product" }),
      Review.countDocuments({ type: "seller" }),
      Review.aggregate([
        {
          $group: {
            _id: "$rating",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
      ]),
      Review.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
      }),
    ]);

    const avgRating = await Review.aggregate([
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" },
        },
      },
    ]);

    const stats = {
      totalReviews,
      productReviews,
      sellerReviews,
      recentReviews,
      averageRating: avgRating.length > 0 ? parseFloat(avgRating[0].avgRating.toFixed(2)) : 0,
      ratingDistribution: {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0,
      },
    };

    ratingDistribution.forEach((item) => {
      stats.ratingDistribution[item._id] = item.count;
    });

    return res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("getReviewStats error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get review statistics",
    });
  }
};

// Delete a review (Admin only)
export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    const review = await Review.findById(reviewId).populate("product", "name").populate("seller", "name").populate("user", "name email");

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Delete the review
    await Review.findByIdAndDelete(reviewId);

    // Update product/seller ratings if needed (recalculate)
    // This could be done via a background job, but for now we'll do it here
    // Note: You might want to add functions to recalculate ratings after deletion

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: "review_deleted",
        targetType: "review",
        targetId: reviewId,
        details: {
          reviewId: reviewId.toString(),
          reviewType: review.type,
          rating: review.rating,
          reviewerEmail: review.user?.email || "N/A",
        },
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
    }

    return res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("deleteReview error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete review",
    });
  }
};

// Get review details (Admin only)
export const getReviewDetails = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId)
      .populate("user", "name email firstName lastName")
      .populate("product", "name title images store")
      .populate("seller", "name email")
      .populate("verifiedByConversation")
      .lean();

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    return res.json({
      success: true,
      review,
    });
  } catch (error) {
    console.error("getReviewDetails error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get review details",
    });
  }
};

