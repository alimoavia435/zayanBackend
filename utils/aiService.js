import OpenAI from "openai";

// Initialize OpenAI client (optional - graceful degradation if API key is missing)
let openai = null;

try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  } else {
    console.warn("⚠️  OPENAI_API_KEY not found. AI features will be disabled.");
  }
} catch (error) {
  console.warn("⚠️  Failed to initialize OpenAI client:", error.message);
}

// Check if AI is available
export const isAiAvailable = () => {
  return openai !== null;
};

// Prompt templates
const PROMPTS = {
  productDescription: (productInfo) => {
    return `You are an expert e-commerce copywriter. Generate a compelling, SEO-friendly product description based on the following information:

Product Name: ${productInfo.name || "N/A"}
Category: ${productInfo.category || "N/A"}
Price: ${productInfo.price || "N/A"} ${productInfo.currency || "USD"}
Unit: ${productInfo.unit || "piece"}
${productInfo.stock ? `Stock: ${productInfo.stock} units` : ""}

Requirements:
- Write a clear, engaging product description (150-300 words)
- Highlight key features and benefits
- Use professional but approachable language
- Include relevant keywords naturally
- Format with short paragraphs for readability
- Do not include pricing or availability details in the description

Generate only the product description text, without any additional commentary or labels.`;
  },

  propertyDescription: (propertyInfo) => {
    return `You are an expert real estate copywriter. Generate a compelling, professional property listing description based on the following information:

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
- Highlight unique features and selling points
- Describe the location and neighborhood appeal
- Mention property condition and key amenities
- Use descriptive, inviting language
- Format with short paragraphs for readability
- Do not include pricing or contact information in the description

Generate only the property description text, without any additional commentary or labels.`;
  },

  pricingSuggestion: (itemInfo, itemType = "product") => {
    if (itemType === "product") {
      return `You are an e-commerce pricing expert. Suggest an appropriate price for the following product:

Product Name: ${itemInfo.name || "N/A"}
Category: ${itemInfo.category || "N/A"}
Current Price: ${itemInfo.price ? itemInfo.price + " " + (itemInfo.currency || "USD") : "Not set"}
Unit: ${itemInfo.unit || "piece"}

Based on market research and e-commerce best practices, provide:
1. A suggested price (just the number)
2. A brief 2-3 sentence explanation for the suggested price

Format your response as JSON:
{
  "suggestedPrice": <number>,
  "explanation": "<brief explanation>"
}`;
    } else {
      // Property pricing
      return `You are a real estate pricing expert. Suggest an appropriate price for the following property:

Property Title: ${itemInfo.title || "N/A"}
Location: ${itemInfo.location || itemInfo.city || "N/A"}${itemInfo.state ? `, ${itemInfo.state}` : ""}
Property Type: ${itemInfo.propertyType || "N/A"}
Current Price: ${itemInfo.price ? "$" + (itemInfo.price / 1000000).toFixed(1) + "M" : "Not set"}
Bedrooms: ${itemInfo.beds || "N/A"}
Bathrooms: ${itemInfo.baths || "N/A"}
Square Footage: ${itemInfo.sqft ? itemInfo.sqft.toLocaleString() : "N/A"}
Year Built: ${itemInfo.yearBuilt || "N/A"}

Based on comparable properties (comps), market conditions, and property features, provide:
1. A suggested price in dollars (as a whole number, e.g., 500000 for $500K)
2. A brief 2-3 sentence explanation for the suggested price

Format your response as JSON:
{
  "suggestedPrice": <number in dollars>,
  "explanation": "<brief explanation>"
}`;
    }
  },

  chatAssistant: (itemInfo, question, itemType = "product") => {
    if (itemType === "product") {
      return `You are a helpful e-commerce assistant helping a buyer learn about a product. Answer the buyer's question based on the product information provided.

Product Information:
- Name: ${itemInfo.name || "N/A"}
- Description: ${itemInfo.description || "N/A"}
- Price: ${itemInfo.price || "N/A"} ${itemInfo.currency || "USD"}
- Category: ${itemInfo.category || "N/A"}
- Unit: ${itemInfo.unit || "piece"}
${itemInfo.stock !== undefined ? `- Stock: ${itemInfo.stock} units` : ""}

Buyer's Question: ${question}

Requirements:
- Answer the question accurately based on the product information
- Be friendly and helpful
- If information is not available, politely say so
- Keep the response concise (2-4 sentences)
- Do not make up details that aren't in the product information

Answer:`;
    } else {
      // Property Q&A
      return `You are a helpful real estate assistant helping a buyer learn about a property. Answer the buyer's question based on the property information provided.

Property Information:
- Title: ${itemInfo.title || "N/A"}
- Description: ${itemInfo.description || "N/A"}
- Location: ${itemInfo.location || itemInfo.city || "N/A"}${itemInfo.state ? `, ${itemInfo.state}` : ""}
- Price: ${itemInfo.price ? "$" + (itemInfo.price / 1000000).toFixed(1) + "M" : "N/A"}
- Property Type: ${itemInfo.propertyType || "N/A"}
- Bedrooms: ${itemInfo.beds || "N/A"}
- Bathrooms: ${itemInfo.baths || "N/A"}
- Square Footage: ${itemInfo.sqft ? itemInfo.sqft.toLocaleString() : "N/A"}
- Year Built: ${itemInfo.yearBuilt || "N/A"}
${itemInfo.amenities && itemInfo.amenities.length > 0 ? `- Amenities: ${itemInfo.amenities.join(", ")}` : ""}

Buyer's Question: ${question}

Requirements:
- Answer the question accurately based on the property information
- Be friendly and professional
- If information is not available, politely say so
- Keep the response concise (2-4 sentences)
- Do not make up details that aren't in the property information

Answer:`;
    }
  },
};

