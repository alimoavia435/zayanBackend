import SubscriptionPlan from "../model/SubscriptionPlan.js";
import UserSubscription from "../model/UserSubscription.js";
import FeaturedListing from "../model/FeaturedListing.js";
import User from "../model/User.js";
import Product from "../model/Product.js";
import Property from "../model/Property.js";
import AnalyticsEvent from "../model/AnalyticsEvent.js";
import { createNotification } from "./notificationController.js";

// Get all available subscription plans
export const getPlans = async (req, res) => {
  try {
    const { role } = req.query; // ecommerceSeller or realEstateSeller

    if (!role || !["ecommerceSeller", "realEstateSeller"].includes(role)) {
      return res.status(400).json({ message: "Valid role is required" });
    }

    const query = {
      isActive: true,
      $or: [{ targetRole: role }, { targetRole: "both" }],
    };

    const plans = await SubscriptionPlan.find(query).sort({ price: 1 });

    return res.status(200).json({
      message: "Plans retrieved successfully",
      plans,
    });
  } catch (error) {
    console.error("getPlans error", error);
    return res.status(500).json({ message: "Failed to retrieve plans" });
  }
};

// Subscribe to a plan
export const subscribe = async (req, res) => {
  try {
    const userId = req.user._id;
    const { planId, role } = req.body;

    if (!planId || !role) {
      return res.status(400).json({ message: "planId and role are required" });
    }

    if (!["ecommerceSeller", "realEstateSeller"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Check if user has the required role
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const roleKey = role === "ecommerceSeller" ? "ecommerceSeller" : "realEstateSeller";
    if (!user.roles.includes(roleKey)) {
      return res.status(403).json({ message: "You don't have the required role" });
    }

    // Check if user is verified
    if (user.verificationStatus !== "approved") {
      return res.status(403).json({ message: "Only verified sellers can purchase subscriptions" });
    }

    // Check if user is suspended or banned
    if (user.accountStatus !== "active") {
      return res.status(403).json({ message: "Suspended or banned users cannot subscribe" });
    }

    // Check if role is disabled
    if (user.disabledRoles.includes(roleKey)) {
      return res.status(403).json({ message: "This role has been disabled" });
    }

    // Get the plan
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    if (!plan.isActive) {
      return res.status(400).json({ message: "Plan is not active" });
    }

    // Check if plan is available for this role
    if (plan.targetRole !== "both" && plan.targetRole !== role) {
      return res.status(400).json({ message: "Plan is not available for this role" });
    }

    // IMPORTANT: Only activate free plans immediately
    // Paid plans must go through payment flow and webhook confirmation
    if (plan.price > 0) {
      return res.status(400).json({ 
        message: "Paid plans require payment. Please use the payment flow.",
        requiresPayment: true 
      });
    }

    // Cancel any existing active subscription for this role
    await UserSubscription.updateMany(
      {
        userId,
        role,
        status: "active",
      },
      {
        $set: {
          status: "cancelled",
        },
      }
    );

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration);

    // Create new subscription
    const subscription = await UserSubscription.create({
      userId,
      planId: plan._id,
      role,
      startDate,
      endDate,
      status: "active",
      autoRenew: true,
      usage: {
        listingsUsed: 0,
        featuredUsed: 0,
      },
    });

    // Track analytics event
    try {
      await AnalyticsEvent.create({
        eventType: "subscription_purchased",
        itemType: null,
        itemId: null,
        itemModel: null,
        ownerId: userId,
        userId: userId,
        metadata: {
          planId: plan._id.toString(),
          planName: plan.name,
          role,
          price: plan.price,
          duration: plan.duration,
        },
      });
    } catch (analyticsError) {
      console.error("Failed to track subscription analytics:", analyticsError);
    }

    // Send notification
    const io = req.app.get("io");
    try {
      await createNotification({
        userId: userId.toString(),
        type: "subscription_activated",
        title: "Subscription Activated",
        message: `Your ${plan.name} subscription for ${role} has been activated!`,
        actionUrl: role === "ecommerceSeller" 
          ? "/ecommerce/seller/subscription"
          : "/real-estate/seller/subscription",
        metadata: {
          planId: plan._id.toString(),
          planName: plan.name,
          role,
        },
        sendEmail: true,
        io,
      });
    } catch (notifError) {
      console.error("Failed to send subscription notification:", notifError);
    }

    // Populate plan details
    await subscription.populate("planId");

    return res.status(201).json({
      message: "Subscription activated successfully",
      subscription,
    });
  } catch (error) {
    console.error("subscribe error", error);
    return res.status(500).json({ message: "Failed to subscribe" });
  }
};

// Get current user's subscription
export const getMySubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const { role } = req.query;

    if (!role || !["ecommerceSeller", "realEstateSeller"].includes(role)) {
      return res.status(400).json({ message: "Valid role is required" });
    }

    const subscription = await UserSubscription.findOne({
      userId,
      role,
      status: "active",
    })
      .populate("planId")
      .sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(200).json({
        message: "No active subscription found",
        subscription: null,
      });
    }

    // Check if subscription is still valid
    const now = new Date();
    if (subscription.endDate < now) {
      subscription.status = "expired";
      await subscription.save();

      // Track expiration
      try {
        await AnalyticsEvent.create({
          eventType: "subscription_expired",
          itemType: null,
          itemId: null,
          itemModel: null,
          ownerId: userId,
          userId: userId,
          metadata: {
            planId: subscription.planId._id.toString(),
            planName: subscription.planId.name,
            role,
          },
        });
      } catch (analyticsError) {
        console.error("Failed to track expiration analytics:", analyticsError);
      }

      return res.status(200).json({
        message: "Subscription has expired",
        subscription: null,
      });
    }

    return res.status(200).json({
      message: "Subscription retrieved successfully",
      subscription,
    });
  } catch (error) {
    console.error("getMySubscription error", error);
    return res.status(500).json({ message: "Failed to retrieve subscription" });
  }
};

