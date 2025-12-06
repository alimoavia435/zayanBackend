import Property from "../model/Property.js";
import { buildProfileResponse } from "./profileController.js";

export const createProperty = async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      city,
      state,
      price,
      beds,
      baths,
      sqft,
      yearBuilt,
      propertyType,
      amenities = [],
      images = [],
    } = req.body;

    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!Array.isArray(images) || images.length === 0) {
      return res
        .status(400)
        .json({ message: "Please upload at least one property image" });
    }

    const property = await Property.create({
      owner: req.user._id,
      title,
      description,
      location,
      city,
      state,
      price,
      beds,
      baths,
      sqft,
      yearBuilt,
      propertyType,
      amenities,
      images,
    });

    return res
      .status(201)
      .json({ message: "Property created successfully", property });
  } catch (error) {
    console.error("createProperty error", error);
    return res.status(500).json({ message: error.message });
  }
};

// get all properties
export const getProperties = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const properties = await Property.find({ owner: req.user._id }).sort({
      createdAt: -1,
    });

    return res.json({
      message: "Properties fetched successfully",
      count: properties.length,
      properties,
    });
  } catch (error) {
    console.error("getProperties error", error);
    return res.status(500).json({ message: error.message });
  }
};

// get property by id
export const getPropertyById = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const property = await Property.findOne({
      _id: id,
      owner: req.user._id,
    });

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    return res.json({
      message: "Property fetched successfully",
      property,
    });
  } catch (error) {
    console.error("getPropertyById error", error);
    return res.status(500).json({ message: error.message });
  }
};
//update property
export const updateProperty = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const {
      title,
      description,
      location,
      city,
      state,
      price,
      beds,
      baths,
      sqft,
      yearBuilt,
      propertyType,
      amenities = [],
      images = [],
      status,
    } = req.body;

    if (!Array.isArray(images) || images.length === 0) {
      return res
        .status(400)
        .json({ message: "Please provide at least one property image" });
    }

    const property = await Property.findOne({
      _id: id,
      owner: req.user._id,
    });

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    const updates = {
      title,
      description,
      location,
      city,
      state,
      price,
      beds,
      baths,
      sqft,
      yearBuilt,
      propertyType,
      amenities,
      images,
      status,
    };

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        property[key] = value;
      }
    });

    await property.save();

    return res.json({
      message: "Property updated successfully",
      property,
    });
  } catch (error) {
    console.error("updateProperty error", error);
    return res.status(500).json({ message: error.message });
  }
};
// delete property
export const deleteProperty = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const deleted = await Property.findOneAndDelete({
      _id: id,
      owner: req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Property not found" });
    }

    return res.json({ message: "Property deleted successfully" });
  } catch (error) {
    console.error("deleteProperty error", error);
    return res.status(500).json({ message: error.message });
  }
};
// get all properties for buyer
export const getAllPropertiesForBuyer = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Get query parameters for filtering
    const {
      searchTerm,
      city,
      state,
      minPrice,
      maxPrice,
      beds,
      baths,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    // Build filter object
    const filter = {
      status: "active", // Only show active properties
    };

    // Add location filters
    if (city) {
      filter.city = { $regex: city, $options: "i" };
    }
    if (state) {
      filter.state = { $regex: state, $options: "i" };
    }

    // Add price range
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Add beds filter
    if (beds && Number(beds) > 0) {
      filter.beds = { $gte: Number(beds) };
    }

    // Add baths filter
    if (baths && Number(baths) > 0) {
      filter.baths = { $gte: Number(baths) };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = order === "asc" ? 1 : -1;

    // Find properties (without populating owner yet)
    let properties = await Property.find(filter)
      .sort(sort)
      .lean();

    // Apply search term filter (searches in title, description, location)
    if (searchTerm) {
      const searchRegex = new RegExp(searchTerm, "i");
      properties = properties.filter(
        (property) =>
          searchRegex.test(property.title) ||
          searchRegex.test(property.description) ||
          searchRegex.test(property.location) ||
          searchRegex.test(property.city) ||
          searchRegex.test(property.state)
      );
    }

    // Format response with seller information (using seller profile)
    const formattedProperties = await Promise.all(
      properties.map(async (property) => {
        // Get seller profile using buildProfileResponse with realestate_seller role
        const sellerProfile = await buildProfileResponse(
          property.owner?.toString() || property.owner,
          "realestate_seller"
        );

        // Use seller profile data, fallback to owner basic data if profile not found
        let sellerName = "Unknown Seller";
        let sellerAvatar = "U";
        let sellerRating = 0;
        let sellerEmail = "";

        if (sellerProfile) {
          // Construct name from firstName and lastName
          const firstName = sellerProfile.firstName || "";
          const lastName = sellerProfile.lastName || "";
          sellerName = `${firstName} ${lastName}`.trim() || "Unknown Seller";
          sellerAvatar = sellerProfile.avatar || sellerName.charAt(0) || "U";
          sellerRating = sellerProfile.rating || 0;
          sellerEmail = sellerProfile.email || "";
        }

        return {
          id: property._id.toString(),
          _id: property._id.toString(),
          title: property.title,
          location: property.location || `${property.city}, ${property.state}`,
          city: property.city,
          state: property.state,
          price: property.price,
          beds: property.beds,
          baths: property.baths,
          sqft: property.sqft?.toString() || property.sqft,
          image: property.images?.[0] || "",
          images: property.images || [],
          status: property.status || "active",
          featured: property.featured || false,
          description: property.description,
          propertyType: property.propertyType,
          yearBuilt: property.yearBuilt,
          amenities: property.amenities || [],
          views: property.views || 0,
          inquiries: property.inquiries || 0,
          seller: {
            name: sellerName,
            avatar: sellerAvatar,
            rating: sellerRating,
            email: sellerEmail,
          },
          createdAt: property.createdAt,
          updatedAt: property.updatedAt,
        };
      })
    );

    return res.json({
      message: "Properties fetched successfully",
      count: formattedProperties.length,
      properties: formattedProperties,
    });
  } catch (error) {
    console.error("getAllPropertiesForBuyer error", error);
    return res.status(500).json({ message: error.message });
  }
};