// Generate product description using AI
export const generateProductDescription = async (productInfo) => {
  if (!isAiAvailable()) {
    throw new Error("AI service is not available. Please configure OPENAI_API_KEY.");
  }

  try {
    const prompt = PROMPTS.productDescription(productInfo);

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert e-commerce copywriter specializing in product descriptions.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const description = completion.choices[0]?.message?.content?.trim() || "";
    return description;
  } catch (error) {
    console.error("Error generating product description:", error);
    throw new Error("Failed to generate product description. Please try again.");
  }
};

// Generate property description using AI
export const generatePropertyDescription = async (propertyInfo) => {
  if (!isAiAvailable()) {
    throw new Error("AI service is not available. Please configure OPENAI_API_KEY.");
  }

  try {
    const prompt = PROMPTS.propertyDescription(propertyInfo);

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert real estate copywriter specializing in property listings.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 600,
      temperature: 0.7,
    });

    const description = completion.choices[0]?.message?.content?.trim() || "";
    return description;
  } catch (error) {
    console.error("Error generating property description:", error);
    throw new Error("Failed to generate property description. Please try again.");
  }
};

// Suggest pricing using AI
export const suggestPricing = async (itemInfo, itemType = "product") => {
  if (!isAiAvailable()) {
    throw new Error("AI service is not available. Please configure OPENAI_API_KEY.");
  }

  try {
    const prompt = PROMPTS.pricingSuggestion(itemInfo, itemType);

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: itemType === "product" 
            ? "You are an e-commerce pricing expert." 
            : "You are a real estate pricing expert.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 200,
      temperature: 0.5,
    });

    const response = completion.choices[0]?.message?.content?.trim() || "";
    
    // Try to parse JSON response
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

    // Fallback: extract price from text if JSON parsing fails
    const priceMatch = response.match(/[\d,]+(?:\.\d+)?/);
    const suggestedPrice = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, "")) : null;

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
export const getChatAssistantResponse = async (itemInfo, question, itemType = "product") => {
  if (!isAiAvailable()) {
    throw new Error("AI service is not available. Please configure OPENAI_API_KEY.");
  }

  try {
    const prompt = PROMPTS.chatAssistant(itemInfo, question, itemType);

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: itemType === "product"
            ? "You are a helpful e-commerce assistant helping buyers with product questions."
            : "You are a helpful real estate assistant helping buyers with property questions.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const answer = completion.choices[0]?.message?.content?.trim() || "";
    return answer;
  } catch (error) {
    console.error("Error getting chat assistant response:", error);
    throw new Error("Failed to get AI response. Please try again.");
  }
};

