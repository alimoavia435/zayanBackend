import OpenAI from "openai";

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export const generateAIText = async (prompt) => {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant", // ✅ UPDATED MODEL
      messages: [
        {
          role: "system",
          content:
            "You are a professional assistant who writes clear, attractive product and property descriptions and provides pricing suggestions and support.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.6,
      max_tokens: 300,
    });

    // console.log(completion.choices[0].message.content, "response of backend");
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Groq AI Error:", error.message);
    return null;
  }
};
