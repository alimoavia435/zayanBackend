import express from "express";
import {
  getStores,
  toggleStoreStatus,
  getProducts,
  toggleProductStatus,
  getProperties,
  togglePropertyStatus,
} from "../controller/adminModerationController.js";
import { protectAdmin } from "../middleware/adminAuthMiddleware.js";

const router = express.Router();

// All routes require admin authentication
router.get("/stores", protectAdmin, getStores);
router.post("/stores/:storeId/toggle-status", protectAdmin, toggleStoreStatus);

router.get("/products", protectAdmin, getProducts);
router.post("/products/:productId/toggle-status", protectAdmin, toggleProductStatus);

router.get("/properties", protectAdmin, getProperties);
router.post("/properties/:propertyId/toggle-status", protectAdmin, togglePropertyStatus);

export default router;

