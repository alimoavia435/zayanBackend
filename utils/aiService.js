import { generateAIText } from "./groqService.js";

// Check if AI is available
export const isAiAvailable = () => {
  return !!process.env.GROQ_API_KEY;
};

// Prompt templates
const PROMPTS = {
  productDescription: (productInfo) => {
    return `Write a professional e-commerce product description for the following product:
Product Name: ${productInfo.name || "N/A"}
Category: ${productInfo.category || "N/A"}
Price: ${productInfo.price || "N/A"} ${productInfo.currency || "USD"}
Unit: ${productInfo.unit || "piece"}
${productInfo.stock ? `Stock: ${productInfo.stock} units` : ""}

Requirements:
- Write a clear, engaging product description (150-300 words)
- Highlight key features and benefits
- Use professional but approachable language`;
  },

  propertyDescription: (propertyInfo) => {
    return `Write a professional real estate description for the following property:
Property Title: ${propertyInfo.title || "N/A"}
Location: ${propertyInfo.location || propertyInfo.city || "N/A"}${propertyInfo.state ? `, ${propertyInfo.state}` : ""}
Property Type: ${propertyInfo.propertyType || "N/A"}
Price: $${propertyInfo.price ? (propertyInfo.price / 1000000).toFixed(1) + "M" : "N/A"}
Bedrooms: ${propertyInfo.beds || "N/A"}
Bathrooms: ${propertyInfo.baths || "N/A"}
Square Footage: ${propertyInfo.sqft ? propertyInfo.sqft.toLocaleString() : "N/A"}
Year Built: ${propertyInfo.yearBuilt || "N/A"}
${propertyInfo.amenities && propertyInfo.amenities.length > 0 ? `Amenities: ${propertyInfo.amenities.join(", ")}` : ""}

Requirements:
- Write a professional, engaging property description (200-400 words)
- Highlight unique features and selling points`;
  },

  pricingSuggestion: (itemInfo, itemType = "product") => {
    if (itemType === "product") {
      return `Suggest an appropriate price for this product and explain why:
Product Name: ${itemInfo.name || "N/A"}
Category: ${itemInfo.category || "N/A"}
Current Price: ${itemInfo.price ? itemInfo.price + " " + (itemInfo.currency || "USD") : "Not set"}

Format response as JSON: {"suggestedPrice": 0, "explanation": ""}`;
    } else {
      return `Suggest an appropriate price in dollars for this property and explain why:
Property Title: ${itemInfo.title || "N/A"}
Location: ${itemInfo.location || itemInfo.city || "N/A"}
Property Type: ${itemInfo.propertyType || "N/A"}
Current Price: ${itemInfo.price ? "$" + (itemInfo.price / 1000000).toFixed(1) + "M" : "Not set"}

Format response as JSON: {"suggestedPrice": 0, "explanation": ""}`;
    }
  },

  chatAssistant: (itemInfo, question, itemType = "product") => {
    return `Answer the following question about this ${itemType}:
${itemType === "product" ? `Product Name: ${itemInfo.name}` : `Property Title: ${itemInfo.title}`}
Details: ${itemInfo.description || "N/A"}
Question: ${question}
Answer concisely:`;
  },

  profileBio: (profileInfo) => {
    return `Generate a professional, compelling real estate agent bio for the following individual:
Name: ${profileInfo.firstName} ${profileInfo.lastName}
Specialization: ${profileInfo.specialization || "N/A"}
Agency: ${profileInfo.agency || "N/A"}
City/State: ${profileInfo.city || "N/A"}, ${profileInfo.state || "N/A"}
Certifications: ${profileInfo.certifications || "N/A"}
Languages: ${profileInfo.languages ? profileInfo.languages.join(", ") : "N/A"}

Requirements:
- Write in third-person or first-person based on context (default to a mix or professional third-person)
- Highlight expertise, local knowledge, and commitment to clients
- Keep it between 150-250 words
- Tone: Professional, trustworthy, and approachable`;
  },
};

