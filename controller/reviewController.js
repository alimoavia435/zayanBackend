import Review from "../model/Review.js";
import Conversation from "../model/Conversation.js";
import User from "../model/User.js";
import Property from "../model/Property.js";
import { buildProfileResponse } from "./profileController.js";
import { createNotification } from "./notificationController.js";

// Helper function to update seller/agent rating based on reviews
export const updateSellerRating = async (sellerId) => {
  try {
    const reviews = await Review.find({
      type: "seller",
      seller: sellerId,
      verified: true, // Only count verified reviews
    });

    if (reviews.length === 0) {
      // Update user rating to 0 if no reviews
      await User.findByIdAndUpdate(sellerId, { rating: 0 });
      return;
    }

    // Calculate overall average rating
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;
    const roundedRating = Math.round(averageRating * 10) / 10; // Round to 1 decimal place

    // Calculate category averages
    const categoryRatings = {
      communication: 0,
      accuracy: 0,
      professionalism: 0,
    };

    const categoryCounts = {
      communication: 0,
      accuracy: 0,
      professionalism: 0,
    };

    reviews.forEach((review) => {
      if (review.categories?.communication) {
        categoryRatings.communication += review.categories.communication;
        categoryCounts.communication += 1;
      }
      if (review.categories?.accuracy) {
        categoryRatings.accuracy += review.categories.accuracy;
        categoryCounts.accuracy += 1;
      }
      if (review.categories?.professionalism) {
        categoryRatings.professionalism += review.categories.professionalism;
        categoryCounts.professionalism += 1;
      }
    });

    // Calculate category averages
    if (categoryCounts.communication > 0) {
      categoryRatings.communication =
        Math.round(
          (categoryRatings.communication / categoryCounts.communication) * 10,
        ) / 10;
    }
    if (categoryCounts.accuracy > 0) {
      categoryRatings.accuracy =
        Math.round((categoryRatings.accuracy / categoryCounts.accuracy) * 10) /
        10;
    }
    if (categoryCounts.professionalism > 0) {
      categoryRatings.professionalism =
        Math.round(
          (categoryRatings.professionalism / categoryCounts.professionalism) *
            10,
        ) / 10;
    }

    // Update user rating (overall average)
    await User.findByIdAndUpdate(sellerId, {
      rating: roundedRating,
      // Store category ratings in user profile if needed (can extend User model)
    });

    return {
      overallRating: roundedRating,
      totalReviews: reviews.length,
      categoryRatings,
    };
  } catch (error) {
    console.error("updateSellerRating error", error);
    throw error;
  }
};

