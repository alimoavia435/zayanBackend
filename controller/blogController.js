import Blog from "../model/Blog.js";

// Get all published blogs (Public)
export const getPublishedBlogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const category = req.query.category;
    const search = req.query.search;
    const featured = req.query.featured === "true";
    const type = req.query.type; // "real-estate" or "ecommerce"

    const query = { status: "published" };

    // Filter by type (Real Estate or E-commerce) based on category prefix
    if (type === "real-estate") {
      if (category) {
        // If specific category provided, ensure it matches type and use exact match
        query.category = category;
      } else {
        // Filter by type pattern
        query.category = { $regex: "^Real Estate", $options: "i" };
      }
    } else if (type === "ecommerce") {
      if (category) {
        // If specific category provided, ensure it matches type and use exact match
        query.category = category;
      } else {
        // Filter by type pattern
        query.category = { $regex: "^E-commerce", $options: "i" };
      }
    } else if (category) {
      // No type filter, just use category
      query.category = category;
    }

    if (featured) {
      query.isFeatured = true;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { excerpt: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const blogs = await Blog.find(query)
      .select("-content -metaKeywords") // Exclude full content and keywords from list
      .sort({ publishedAt: -1, createdAt: -1 })
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
    console.error("getPublishedBlogs error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get blogs",
    });
  }
};

// Get single blog by slug (Public)
export const getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const blog = await Blog.findOne({ slug, status: "published" }).lean();

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Increment views
    await Blog.findByIdAndUpdate(blog._id, { $inc: { views: 1 } });

    return res.json({
      success: true,
      blog,
    });
  } catch (error) {
    console.error("getBlogBySlug error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get blog",
    });
  }
};

// Get blog categories (Public)
export const getBlogCategories = async (req, res) => {
  try {
    const type = req.query.type; // "real-estate" or "ecommerce"

    let matchQuery = { status: "published" };

    // Filter by type if provided
    if (type === "real-estate") {
      matchQuery.category = { $regex: "^Real Estate", $options: "i" };
    } else if (type === "ecommerce") {
      matchQuery.category = { $regex: "^E-commerce", $options: "i" };
    }

    const categories = await Blog.distinct("category", matchQuery);

    // Get count for each category
    const categoryCounts = await Blog.aggregate([
      { $match: matchQuery },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);

    const categoriesWithCounts = categories.map((category) => {
      const countData = categoryCounts.find((c) => c._id === category);
      return {
        name: category,
        count: countData ? countData.count : 0,
      };
    });

    return res.json({
      success: true,
      categories: categoriesWithCounts,
    });
  } catch (error) {
    console.error("getBlogCategories error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get categories",
    });
  }
};