export const getPropertyByIdForBuyer = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    // Find property by ID (buyers can view any active property)
    const property = await Property.findOne({
      _id: id,
      status: "active",
    })
      .lean();

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Increment views
    await Property.findByIdAndUpdate(id, { $inc: { views: 1 } });

    // Get seller profile using buildProfileResponse with realestate_seller role
    const sellerProfile = await buildProfileResponse(
      property.owner?.toString() || property.owner,
      "realestate_seller"
    );

    // Use seller profile data, fallback to basic data if profile not found
    let sellerName = "Unknown Seller";
    let sellerAvatar = "U";
    let sellerRating = 0;
    let sellerEmail = "";
    let sellerPhone = "";

    if (sellerProfile) {
      // Construct name from firstName and lastName
      const firstName = sellerProfile.firstName || "";
      const lastName = sellerProfile.lastName || "";
      sellerName = `${firstName} ${lastName}`.trim() || "Unknown Seller";
      sellerAvatar = sellerProfile.avatar || sellerName.charAt(0) || "U";
      sellerRating = sellerProfile.rating || 0;
      sellerEmail = sellerProfile.email || "";
      sellerPhone = sellerProfile.phone || "";
    }

    // Format response
    const formattedProperty = {
      _id: property._id.toString(),
      title: property.title,
      description: property.description || "",
      location: property.location || `${property.city}, ${property.state}`,
      city: property.city,
      state: property.state,
      price: property.price,
      beds: property.beds,
      baths: property.baths,
      sqft: property.sqft,
      yearBuilt: property.yearBuilt,
      propertyType: property.propertyType,
      amenities: property.amenities || [],
      images: property.images || [],
      status: property.status,
      views: (property.views || 0) + 1,
      inquiries: property.inquiries || 0,
      owner: {
        _id: property.owner?.toString() || "",
        name: sellerName,
        email: sellerEmail,
        avatar: sellerAvatar,
        rating: sellerRating,
        phone: sellerPhone,
      },
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
    };

    return res.json({
      message: "Property fetched successfully",
      property: formattedProperty,
    });
  } catch (error) {
    console.error("getPropertyByIdForBuyer error", error);
    return res.status(500).json({ message: error.message });
  }
};

// Get properties by seller ID (for seller profile page)
export const getPropertiesBySellerId = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    // Find all active properties owned by this seller
    const properties = await Property.find({
      owner: id,
      status: "active",
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Format response
    const formattedProperties = properties.map((property) => {
      return {
        id: property._id.toString(),
        _id: property._id.toString(),
        title: property.title,
        description: property.description || "",
        location: property.location || `${property.city}, ${property.state}`,
        city: property.city,
        state: property.state,
        price: property.price,
        beds: property.beds,
        baths: property.baths,
        sqft: property.sqft,
        yearBuilt: property.yearBuilt,
        propertyType: property.propertyType,
        images: property.images || [],
        status: property.status,
        views: property.views || 0,
        createdAt: property.createdAt,
        updatedAt: property.updatedAt,
      };
    });

    return res.json({
      message: "Properties fetched successfully",
      count: formattedProperties.length,
      properties: formattedProperties,
    });
  } catch (error) {
    console.error("getPropertiesBySellerId error", error);
    return res.status(500).json({ message: error.message });
  }
};