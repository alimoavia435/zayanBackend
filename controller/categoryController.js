import Category from "../model/Category.js";
import Product from "../model/Product.js";

export const createCategory = async (req, res) => {
  try {
    const { store, name, description, icon } = req.body;

    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!store || !name) {
      return res.status(400).json({
        message: "Please provide store and category name",
      });
    }

    const category = await Category.create({
      store,
      owner: req.user._id,
      name,
      description: description || "",
      icon: icon || "📦",
    });

    return res.status(201).json({
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error("createCategory error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Get all categories of the authenticated user
export const getCategories = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { store } = req.query;

    // Build filter
    const filter = { owner: req.user._id };
    if (store) {
      filter.store = store;
    }

    const categories = await Category.find(filter)
      .populate("store", "name")
      .sort({ createdAt: -1 });

    // Calculate actual product counts for each category
    const categoriesWithProductCounts = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Product.countDocuments({ category: category._id });
        return {
          ...category.toObject(),
          products: productCount,
        };
      })
    );

    return res.json({
      message: "Categories fetched successfully",
      count: categoriesWithProductCounts.length,
      categories: categoriesWithProductCounts,
    });
  } catch (error) {
    console.error("getCategories error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Get category by id
export const getCategoryById = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const category = await Category.findOne({
      _id: id,
      owner: req.user._id,
    }).populate("store", "name");

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Calculate actual product count for this category
    const productCount = await Product.countDocuments({ category: category._id });

    const categoryWithProductCount = {
      ...category.toObject(),
      products: productCount,
    };

    return res.json({
      message: "Category fetched successfully",
      category: categoryWithProductCount,
    });
  } catch (error) {
    console.error("getCategoryById error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Update category
export const updateCategory = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const { name, description, icon, status } = req.body;

    const category = await Category.findOne({
      _id: id,
      owner: req.user._id,
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Update fields if provided
    if (name !== undefined) category.name = name;
    if (description !== undefined) category.description = description;
    if (icon !== undefined) category.icon = icon;
    if (status !== undefined) category.status = status;

    await category.save();

    return res.json({
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    console.error("updateCategory error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Delete category
export const deleteCategory = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const deleted = await Category.findOneAndDelete({
      _id: id,
      owner: req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("deleteCategory error", error);
    return res.status(500).json({ message: error.message });
  }
};