// Cancel subscription
export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const { role } = req.body;

    if (!role || !["ecommerceSeller", "realEstateSeller"].includes(role)) {
      return res.status(400).json({ message: "Valid role is required" });
    }

    const subscription = await UserSubscription.findOne({
      userId,
      role,
      status: "active",
    }).populate("planId");

    if (!subscription) {
      return res.status(404).json({ message: "No active subscription found" });
    }

    subscription.status = "cancelled";
    subscription.autoRenew = false;
    await subscription.save();

    return res.status(200).json({
      message: "Subscription cancelled successfully",
      subscription,
    });
  } catch (error) {
    console.error("cancelSubscription error", error);
    return res.status(500).json({ message: "Failed to cancel subscription" });
  }
};

// Feature a listing
export const featureListing = async (req, res) => {
  try {
    const userId = req.user._id;
    const { itemId, itemType, duration = 7 } = req.body; // duration in days

    if (!itemId || !itemType || !["product", "property"].includes(itemType)) {
      return res.status(400).json({ message: "itemId and valid itemType are required" });
    }

    // Determine role based on item type
    const role = itemType === "product" ? "ecommerceSeller" : "realEstateSeller";

    // Check if user has active subscription
    const subscription = await UserSubscription.findOne({
      userId,
      role,
      status: "active",
    }).populate("planId");

    if (!subscription) {
      return res.status(403).json({ message: "Active subscription required to feature listings" });
    }

    // Check if subscription is still valid
    const now = new Date();
    if (subscription.endDate < now) {
      subscription.status = "expired";
      await subscription.save();
      return res.status(403).json({ message: "Your subscription has expired" });
    }

    // Check if user has remaining featured listings
    const plan = subscription.planId;
    if (plan.features.featuredListingsCount > 0) {
      const featuredCount = await FeaturedListing.countDocuments({
        sellerId: userId,
        itemType,
        endDate: { $gte: now },
      });

      if (featuredCount >= plan.features.featuredListingsCount) {
        return res.status(403).json({
          message: `You have reached your limit of ${plan.features.featuredListingsCount} featured listings`,
        });
      }
    }

    // Verify item exists and belongs to user
    let item = null;
    if (itemType === "product") {
      item = await Product.findOne({ _id: itemId, owner: userId });
    } else {
      item = await Property.findOne({ _id: itemId, owner: userId });
    }

    if (!item) {
      return res.status(404).json({ message: "Item not found or you don't own it" });
    }

    // Check if item is already featured
    const existingFeatured = await FeaturedListing.findOne({
      itemId,
      itemType,
      endDate: { $gte: now },
    });

    if (existingFeatured) {
      return res.status(400).json({ message: "This listing is already featured" });
    }

    // Create featured listing
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);

    const featuredListing = await FeaturedListing.create({
      itemType,
      itemId,
      itemModel: itemType === "product" ? "Product" : "Property",
      sellerId: userId,
      startDate,
      endDate,
      priorityScore: 10,
      isBoosted: false,
    });

    // Update usage
    subscription.usage.featuredUsed += 1;
    await subscription.save();

    // Track analytics
    try {
      await AnalyticsEvent.create({
        eventType: "listing_featured",
        itemType,
        itemId,
        itemModel: itemType === "product" ? "Product" : "Property",
        ownerId: userId,
        userId: userId,
        metadata: {
          planId: plan._id.toString(),
          planName: plan.name,
          role,
          duration,
        },
      });
    } catch (analyticsError) {
      console.error("Failed to track featured listing analytics:", analyticsError);
    }

    // Send notification
    const io = req.app.get("io");
    try {
      await createNotification({
        userId: userId.toString(),
        type: "listing_featured_approved",
        title: "Listing Featured",
        message: `Your ${itemType} has been featured and will be highlighted in search results!`,
        actionUrl: itemType === "product"
          ? `/ecommerce/buyer/products/${itemId}`
          : `/real-estate/buyer/properties/${itemId}`,
        metadata: {
          itemId: itemId.toString(),
          itemType,
        },
        sendEmail: true,
        io,
      });
    } catch (notifError) {
      console.error("Failed to send featured listing notification:", notifError);
    }

    return res.status(201).json({
      message: "Listing featured successfully",
      featuredListing,
    });
  } catch (error) {
    console.error("featureListing error", error);
    return res.status(500).json({ message: "Failed to feature listing" });
  }
};