// Create a review for a seller/agent (with verification)
export const createSellerReview = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { sellerId } = req.params;
    const {
      rating,
      title,
      comment,
      categories,
      propertyId, // Optional: for real estate reviews
      productId, // Optional: for ecommerce reviews
    } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ message: "Rating must be between 1 and 5" });
    }

    // Validate category ratings if provided
    if (categories) {
      if (
        categories.communication &&
        (categories.communication < 1 || categories.communication > 5)
      ) {
        return res
          .status(400)
          .json({ message: "Communication rating must be between 1 and 5" });
      }
      if (
        categories.accuracy &&
        (categories.accuracy < 1 || categories.accuracy > 5)
      ) {
        return res
          .status(400)
          .json({ message: "Accuracy rating must be between 1 and 5" });
      }
      if (
        categories.professionalism &&
        (categories.professionalism < 1 || categories.professionalism > 5)
      ) {
        return res
          .status(400)
          .json({ message: "Professionalism rating must be between 1 and 5" });
      }
    }

    // Check if seller exists and has seller role
    const seller = await User.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    // Verify seller has seller/agent role
    const hasSellerRole = seller.roles?.some(
      (role) => role === "ecommerceSeller" || role === "realEstateSeller",
    );
    if (!hasSellerRole) {
      return res
        .status(400)
        .json({ message: "This user is not a seller or agent" });
    }

    // Verify that buyer has interacted with seller (through conversation)
    // Check if there's a conversation between buyer and seller
    const buyerId = req.user._id;
    let conversation = null;

    // First, try to find a conversation with the specific property/product
    if (propertyId) {
      conversation = await Conversation.findOne({
        buyerId,
        sellerId,
        propertyId,
      });
    } else if (productId) {
      conversation = await Conversation.findOne({
        buyerId,
        sellerId,
        productId,
      });
    }

    // Fallback: if no specific conversation found, check for any conversation between buyer and seller
    // This ensures flexibility - buyer can review seller after interacting on any property/product
    if (!conversation) {
      conversation = await Conversation.findOne({
        buyerId,
        sellerId,
      });
    }

    if (!conversation) {
      return res.status(403).json({
        message:
          "You can only review sellers you have interacted with. Please start a conversation first.",
      });
    }

    // Check if user already reviewed this seller
    const existingReview = await Review.findOne({
      seller: sellerId,
      user: buyerId,
    });

    let review;
    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      existingReview.title = title || "";
      existingReview.comment = comment || "";
      existingReview.categories = categories || {};
      existingReview.verified = true;
      existingReview.verifiedByConversation = conversation._id;
      review = await existingReview.save();
    } else {
      // Create new review
      review = await Review.create({
        type: "seller",
        seller: sellerId,
        user: buyerId,
        rating,
        categories: categories || {},
        title: title || "",
        comment: comment || "",
        verified: true,
        verifiedByConversation: conversation._id,
      });
    }

    // Update seller rating
    await updateSellerRating(sellerId);

    // Get buyer profile using buildProfileResponse
    const buyerProfile = await buildProfileResponse(
      buyerId.toString(),
      propertyId ? "realestate_buyer" : "ecommerce_buyer",
    );

    // Create notification for seller about new review
    const io = req.app?.get("io");
    try {
      const reviewTitle = title || `Rated ${rating} stars`;
      await createNotification({
        userId: sellerId,
        type: "new_review",
        title: "New Review Received",
        message: `${userName} left you a ${rating}-star review: "${reviewTitle}"`,
        actionUrl: propertyId
          ? `/real-estate/seller/dashboard`
          : `/ecommerce/seller/dashboard`,
        metadata: {
          reviewId: review._id.toString(),
          rating,
          reviewerName: userName,
        },
        relatedId: review._id,
        relatedType: "review",
        sendEmail: true,
        io,
      });
    } catch (notifError) {
      console.error("Failed to create notification for review:", notifError);
      // Don't fail review creation if notification fails
    }

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
      message: existingReview
        ? "Review updated successfully"
        : "Review created successfully",
      review: {
        _id: review._id.toString(),
        type: review.type,
        seller: review.seller.toString(),
        user: {
          _id: buyerId.toString(),
          name: userName,
          avatar: userAvatar,
          email: userEmail,
        },
        rating: review.rating,
        categories: review.categories,
        title: review.title,
        comment: review.comment,
        verified: review.verified,
        sellerResponse: review.sellerResponse,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
      },
    });
  } catch (error) {
    console.error("createSellerReview error", error);
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: "You have already reviewed this seller" });
    }
    return res.status(500).json({ message: error.message });
  }
};

