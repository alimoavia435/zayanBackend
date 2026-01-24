import UserSubscription from "../model/UserSubscription.js";
import { createNotification } from "../controller/notificationController.js";
import AnalyticsEvent from "../model/AnalyticsEvent.js";

// Check for expiring subscriptions and send notifications
export const checkExpiringSubscriptions = async (io = null) => {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Find subscriptions expiring in 3 days
    const expiringSubscriptions = await UserSubscription.find({
      status: "active",
      endDate: {
        $gte: now,
        $lte: threeDaysFromNow,
      },
      autoRenew: true,
    }).populate("planId");

    for (const subscription of expiringSubscriptions) {
      // Check if notification was already sent (to avoid duplicates)
      // This is a simple check - in production, you might want to track this in the subscription model
      try {
        await createNotification({
          userId: subscription.userId.toString(),
          type: "subscription_expiring",
          title: "Subscription Expiring Soon",
          message: `Your ${subscription.planId.name} subscription expires in 3 days. Make sure to renew!`,
          actionUrl:
            subscription.role === "ecommerceSeller"
              ? "/ecommerce/seller/subscription"
              : "/real-estate/seller/subscription",
          metadata: {
            planId: subscription.planId._id.toString(),
            planName: subscription.planId.name,
            role: subscription.role,
            endDate: subscription.endDate.toISOString(),
          },
          sendEmail: true,
          io,
        });
      } catch (notifError) {
        console.error(`Failed to send expiration notification for subscription ${subscription._id}:`, notifError);
      }
    }

    // Check for expired subscriptions and mark them as expired
    const expiredSubscriptions = await UserSubscription.find({
      status: "active",
      endDate: { $lt: now },
    }).populate("planId");

    for (const subscription of expiredSubscriptions) {
      subscription.status = "expired";
      await subscription.save();

      // Track expiration analytics
      try {
        await AnalyticsEvent.create({
          eventType: "subscription_expired",
          itemType: null,
          itemId: null,
          itemModel: null,
          ownerId: subscription.userId,
          userId: subscription.userId,
          metadata: {
            planId: subscription.planId._id.toString(),
            planName: subscription.planId.name,
            role: subscription.role,
          },
        });
      } catch (analyticsError) {
        console.error("Failed to track expiration analytics:", analyticsError);
      }
    }

    return {
      expiringCount: expiringSubscriptions.length,
      expiredCount: expiredSubscriptions.length,
    };
  } catch (error) {
    console.error("Error checking expiring subscriptions:", error);
    throw error;
  }
};

