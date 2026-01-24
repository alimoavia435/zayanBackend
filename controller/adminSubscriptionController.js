import SubscriptionPlan from "../model/SubscriptionPlan.js";
import UserSubscription from "../model/UserSubscription.js";
import User from "../model/User.js";
import AnalyticsEvent from "../model/AnalyticsEvent.js";

// Get all subscription plans
export const getPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ price: 1 });

    return res.status(200).json({
      message: "Plans retrieved successfully",
      plans,
    });
  } catch (error) {
    console.error("getPlans error", error);
    return res.status(500).json({ message: "Failed to retrieve plans" });
  }
};

// Create a new subscription plan
export const createPlan = async (req, res) => {
  try {
    const {
      name,
      price,
      billingPeriod = "monthly",
      duration = 30,
      features,
      targetRole,
      isActive = true,
    } = req.body;

    if (!name || !targetRole) {
      return res.status(400).json({ message: "name and targetRole are required" });
    }

    if (!["Basic", "Pro", "Premium"].includes(name)) {
      return res.status(400).json({ message: "name must be Basic, Pro, or Premium" });
    }

    if (!["monthly", "yearly"].includes(billingPeriod)) {
      return res.status(400).json({ message: "billingPeriod must be monthly or yearly" });
    }

    // Basic plan should be free (price = 0)
    const finalPrice = name === "Basic" ? 0 : (price || 0);
    
    // Set duration based on billing period if not provided
    const finalDuration = duration || (billingPeriod === "yearly" ? 365 : 30);

    if (!["ecommerceSeller", "realEstateSeller", "both"].includes(targetRole)) {
      return res.status(400).json({ message: "Invalid targetRole" });
    }

    // Set default features for Basic plan
    const defaultFeatures = name === "Basic" ? {
      maxListings: features?.maxListings ?? 1,
      featuredListingsCount: features?.featuredListingsCount ?? 0,
      boostedVisibility: features?.boostedVisibility ?? false,
      prioritySupport: features?.prioritySupport ?? false,
    } : {
      maxListings: features?.maxListings ?? 0,
      featuredListingsCount: features?.featuredListingsCount ?? 0,
      boostedVisibility: features?.boostedVisibility ?? false,
      prioritySupport: features?.prioritySupport ?? false,
    };

    const plan = await SubscriptionPlan.create({
      name,
      price: finalPrice,
      billingPeriod,
      duration: finalDuration,
      features: defaultFeatures,
      targetRole,
      isActive,
    });

    return res.status(201).json({
      message: "Plan created successfully",
      plan,
    });
  } catch (error) {
    console.error("createPlan error", error);
    return res.status(500).json({ message: "Failed to create plan" });
  }
};

// Update a subscription plan
export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    // Validate enum values if provided
    if (updateData.name && !["Basic", "Pro", "Premium"].includes(updateData.name)) {
      return res.status(400).json({ message: "Invalid plan name" });
    }

    if (updateData.targetRole && !["ecommerceSeller", "realEstateSeller", "both"].includes(updateData.targetRole)) {
      return res.status(400).json({ message: "Invalid targetRole" });
    }

    // Update plan
    Object.keys(updateData).forEach((key) => {
      if (key === "features" && updateData[key]) {
        plan.features = { ...plan.features, ...updateData[key] };
      } else if (key !== "features") {
        plan[key] = updateData[key];
      }
    });

    await plan.save();

    return res.status(200).json({
      message: "Plan updated successfully",
      plan,
    });
  } catch (error) {
    console.error("updatePlan error", error);
    return res.status(500).json({ message: "Failed to update plan" });
  }
};

// Delete a subscription plan
export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    // Check if plan has active subscriptions
    const activeSubscriptions = await UserSubscription.countDocuments({
      planId: id,
      status: "active",
    });

    if (activeSubscriptions > 0) {
      return res.status(400).json({
        message: `Cannot delete plan with ${activeSubscriptions} active subscription(s). Deactivate it instead.`,
      });
    }

    await SubscriptionPlan.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Plan deleted successfully",
    });
  } catch (error) {
    console.error("deletePlan error", error);
    return res.status(500).json({ message: "Failed to delete plan" });
  }
};

