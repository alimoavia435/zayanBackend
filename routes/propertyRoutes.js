import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  getAllPropertiesForBuyer,
  getPropertyByIdForBuyer,
  getPropertiesBySellerId,
} from "../controller/propertyController.js";

const router = express.Router();

router
  .route("/")
  .post(protect, createProperty)
  .get(protect, getProperties);

router
  .route("/:id")
  .get(protect, getPropertyById)
  .put(protect, updateProperty)
  .delete(protect, deleteProperty);

// Buyer routes
router.get("/buyer/all", protect, getAllPropertiesForBuyer);
router.get("/buyer/:id", protect, getPropertyByIdForBuyer);

// Get properties by seller ID
router.get("/seller/:id", protect, getPropertiesBySellerId);

export default router;