// Boost a listing
export const boostListing = async (req, res) => {
  try {
    const userId = req.user._id;
    const { itemId, itemType, duration = 7 } = req.body; // duration in days

    if (!itemId || !itemType || !["product", "property"].includes(itemType)) {
      return res.status(400).json({ message: "itemId and valid itemType are required" });
    }

    // Determine role based on item type
    const role = itemType === "product" ? "ecommerceSeller" : "realEstateSeller";

    // Check if user has active subscription with boosted visibility
    const subscription = await UserSubscription.findOne({
      userId,
      role,
      status: "active",
    }).populate("planId");

    if (!subscription) {
      return res.status(403).json({ message: "Active subscription required to boost listings" });
    }

    // Check if subscription is still valid
    const now = new Date();
    if (subscription.endDate < now) {
      subscription.status = "expired";
      await subscription.save();
      return res.status(403).json({ message: "Your subscription has expired" });
    }

    // Check if plan supports boosted visibility
    const plan = subscription.planId;
    if (!plan.features.boostedVisibility) {
      return res.status(403).json({ message: "Your plan does not support boosted visibility" });
    }

    // Verify item exists and belongs to user
    let item = null;
    if (itemType === "product") {
      item = await Product.findOne({ _id: itemId, owner: userId });
    } else {
      item = await Property.findOne({ _id: itemId, owner: userId });
    }

    if (!item) {
      return res.status(404).json({ message: "Item not found or you don't own it" });
    }

    // Check if already boosted or featured
    const existingFeatured = await FeaturedListing.findOne({
      itemId,
      itemType,
      endDate: { $gte: now },
    });

    let featuredListing;
    if (existingFeatured) {
      // Update existing featured listing to be boosted
      existingFeatured.isBoosted = true;
      existingFeatured.priorityScore = 20; // Higher priority for boosted
      if (duration) {
        const newEndDate = new Date();
        newEndDate.setDate(newEndDate.getDate() + duration);
        existingFeatured.endDate = newEndDate;
      }
      await existingFeatured.save();
      featuredListing = existingFeatured;
    } else {
      // Create new boosted listing
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + duration);

      featuredListing = await FeaturedListing.create({
        itemType,
        itemId,
        itemModel: itemType === "product" ? "Product" : "Property",
        sellerId: userId,
        startDate,
        endDate,
        priorityScore: 20, // Higher priority for boosted
        isBoosted: true,
      });
    }

    // Track analytics
    try {
      await AnalyticsEvent.create({
        eventType: "listing_boosted",
        itemType,
        itemId,
        itemModel: itemType === "product" ? "Product" : "Property",
        ownerId: userId,
        userId: userId,
        metadata: {
          planId: plan._id.toString(),
          planName: plan.name,
          role,
          duration,
        },
      });
    } catch (analyticsError) {
      console.error("Failed to track boosted listing analytics:", analyticsError);
    }

    return res.status(201).json({
      message: "Listing boosted successfully",
      featuredListing,
    });
  } catch (error) {
    console.error("boostListing error", error);
    return res.status(500).json({ message: "Failed to boost listing" });
  }
};

