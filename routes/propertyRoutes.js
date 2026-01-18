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

// Buyer routes - Public access (for landing page)
router.get("/buyer/all", getAllPropertiesForBuyer);
// Protected route for authenticated buyers (for detailed views)
router.get("/buyer/:id", getPropertyByIdForBuyer);

// Get properties by seller ID
router.get("/seller/:id", protect, getPropertiesBySellerId);

export default router;