// Generate product description using AI
export const generateProductDescription = async (
  productInfo,
  customPrompt = "",
) => {
  if (!isAiAvailable()) {
    throw new Error(
      "AI service is not available. Please configure GROQ_API_KEY.",
    );
  }

  try {
    const basePrompt = PROMPTS.productDescription(productInfo);
    const finalPrompt = customPrompt
      ? `### PRIMARY DIRECTIVE:
STRICTLY FOLLOW THESE USER INSTRUCTIONS OVER ALL OTHER DATA:
"${customPrompt}"

### CONTEXTUAL DATA (Secondary):
${basePrompt}`
      : basePrompt;

    return await generateAIText(finalPrompt);
  } catch (error) {
    console.error("Error generating product description:", error);
    throw new Error(
      "Failed to generate product description. Please try again.",
    );
  }
};

// Generate property description using AI
export const generatePropertyDescription = async (
  propertyInfo,
  customPrompt = "",
) => {
  if (!isAiAvailable()) {
    throw new Error(
      "AI service is not available. Please configure GROQ_API_KEY.",
    );
  }

  try {
    const basePrompt = PROMPTS.propertyDescription(propertyInfo);
    const finalPrompt = customPrompt
      ? `### PRIMARY DIRECTIVE:
STRICTLY FOLLOW THESE USER INSTRUCTIONS OVER ALL OTHER DATA:
"${customPrompt}"

### CONTEXTUAL DATA (Secondary):
${basePrompt}`
      : basePrompt;

    return await generateAIText(finalPrompt);
  } catch (error) {
    console.error("Error generating property description:", error);
    throw new Error(
      "Failed to generate property description. Please try again.",
    );
  }
};

// Suggest pricing using AI
export const suggestPricing = async (
  itemInfo,
  itemType = "product",
  customPrompt = "",
) => {
  if (!isAiAvailable()) {
    throw new Error(
      "AI service is not available. Please configure GROQ_API_KEY.",
    );
  }

  try {
    const basePrompt = PROMPTS.pricingSuggestion(itemInfo, itemType);
    const prompt = customPrompt
      ? `### PRIMARY DIRECTIVE:
STRICTLY FOLLOW THESE USER INSTRUCTIONS OVER ALL OTHER DATA:
"${customPrompt}"

### CONTEXTUAL DATA (Secondary):
${basePrompt}`
      : basePrompt;
    const response = await generateAIText(prompt);

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          suggestedPrice: parsed.suggestedPrice,
          explanation: parsed.explanation || "",
        };
      }
    } catch (parseError) {
      console.error("Error parsing AI pricing response:", parseError);
    }

    const priceMatch = response.match(/[\d,]+(?:\.\d+)?/);
    const suggestedPrice = priceMatch
      ? parseFloat(priceMatch[0].replace(/,/g, ""))
      : null;

    return {
      suggestedPrice,
      explanation: response,
    };
  } catch (error) {
    console.error("Error suggesting pricing:", error);
    throw new Error("Failed to suggest pricing. Please try again.");
  }
};

// Chat assistant for product/property Q&A
export const getChatAssistantResponse = async (
  itemInfo,
  question,
  itemType = "product",
) => {
  if (!isAiAvailable()) {
    throw new Error(
      "AI service is not available. Please configure GROQ_API_KEY.",
    );
  }

  try {
    const prompt = PROMPTS.chatAssistant(itemInfo, question, itemType);
    return await generateAIText(prompt);
  } catch (error) {
    console.error("Error getting chat assistant response:", error);
    throw new Error("Failed to get AI response. Please try again.");
  }
};

// Generate profile bio using AI
export const generateProfileBio = async (profileInfo, customPrompt = "") => {
  if (!isAiAvailable()) {
    throw new Error(
      "AI service is not available. Please configure GROQ_API_KEY.",
    );
  }

  try {
    const basePrompt = PROMPTS.profileBio(profileInfo);
    const finalPrompt = customPrompt
      ? `### PRIMARY DIRECTIVE:
STRICTLY FOLLOW THESE USER INSTRUCTIONS OVER ALL OTHER DATA:
"${customPrompt}"

### CONTEXTUAL DATA (Secondary):
${basePrompt}`
      : basePrompt;

    return await generateAIText(finalPrompt);
  } catch (error) {
    console.error("Error generating profile bio:", error);
    throw new Error("Failed to generate profile bio. Please try again.");
  }
};
