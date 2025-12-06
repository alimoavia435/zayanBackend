import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../controller/categoryController.js";

const router = express.Router();

// Category routes - CRUD operations
router
  .route("/")
  .post(protect, createCategory)
  .get(protect, getCategories);

router
  .route("/:id")
  .get(protect, getCategoryById)
  .put(protect, updateCategory)
  .delete(protect, deleteCategory);

export default router;