// Get all user subscriptions
export const getUserSubscriptions = async (req, res) => {
  try {
    const { status, role, userId, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (role) query.role = role;
    if (userId) query.userId = userId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const subscriptions = await UserSubscription.find(query)
      .populate("userId", "name email")
      .populate("planId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await UserSubscription.countDocuments(query);

    return res.status(200).json({
      message: "Subscriptions retrieved successfully",
      subscriptions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("getUserSubscriptions error", error);
    return res.status(500).json({ message: "Failed to retrieve subscriptions" });
  }
};

// Get subscription analytics
export const getSubscriptionAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Total subscriptions
    const totalSubscriptions = await UserSubscription.countDocuments();
    const activeSubscriptions = await UserSubscription.countDocuments({ status: "active" });
    const expiredSubscriptions = await UserSubscription.countDocuments({ status: "expired" });

    // Revenue (sum of all active subscriptions)
    const activeSubs = await UserSubscription.find({ status: "active" }).populate("planId");
    const totalRevenue = activeSubs.reduce((sum, sub) => {
      return sum + (sub.planId?.price || 0);
    }, 0);

    // Subscriptions by plan
    const subscriptionsByPlan = await UserSubscription.aggregate([
      {
        $match: { status: "active" },
      },
      {
        $group: {
          _id: "$planId",
          count: { $sum: 1 },
        },
      },
    ]);

    // Populate plan names
    const planDetails = await Promise.all(
      subscriptionsByPlan.map(async (item) => {
        const plan = await SubscriptionPlan.findById(item._id);
        return {
          planName: plan?.name || "Unknown",
          count: item.count,
        };
      })
    );

    // Recent subscriptions
    const recentSubscriptions = await UserSubscription.find({
      createdAt: { $gte: startDate },
    })
      .populate("userId", "name email")
      .populate("planId")
      .sort({ createdAt: -1 })
      .limit(10);

    // Subscriptions by role
    const subscriptionsByRole = await UserSubscription.aggregate([
      {
        $match: { status: "active" },
      },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    return res.status(200).json({
      message: "Analytics retrieved successfully",
      analytics: {
        overview: {
          totalSubscriptions,
          activeSubscriptions,
          expiredSubscriptions,
          totalRevenue,
        },
        subscriptionsByPlan: planDetails,
        subscriptionsByRole,
        recentSubscriptions,
      },
    });
  } catch (error) {
    console.error("getSubscriptionAnalytics error", error);
    return res.status(500).json({ message: "Failed to retrieve analytics" });
  }
};

// Manually activate/deactivate a user subscription
export const updateUserSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, autoRenew, endDate } = req.body;

    const subscription = await UserSubscription.findById(id).populate("planId");
    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    if (status && !["active", "expired", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    if (status) subscription.status = status;
    if (autoRenew !== undefined) subscription.autoRenew = autoRenew;
    if (endDate) subscription.endDate = new Date(endDate);

    await subscription.save();

    // Send notification if status changed
    if (status && status !== subscription.status) {
      const io = req.app.get("io");
      try {
        const { createNotification } = await import("./notificationController.js");
        await createNotification({
          userId: subscription.userId.toString(),
          type: status === "active" ? "subscription_activated" : "subscription_expiring",
          title: status === "active" ? "Subscription Activated" : "Subscription Updated",
          message: status === "active"
            ? `Your ${subscription.planId.name} subscription has been activated by admin.`
            : `Your subscription status has been updated to ${status}.`,
          actionUrl: subscription.role === "ecommerceSeller"
            ? "/ecommerce/seller/subscription"
            : "/real-estate/seller/subscription",
          sendEmail: true,
          io,
        });
      } catch (notifError) {
        console.error("Failed to send notification:", notifError);
      }
    }

    return res.status(200).json({
      message: "Subscription updated successfully",
      subscription,
    });
  } catch (error) {
    console.error("updateUserSubscription error", error);
    return res.status(500).json({ message: "Failed to update subscription" });
  }
};

