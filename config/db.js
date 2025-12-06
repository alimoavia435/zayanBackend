import mongoose from "mongoose";

// Cache the connection to reuse in serverless environments
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("❌ Error: MONGO_URI is not defined in .env file");
      // Don't exit in production - allow server to start
      if (process.env.NODE_ENV === 'production') {
        console.log("⚠️  Continuing without DB connection. Set MONGO_URI to connect.");
        return null;
      }
      process.exit(1);
    }

    // If we have a cached connection, return it (useful for reconnections)
    if (cached.conn) {
      console.log("✅ Using cached MongoDB connection");
      return cached.conn;
    }

    // If we don't have a connection promise, create one
    if (!cached.promise) {
      console.log('🔍 Connecting to MongoDB...');
      const opts = {
        bufferCommands: false,
      };

      cached.promise = mongoose.connect(process.env.MONGO_URI, opts).then((mongoose) => {
        console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
        return mongoose;
      });
    }

    // Wait for the connection promise
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error("💡 Tip: Check your MONGO_URI in the .env file");
    // In production, don't exit - allow retries
    if (process.env.NODE_ENV === 'production') {
      console.log("⚠️  Will retry connection later...");
      return null;
    }
    process.exit(1);
  }
};

export default connectDB;
