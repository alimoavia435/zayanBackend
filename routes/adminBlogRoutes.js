import express from "express";
import {
  getBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
} from "../controller/adminBlogController.js";
import { protectAdmin } from "../middleware/adminAuthMiddleware.js";

const router = express.Router();

// All routes require admin authentication
router.get("/", protectAdmin, getBlogs);
router.get("/:blogId", protectAdmin, getBlogById);
router.post("/", protectAdmin, createBlog);
router.put("/:blogId", protectAdmin, updateBlog);
router.delete("/:blogId", protectAdmin, deleteBlog);

export default router;

