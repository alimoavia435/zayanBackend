import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createStore,
  getStores,
  getStoreById,
  updateStore,
  deleteStore,
  getAllStoresForBuyer,
  getStoreByIdForBuyer,
  getStoresBySellerId,
  followStore,
  unfollowStore,
} from "../controller/storeController.js";

const router = express.Router();

// Seller routes - CRUD operations for stores
router
  .route("/")
  .post(protect, createStore)
  .get(protect, getStores);

router
  .route("/:id")
  .get(protect, getStoreById)
  .put(protect, updateStore)
  .delete(protect, deleteStore);

// Buyer routes - public view of stores
router.get("/buyer/all", protect, getAllStoresForBuyer);
router.get("/buyer/:id", protect, getStoreByIdForBuyer);

// Get stores by seller ID
router.get("/seller/:id", protect, getStoresBySellerId);

// Buyer routes - follow/unfollow stores
router.post("/buyer/:id/follow", protect, followStore);
router.post("/buyer/:id/unfollow", protect, unfollowStore);

export default router;

