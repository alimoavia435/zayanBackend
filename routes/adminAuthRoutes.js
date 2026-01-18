import express from "express";
import { loginAdmin, getCurrentAdmin, changeAdminPassword } from "../controller/adminAuthController.js";
import { protectAdmin } from "../middleware/adminAuthMiddleware.js";

const router = express.Router();

// Public routes
router.post("/login", loginAdmin);

// Protected routes
router.get("/me", protectAdmin, getCurrentAdmin);
router.put("/change-password", protectAdmin, changeAdminPassword);

export default router;

