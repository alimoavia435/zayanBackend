import express from "express";
import { getPolicyByType, upsertPolicy } from "../controller/policyController.js";
import { protectAdmin, checkPermission } from "../middleware/adminAuthMiddleware.js";

const router = express.Router();

// Admin-only endpoints for policies
router.get("/:type", protectAdmin, getPolicyByType);
router.put("/:type", protectAdmin, checkPermission("manage_policies"), upsertPolicy);
router.post("/:type", protectAdmin, checkPermission("manage_policies"), upsertPolicy);

export default router;