// Get reviews for a seller/agent
export const getSellerReviews = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { sellerId } = req.params;

    // Check if seller exists
    const seller = await User.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    // Get all verified reviews for this seller
    const reviews = await Review.find({
      type: "seller",
      seller: sellerId,
      verified: true,
    })
      .populate("user", "_id")
      .sort({ createdAt: -1 })
      .lean();

    // Calculate statistics
    const totalReviews = reviews.length;
    let totalRating = 0;
    const categoryTotals = {
      communication: 0,
      accuracy: 0,
      professionalism: 0,
    };
    const categoryCounts = {
      communication: 0,
      accuracy: 0,
      professionalism: 0,
    };
    const starBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    reviews.forEach((review) => {
      totalRating += review.rating;
      starBreakdown[review.rating] = (starBreakdown[review.rating] || 0) + 1;

      if (review.categories?.communication) {
        categoryTotals.communication += review.categories.communication;
        categoryCounts.communication += 1;
      }
      if (review.categories?.accuracy) {
        categoryTotals.accuracy += review.categories.accuracy;
        categoryCounts.accuracy += 1;
      }
      if (review.categories?.professionalism) {
        categoryTotals.professionalism += review.categories.professionalism;
        categoryCounts.professionalism += 1;
      }
    });

    const averageRating =
      totalReviews > 0 ? Math.round((totalRating / totalReviews) * 10) / 10 : 0;

    const categoryRatings = {
      communication:
        categoryCounts.communication > 0
          ? Math.round(
              (categoryTotals.communication / categoryCounts.communication) *
                10,
            ) / 10
          : 0,
      accuracy:
        categoryCounts.accuracy > 0
          ? Math.round(
              (categoryTotals.accuracy / categoryCounts.accuracy) * 10,
            ) / 10
          : 0,
      professionalism:
        categoryCounts.professionalism > 0
          ? Math.round(
              (categoryTotals.professionalism /
                categoryCounts.professionalism) *
                10,
            ) / 10
          : 0,
    };

    // Format reviews with buyer profile information
    const formattedReviews = await Promise.all(
      reviews.map(async (review) => {
        // Try to determine buyer role from seller role or use default
        // If seller has realEstateSeller role, buyer is likely realestate_buyer
        // Otherwise, default to ecommerce_buyer
        const buyerRole = seller.roles?.includes("realEstateSeller")
          ? "realestate_buyer"
          : "ecommerce_buyer";

        // Get buyer profile using buildProfileResponse
        const buyerProfile = await buildProfileResponse(
          review.user._id.toString(),
          buyerRole,
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
          type: review.type,
          seller: review.seller.toString(),
          user: {
            _id: review.user._id.toString(),
            name: userName,
            avatar: userAvatar,
            email: userEmail,
          },
          rating: review.rating,
          categories: review.categories || {},
          title: review.title,
          comment: review.comment,
          verified: review.verified,
          sellerResponse: review.sellerResponse || null,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt,
        };
      }),
    );

    return res.json({
      message: "Reviews fetched successfully",
      count: totalReviews,
      averageRating,
      categoryRatings,
      starBreakdown,
      reviews: formattedReviews,
    });
  } catch (error) {
    console.error("getSellerReviews error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Add seller response to a review
export const addSellerResponse = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { reviewId } = req.params;
    const { response } = req.body;

    if (!response || !response.trim()) {
      return res.status(400).json({ message: "Response text is required" });
    }

    // Find the review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Check if the current user is the seller being reviewed
    const sellerId =
      typeof review.seller === "object"
        ? review.seller._id.toString()
        : review.seller.toString();

    if (req.user._id.toString() !== sellerId) {
      return res
        .status(403)
        .json({ message: "You can only respond to reviews about yourself" });
    }

    // Update review with seller response
    review.sellerResponse = {
      response: response.trim(),
      respondedAt: new Date(),
    };
    await review.save();

    // NOTIFY THE BUYER: Send notification to the user who left the review
    try {
      const io = req.app.get("io");
      const seller = await User.findById(req.user._id).select(
        "name firstName lastName",
      );
      const sellerName =
        seller?.name ||
        (seller?.firstName
          ? `${seller.firstName} ${seller.lastName || ""}`.trim()
          : "The Seller");

      const buyerId = review.user.toString();

      // Determine routing channel based on review type (ecommerce vs real-estate)
      const channel = review.product ? "ecommerce" : "real-estate";

      await createNotification({
        userId: buyerId,
        type: "review_response",
        title: "Seller Responded to Your Review",
        message: `${sellerName} has replied to your review: "${response.trim()}"`,
        // Route to the store or seller profile
        actionUrl: review.product
          ? `/ecommerce/buyer/stores/${review.seller}`
          : `/real-estate/buyer/seller-profile/${review.seller}`,
        metadata: {
          reviewId: review._id.toString(),
          sellerId: req.user._id.toString(),
          sellerName,
        },
        relatedId: review._id,
        relatedType: "review",
        sendEmail: true,
        io,
      });
    } catch (notifError) {
      console.error("Failed to notify buyer of review response:", notifError);
    }

    return res.json({
      message: "Response added successfully",
      review: {
        _id: review._id.toString(),
        sellerResponse: review.sellerResponse,
      },
    });
  } catch (error) {
    console.error("addSellerResponse error", error);
    return res.status(500).json({ message: error.message });
  }
};
