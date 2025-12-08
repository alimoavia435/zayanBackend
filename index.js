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

dotenv.config();

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
const clientOrigin =
  process.env.NODE_ENV === "development"
    ? "https://zayan-ruddy.vercel.app"
    : process.env.CLIENT_URL || "https://zayan-ruddy.vercel.app";

// Initialize Socket.io for real-time features
const io = new Server(server, {
  cors: {
    origin: clientOrigin,
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
    origin: clientOrigin,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Health check endpoint (important for Render deployment)
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Zayan Backend API is running",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
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

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 Listening on 0.0.0.0:${PORT}`);
});
