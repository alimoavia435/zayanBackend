import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Admin from "../model/Admin.js";

// Load environment variables
dotenv.config();

const createAdmin = async () => {
  try {
    // Get credentials from command line arguments or use defaults
    const email = process.argv[2] || "admin@zayan.com";
    const password = process.argv[3] || "admin123";
    const role = process.argv[4] || "superAdmin";

    // Validate role
    const validRoles = ["superAdmin", "moderator", "support"];
    if (!validRoles.includes(role)) {
      console.error(`❌ Invalid role. Must be one of: ${validRoles.join(", ")}`);
      process.exit(1);
    }

    // Check if MONGO_URI is set
    if (!process.env.MONGO_URI) {
      console.error("❌ Error: MONGO_URI is not defined in .env file");
      process.exit(1);
    }

    console.log("🔍 Connecting to MongoDB...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      console.log(`⚠️  Admin with email ${email} already exists!`);
      console.log("   If you want to update the password, please delete the existing admin first or use a different email.");
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log("\n📝 Creating admin user...");
    console.log(`   Email: ${email}`);
    console.log(`   Role: ${role}`);
    console.log(`   Password: ${"*".repeat(password.length)}`);

    // Hash password manually
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin data
    const adminData = {
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role,
      permissions: [], // SuperAdmin has all permissions automatically
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Insert directly into collection to bypass Mongoose middleware
    const result = await Admin.collection.insertOne(adminData);
    
    // Fetch the created admin to return full data
    const admin = await Admin.findById(result.insertedId);

    console.log("\n✅ Admin user created successfully!");
    console.log(`\n📋 Admin Details:`);
    console.log(`   ID: ${admin._id}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Status: ${admin.isActive ? "Active" : "Inactive"}`);
    console.log(`\n🔑 You can now login with:`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: ${password}`);
    console.log(`\n⚠️  Please change the password after first login for security!`);

    // Close connection
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin:", error.message);
    if (error.code === 11000) {
      console.error("   Email already exists in the database");
    }
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
};

// Run the script
createAdmin();

