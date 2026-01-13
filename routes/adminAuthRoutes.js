import express from "express";
import { loginAdmin, getCurrentAdmin } from "../controller/adminAuthController.js";
import { protectAdmin } from "../middleware/adminAuthMiddleware.js";

const router = express.Router();

// Public routes
router.post("/login", loginAdmin);

// Protected routes
router.get("/me", protectAdmin, getCurrentAdmin);

export default router;

