import Store from "../model/Store.js";
import Product from "../model/Product.js";
import Property from "../model/Property.js";
import AdminActionLog from "../model/AdminActionLog.js";

// Get all stores (Admin only)
export const getStores = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status; // active, inactive
    const search = req.query.search;

    const query = {};

    if (status && ["active", "inactive"].includes(status)) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const stores = await Store.find(query)
      .populate("owner", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Store.countDocuments(query);

    return res.json({
      success: true,
      stores,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getStores error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get stores",
    });
  }
};

// Disable/Enable store (Admin only)
export const toggleStoreStatus = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { status } = req.body; // "active" or "inactive"
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    if (!status || !["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status (active or inactive) is required",
      });
    }

    const store = await Store.findById(storeId).populate("owner", "name email");

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }

    const previousStatus = store.status;
    store.status = status;
    await store.save();

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: status === "active" ? "store_enabled" : "store_disabled",
        targetType: "product", // Using product since store is a type of marketplace content
        targetId: store._id,
        details: {
          storeId: store._id.toString(),
          storeName: store.name,
          ownerEmail: store.owner?.email,
          previousStatus,
          newStatus: status,
        },
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
    }

    return res.json({
      success: true,
      message: `Store ${status === "active" ? "enabled" : "disabled"} successfully`,
      store: {
        _id: store._id,
        name: store.name,
        status: store.status,
      },
    });
  } catch (error) {
    console.error("toggleStoreStatus error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update store status",
    });
  }
};

// Get all products (Admin only)
export const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status; // active, inactive, out_of_stock
    const search = req.query.search;

    const query = {};

    if (status && ["active", "inactive", "out_of_stock"].includes(status)) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const products = await Product.find(query)
      .populate("owner", "name email")
      .populate("store", "name")
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments(query);

    return res.json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getProducts error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get products",
    });
  }
};

// Remove/Restore product (Admin only)
export const toggleProductStatus = async (req, res) => {
  try {
    const { productId } = req.params;
    const { status } = req.body; // "active" or "inactive"
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    if (!status || !["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status (active or inactive) is required",
      });
    }

    const product = await Product.findById(productId).populate("owner", "name email").populate("store", "name");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const previousStatus = product.status;
    product.status = status;
    await product.save();

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: status === "active" ? "product_approved" : "product_removed",
        targetType: "product",
        targetId: product._id,
        details: {
          productId: product._id.toString(),
          productName: product.name,
          ownerEmail: product.owner?.email,
          storeName: product.store?.name,
          previousStatus,
          newStatus: status,
        },
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
    }

    return res.json({
      success: true,
      message: `Product ${status === "active" ? "restored" : "removed"} successfully`,
      product: {
        _id: product._id,
        name: product.name,
        status: product.status,
      },
    });
  } catch (error) {
    console.error("toggleProductStatus error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update product status",
    });
  }
};

// Get all properties (Admin only)
export const getProperties = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status; // active, inactive
    const search = req.query.search;

    const query = {};

    if (status) {
      query.status = status;
    } else {
      // Default to showing all
      query.status = { $exists: true };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
        { state: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const properties = await Property.find(query)
      .populate("owner", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Property.countDocuments(query);

    return res.json({
      success: true,
      properties,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getProperties error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get properties",
    });
  }
};

// Unpublish/Publish property (Admin only)
export const togglePropertyStatus = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { status } = req.body; // "active" or "inactive"
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    if (!status || !["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status (active or inactive) is required",
      });
    }

    const property = await Property.findById(propertyId).populate("owner", "name email");

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const previousStatus = property.status;
    property.status = status;
    await property.save();

    // Log admin action
    try {
      await AdminActionLog.create({
        adminId,
        adminEmail,
        action: status === "active" ? "property_published" : "property_unpublished",
        targetType: "property",
        targetId: property._id,
        details: {
          propertyId: property._id.toString(),
          propertyTitle: property.title,
          ownerEmail: property.owner?.email,
          previousStatus,
          newStatus: status,
        },
        ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (logError) {
      console.error("Failed to log admin action:", logError);
    }

    return res.json({
      success: true,
      message: `Property ${status === "active" ? "published" : "unpublished"} successfully`,
      property: {
        _id: property._id,
        title: property.title,
        status: property.status,
      },
    });
  } catch (error) {
    console.error("togglePropertyStatus error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update property status",
    });
  }
};

