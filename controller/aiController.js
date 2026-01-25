import {
  generateProductDescription,
  generatePropertyDescription,
  suggestPricing,
  getChatAssistantResponse,
  isAiAvailable,
  generateProfileBio as generateBio,
} from "../utils/aiService.js";

// Generate product description
export const generateProductDesc = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!isAiAvailable()) {
      return res.status(503).json({
        message:
          "AI service is not available. Please configure GROQ_API_KEY in environment variables.",
        available: false,
      });
    }

    const { name, category, price, currency, unit, stock, customPrompt } =
      req.body;

    if (!name) {
      return res.status(400).json({ message: "Product name is required" });
    }

    const productInfo = {
      name,
      category: category || "",
      price: price || "",
      currency: currency || "USD",
      unit: unit || "piece",
      stock: stock || "",
    };

    const description = await generateProductDescription(
      productInfo,
      customPrompt,
    );

    if (!description) {
      return res.status(503).json({
        message: "AI service is temporarily unavailable.",
        available: false,
      });
    }

    return res.status(200).json({
      message: "Product description generated successfully",
      description,
      available: true,
    });
  } catch (error) {
    console.error("generateProductDesc error", error);
    return res.status(500).json({
      message: error.message || "Failed to generate product description",
      available: isAiAvailable(),
    });
  }
};

// Generate property description
export const generatePropertyDesc = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!isAiAvailable()) {
      return res.status(503).json({
        message:
          "AI service is not available. Please configure GROQ_API_KEY in environment variables.",
        available: false,
      });
    }

    const {
      title,
      location,
      city,
      state,
      propertyType,
      price,
      beds,
      baths,
      sqft,
      yearBuilt,
      amenities,
      customPrompt,
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Property title is required" });
    }

    const propertyInfo = {
      title,
      location: location || "",
      city: city || "",
      state: state || "",
      propertyType: propertyType || "",
      price: price || "",
      beds: beds || "",
      baths: baths || "",
      sqft: sqft || "",
      yearBuilt: yearBuilt || "",
      amenities: amenities || [],
    };

    const description = await generatePropertyDescription(
      propertyInfo,
      customPrompt,
    );

    if (!description) {
      return res.status(503).json({
        message: "AI service is temporarily unavailable.",
        available: false,
      });
    }

    return res.status(200).json({
      message: "Property description generated successfully",
      description,
      available: true,
    });
  } catch (error) {
    console.error("generatePropertyDesc error", error);
    return res.status(500).json({
      message: error.message || "Failed to generate property description",
      available: isAiAvailable(),
    });
  }
};

// Suggest pricing for product or property
export const suggestPrice = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!isAiAvailable()) {
      return res.status(503).json({
        message:
          "AI service is not available. Please configure GROQ_API_KEY in environment variables.",
        available: false,
      });
    }

    const { itemType = "product", customPrompt = "", ...itemInfo } = req.body;

    if (itemType === "product" && !itemInfo.name) {
      return res.status(400).json({ message: "Product name is required" });
    }

    if (itemType === "property" && !itemInfo.title) {
      return res.status(400).json({ message: "Property title is required" });
    }

    const result = await suggestPricing(itemInfo, itemType, customPrompt);

    if (!result.explanation) {
      return res.status(503).json({
        message: "AI service is temporarily unavailable.",
        available: false,
      });
    }

    return res.status(200).json({
      message: "Pricing suggestion generated successfully",
      suggestedPrice: result.suggestedPrice,
      explanation: result.explanation,
      available: true,
    });
  } catch (error) {
    console.error("suggestPrice error", error);
    return res.status(500).json({
      message: error.message || "Failed to suggest pricing",
      available: isAiAvailable(),
    });
  }
};

// Chat assistant for product/property Q&A
export const chatAssistant = async (req, res) => {
  try {
    // Allow both authenticated and unauthenticated users to use chat assistant
    // (optional authentication - buyers might not be logged in)
    // if (!req.user?._id) {
    //   return res.status(401).json({ message: "Unauthorized" });
    // }

    if (!isAiAvailable()) {
      return res.status(503).json({
        message:
          "AI service is not available. Please configure GROQ_API_KEY in environment variables.",
        available: false,
      });
    }

    const { itemType = "product", question, ...itemInfo } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({ message: "Question is required" });
    }

    if (itemType === "product" && !itemInfo.name) {
      return res
        .status(400)
        .json({ message: "Product information is required" });
    }

    if (itemType === "property" && !itemInfo.title) {
      return res
        .status(400)
        .json({ message: "Property information is required" });
    }

    const answer = await getChatAssistantResponse(
      itemInfo,
      question.trim(),
      itemType,
    );

    if (!answer) {
      return res.status(503).json({
        message: "AI service is temporarily unavailable.",
        available: false,
      });
    }

    return res.status(200).json({
      message: "Chat response generated successfully",
      answer,
      available: true,
    });
  } catch (error) {
    console.error("chatAssistant error", error);
    return res.status(500).json({
      message: error.message || "Failed to get chat response",
      available: isAiAvailable(),
    });
  }
};

// Check AI service availability
export const checkAiAvailability = async (req, res) => {
  try {
    return res.status(200).json({
      available: isAiAvailable(),
      message: isAiAvailable()
        ? "AI service is available"
        : "AI service is not available. Please configure GROQ_API_KEY.",
    });
  } catch (error) {
    console.error("checkAiAvailability error", error);
    return res.status(500).json({
      available: false,
      message: "Failed to check AI service availability",
    });
  }
};
// Generate profile bio
export const generateProfileBio = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!isAiAvailable()) {
      return res.status(503).json({
        message:
          "AI service is not available. Please configure GROQ_API_KEY in environment variables.",
        available: false,
      });
    }

    const {
      firstName,
      lastName,
      specialization,
      agency,
      city,
      state,
      certifications,
      languages,
      customPrompt,
    } = req.body;

    const profileInfo = {
      firstName: firstName || req.user.firstName || "",
      lastName: lastName || req.user.lastName || "",
      specialization: specialization || "",
      agency: agency || "",
      city: city || "",
      state: state || "",
      certifications: certifications || "",
      languages: languages || [],
    };

    const bio = await generateBio(profileInfo, customPrompt);

    if (!bio) {
      return res.status(503).json({
        message: "AI service is temporarily unavailable.",
        available: false,
      });
    }

    return res.status(200).json({
      message: "Profile bio generated successfully",
      description: bio,
      available: true,
    });
  } catch (error) {
    console.error("generateProfileBio error", error);
    return res.status(500).json({
      message: error.message || "Failed to generate profile bio",
      available: isAiAvailable(),
    });
  }
};
