import express from "express";
import {
  getPublishedBlogs,
  getBlogBySlug,
  getBlogCategories,
} from "../controller/blogController.js";

const router = express.Router();

// Public routes (no auth required)
router.get("/", getPublishedBlogs);
router.get("/categories", getBlogCategories);
router.get("/:slug", getBlogBySlug);

export default router;

