import Blog from "../model/Blog.js";
import AdminActionLog from "../model/AdminActionLog.js";

// Generate slug from title
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

// Get all blogs (Admin only)
export const getBlogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status; // draft, published, archived
    const category = req.query.category;
    const search = req.query.search;

    const query = {};

    if (status && ["draft", "published", "archived"].includes(status)) {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { excerpt: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const blogs = await Blog.find(query)
      .populate("author", "email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Blog.countDocuments(query);

    return res.json({
      success: true,
      blogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getBlogs error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get blogs",
    });
  }
};

// Get single blog (Admin only)
export const getBlogById = async (req, res) => {
  try {
    const { blogId } = req.params;

    const blog = await Blog.findById(blogId).populate("author", "email").lean();

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    return res.json({
      success: true,
      blog,
    });
  } catch (error) {
    console.error("getBlogById error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get blog",
    });
  }
};

// Create blog (Admin only)
export const createBlog = async (req, res) => {
  try {
    const {
      title,
      content,
      excerpt,
      category,
      featuredImage,
      status,
      metaTitle,
      metaDescription,
      metaKeywords,
      isFeatured,
    } = req.body;

    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    if (!title || !content || !category) {
      return res.status(400).json({
        success: false,
        message: "Title, content, and category are required",
      });
    }

    // Generate slug
    let slug = generateSlug(title);
    let counter = 1;
    const baseSlug = slug;

    // Ensure unique slug
    while (await Blog.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const blog = await Blog.create({
      title,
      slug,
      content,
      excerpt: excerpt || content.substring(0, 200),
      author: adminId,
      authorName: adminEmail.split("@")[0], // Use email username as author name
      category,
      featuredImage: featuredImage || null,
      status: status || "draft",
      metaTitle: metaTitle || title,
      metaDescription: metaDescription || excerpt || content.substring(0, 160),
      metaKeywords: metaKeywords || [],
      isFeatured: isFeatured || false,
      publishedAt: status === "published" ? new Date() : null,
    });

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: "content_approved",
        targetType: "system",
        targetId: blog._id,
        details: {
          blogId: blog._id.toString(),
          blogTitle: blog.title,
          status: blog.status,
        },
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
    }

    return res.status(201).json({
      success: true,
      message: "Blog created successfully",
      blog,
    });
  } catch (error) {
    console.error("createBlog error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create blog",
    });
  }
};

// Update blog (Admin only)
export const updateBlog = async (req, res) => {
  try {
    const { blogId } = req.params;
    const {
      title,
      content,
      excerpt,
      category,
      featuredImage,
      status,
      metaTitle,
      metaDescription,
      metaKeywords,
      isFeatured,
    } = req.body;

    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    const blog = await Blog.findById(blogId);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Update fields
    if (title !== undefined) {
      blog.title = title;
      // Regenerate slug if title changed
      if (title !== blog.title) {
        let slug = generateSlug(title);
        let counter = 1;
        const baseSlug = slug;
        while (await Blog.findOne({ slug, _id: { $ne: blogId } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
        blog.slug = slug;
      }
    }
    if (content !== undefined) blog.content = content;
    if (excerpt !== undefined) blog.excerpt = excerpt;
    if (category !== undefined) blog.category = category;
    if (featuredImage !== undefined) blog.featuredImage = featuredImage;
    if (status !== undefined) {
      blog.status = status;
      if (status === "published" && !blog.publishedAt) {
        blog.publishedAt = new Date();
      }
    }
    if (metaTitle !== undefined) blog.metaTitle = metaTitle;
    if (metaDescription !== undefined) blog.metaDescription = metaDescription;
    if (metaKeywords !== undefined) blog.metaKeywords = metaKeywords;
    if (isFeatured !== undefined) blog.isFeatured = isFeatured;

    await blog.save();

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: "content_approved",
        targetType: "system",
        targetId: blog._id,
        details: {
          blogId: blog._id.toString(),
          blogTitle: blog.title,
          status: blog.status,
          action: "updated",
        },
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
    }

    return res.json({
      success: true,
      message: "Blog updated successfully",
      blog,
    });
  } catch (error) {
    console.error("updateBlog error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update blog",
    });
  }
};

// Delete blog (Admin only)
export const deleteBlog = async (req, res) => {
  try {
    const { blogId } = req.params;
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    const blog = await Blog.findById(blogId);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    await Blog.findByIdAndDelete(blogId);

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: "content_removed",
        targetType: "system",
        targetId: blog._id,
        details: {
          blogId: blog._id.toString(),
          blogTitle: blog.title,
        },
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
    }

    return res.json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (error) {
    console.error("deleteBlog error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete blog",
    });
  }
};

