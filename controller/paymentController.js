import Stripe from "stripe";
import Payment from "../model/Payment.js";
import SubscriptionPlan from "../model/SubscriptionPlan.js";
import User from "../model/User.js";
import UserSubscription from "../model/UserSubscription.js";
import AnalyticsEvent from "../model/AnalyticsEvent.js";
import { createNotification } from "./notificationController.js";

// Initialize Stripe with secret key from environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
});

// Create PaymentIntent for paid subscription
export const createPaymentIntent = async (req, res) => {
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

    // If plan is free, return freePlan flag
    if (plan.price === 0) {
      return res.status(200).json({
        freePlan: true,
        message: "This is a free plan",
      });
    }

    // Create Stripe PaymentIntent
    const amount = Math.round(plan.price * 100); // Convert to cents

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      metadata: {
        userId: userId.toString(),
        planId: planId.toString(),
        role,
        planName: plan.name,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });
    // console.log(paymentIntent,"paymentIntent checking here");

    // Save payment record with pending status
    await Payment.create({
      userId,
      planId,
      role,
      paymentIntentId: paymentIntent.id,
      amount: plan.price,
      currency: "usd",
      status: "pending",
      metadata: {
        planName: plan.name,
        billingPeriod: plan.billingPeriod || "monthly",
        duration: plan.duration.toString(),
      },
    });

    return res.status(200).json({
      freePlan: false,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("createPaymentIntent error", error);
    return res.status(500).json({ message: "Failed to create payment intent", error: error.message });
  }
};

// Handle webhook events from Stripe
export const handleWebhook = async (req, res) => {
  console.log("Stripe webhook received:");
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return res.status(500).json({ message: "Webhook secret not configured" });
  }

  let event;

  try {
    // Use rawBody for signature verification
    const payload = req.rawBody || req.body;
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
console.log(event,"event checking here");
  // Handle the event
  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSuccess(event.data.object, req.app);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailure(event.data.object, req.app);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Error handling webhook:", error);
    res.status(500).json({ message: "Webhook handler failed", error: error.message });
  }
};

// Handle successful payment
async function handlePaymentSuccess(paymentIntent, app) {
  console.log(`[Stripe Webhook] Processing successful payment intent: ${paymentIntent.id}`);
  try {
    const { id: paymentIntentId, metadata } = paymentIntent;

    // Find payment record
    const payment = await Payment.findOne({ paymentIntentId });
    if (!payment) {
      console.error(`[Stripe Webhook] Payment record not found for paymentIntentId: ${paymentIntentId}`);
      return;
    }

    // Prevent duplicate processing (idempotency check)
    if (payment.status === "succeeded") {
      console.log(`[Stripe Webhook] Payment ${paymentIntentId} already processed`);
      return;
    }

    // Update payment status
    payment.status = "succeeded";
    payment.processedAt = new Date();
    await payment.save();
    console.log(`[Stripe Webhook] Payment record updated to succeeded: ${paymentIntentId}`);

    const userId = payment.userId;
    const planId = payment.planId;
    const role = payment.role;

    // Get plan details
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      console.error(`[Stripe Webhook] Plan not found: ${planId}`);
      return;
    }

    // Cancel any existing active subscription for this role
    const cancelResult = await UserSubscription.updateMany(
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
    console.log(`[Stripe Webhook] Cancelled ${cancelResult.modifiedCount} existing active subscriptions`);

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
    console.log(`[Stripe Webhook] Created new subscription: ${subscription._id} for plan: ${plan.name}`);

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
          paymentIntentId,
        },
      });
      console.log(`[Stripe Webhook] Analytics tracked for subscription: ${subscription._id}`);
    } catch (analyticsError) {
      console.error("[Stripe Webhook] Failed to track subscription analytics:", analyticsError);
    }

    // Send notification
    const io = app ? app.get("io") : null;
    try {
      await createNotification({
        userId: userId.toString(),
        type: "subscription_activated",
        title: "Subscription Activated",
        message: `Your ${plan.name} subscription for ${role} has been activated! Payment successful.`,
        actionUrl: role === "ecommerceSeller" 
          ? "/ecommerce/seller/subscription"
          : "/real-estate/seller/subscription",
        metadata: {
          planId: plan._id.toString(),
          planName: plan.name,
          role,
          paymentIntentId,
        },
        sendEmail: true,
        io,
      });
      console.log(`[Stripe Webhook] Notification sent to user: ${userId}`);
    } catch (notifError) {
      console.error("[Stripe Webhook] Failed to send subscription notification:", notifError);
    }

    console.log(`[Stripe Webhook] ✅ Payment processing complete for intent: ${paymentIntentId}`);
  } catch (error) {
    console.error("[Stripe Webhook] ❌ Error in handlePaymentSuccess:", error);
    throw error;
  }
}

// Handle failed payment
async function handlePaymentFailure(paymentIntent, app) {
  try {
    const { id: paymentIntentId, last_payment_error } = paymentIntent;

    // Find payment record
    const payment = await Payment.findOne({ paymentIntentId });
    if (!payment) {
      console.error(`Payment record not found for paymentIntentId: ${paymentIntentId}`);
      return;
    }

    // Update payment status
    payment.status = "failed";
    payment.processedAt = new Date();
    payment.failureReason = last_payment_error?.message || "Payment failed";
    await payment.save();

    console.log(`❌ Payment failed: ${paymentIntentId} - ${payment.failureReason}`);
  } catch (error) {
    console.error("Error in handlePaymentFailure:", error);
    throw error;
  }
}

