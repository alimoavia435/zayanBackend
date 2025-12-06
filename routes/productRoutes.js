import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductsByStoreId,
  getAllProductsForBuyer,
  getProductByIdForBuyer,
  createProductReview,
  getProductReviews,
  likeProduct,
  unlikeProduct,
} from "../controller/productController.js";

const router = express.Router();

// Product routes - CRUD operations
router
  .route("/")
  .post(protect, createProduct)
  .get(protect, getProducts);

router
  .route("/:id")
  .get(protect, getProductById)
  .put(protect, updateProduct)
  .delete(protect, deleteProduct);

// Buyer routes - get products by store ID
router.get("/buyer/store/:storeId", protect, getProductsByStoreId);
// Buyer routes - get all products
router.get("/buyer/all", protect, getAllProductsForBuyer);
// Buyer routes - get product by ID
router.get("/buyer/:id", protect, getProductByIdForBuyer);

// Review routes
router.post("/buyer/:id/review", protect, createProductReview);
router.get("/buyer/:id/reviews", protect, getProductReviews);

// Like routes
router.post("/buyer/:id/like", protect, likeProduct);
router.post("/buyer/:id/unlike", protect, unlikeProduct);

export default router;

