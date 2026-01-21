import express from "express";
import { getPolicyByType } from "../controller/policyController.js";

const router = express.Router();

// Public endpoint to fetch policy by type
router.get("/:type", getPolicyByType);

export default router;


