import express from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import propertyRoutes from "./routes/propertyRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import storeRoutes from "./routes/storeRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import verificationRoutes from "./routes/verificationRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import behaviorRoutes from "./routes/behaviorRoutes.js";
import recommendationRoutes from "./routes/recommendationRoutes.js";
import savedSearchRoutes from "./routes/savedSearchRoutes.js";
import adminAuthRoutes from "./routes/adminAuthRoutes.js";
import adminDashboardRoutes from "./routes/adminDashboardRoutes.js";
import adminVerificationRoutes from "./routes/adminVerificationRoutes.js";
import adminUserRoutes from "./routes/adminUserRoutes.js";
import adminModerationRoutes from "./routes/adminModerationRoutes.js";
import adminBlogRoutes from "./routes/adminBlogRoutes.js";
import blogRoutes from "./routes/blogRoutes.js";
import adminChatRoutes from "./routes/adminChatRoutes.js";
import adminReviewRoutes from "./routes/adminReviewRoutes.js";
import adminAnalyticsRoutes from "./routes/adminAnalyticsRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import policyRoutes from "./routes/policyRoutes.js";
import adminPolicyRoutes from "./routes/adminPolicyRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import adminSubscriptionRoutes from "./routes/adminSubscriptionRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import {
  getSupportConversation,
  sendSupportMessage,
} from "./controller/supportChatController.js";
import { protect } from "./middleware/authMiddleware.js";
import { checkExpiringSubscriptions } from "./utils/subscriptionExpirationService.js";

dotenv.config({ path: [".env.local", ".env"] });

// Connect to database (non-blocking for deployment)
connectDB().catch((error) => {
  console.error("Failed to connect to database:", error);
  // Don't exit immediately - allow server to start and retry connection
  // This helps with deployment where DB might not be immediately available
  console.log("⚠️  Server will continue without DB connection. Retrying...");
  // Retry connection after 5 seconds
  setTimeout(() => {
    connectDB().catch((err) => {
      console.error("Retry failed:", err);
    });
  }, 5000);
});

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  "https://zayan-ruddy.vercel.app",
  "http://localhost:3000",
];

// Initialize Socket.io for real-time features
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  socket.on("joinUser", (userId) => {
    if (userId) {
      socket.join(userId);
    }
  });

  socket.on("joinConversation", (conversationId) => {
    if (conversationId) {
      socket.join(conversationId);
    }
  });

  socket.on("leaveConversation", (conversationId) => {
    if (conversationId) {
      socket.leave(conversationId);
    }
  });
});

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl.startsWith("/api/payments/webhook")) {
        req.rawBody = buf;
      }
    },
  }),
);
app.use(cookieParser());

// Health check endpoint (important for Render deployment)
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Zayan Backend API is running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api", uploadRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/behavior", behaviorRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/saved-searches", savedSearchRoutes);
app.use("/api/policies", policyRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/payments", paymentRoutes);

// Admin routes - separate namespace
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/verifications", adminVerificationRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/moderation", adminModerationRoutes);
app.use("/api/admin/blogs", adminBlogRoutes);
app.use("/api/admin/chats", adminChatRoutes);
app.use("/api/admin/reviews", adminReviewRoutes);
app.use("/api/admin/analytics", adminAnalyticsRoutes);
app.use("/api/admin/policies", adminPolicyRoutes);
app.use("/api/admin/subscriptions", adminSubscriptionRoutes);

// Public blog routes
app.use("/api/blogs", blogRoutes);

// Report routes
app.use("/api/reports", reportRoutes);

// Support chat routes (user)
app.get("/api/support/conversation", protect, getSupportConversation);
app.post("/api/support/message", protect, sendSupportMessage);

// Subscription expiration check (runs every 6 hours)
setInterval(
  async () => {
    try {
      await checkExpiringSubscriptions(io);
      console.log("✅ Subscription expiration check completed");
    } catch (error) {
      console.error("❌ Subscription expiration check failed:", error);
    }
  },
  6 * 60 * 60 * 1000,
); // 6 hours

// Run immediately on startup (after server starts)
setTimeout(async () => {
  try {
    await checkExpiringSubscriptions(io);
    console.log("✅ Initial subscription expiration check completed");
  } catch (error) {
    console.error("❌ Initial subscription expiration check failed:", error);
  }
}, 5000); // Wait 5 seconds after server starts

const PORT = process.env.PORT || 5000;

// Only listen if not running on Vercel
if (!process.env.VERCEL) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`📡 Listening on 0.0.0.0:${PORT}`);
  });
}

// Export for Vercel
export default app;
