import { CohereClientV2 } from "cohere-ai";
import { ENV } from "../config/env";
import { ApiError } from "../utils/ApiError";

interface GenOpts {
  jobDescription: string;
  skills: string[];
  experience: string;
  tone: string;
  length: string;
  budget?: string;
  timeline?: string;
  userApiKey?: string;    // user's own Cohere key
}

const WORDS: Record<string, number> = { short: 150, medium: 300, detailed: 500 };
const TONES: Record<string, string> = {
  formal:         "formal and professional",
  conversational: "friendly and conversational",
  confident:      "confident and assertive",
};

export const generateProposal = async (o: GenOpts): Promise<{ text: string; score: number }> => {
  // User key takes priority over server key
  const apiKey = o.userApiKey || ENV.COHERE_API_KEY;

  if (!apiKey) {
    throw new ApiError(
      "No Cohere API key found. Add yours in Settings → API Key or set COHERE_API_KEY in .env.",
      400
    );
  }

  const cohere = new CohereClientV2({ token: apiKey });

  const prompt = `You are an expert freelance proposal writer. Write winning proposals.
Tone: ${TONES[o.tone] || o.tone}. Length: ~${WORDS[o.length] || 300} words.
Structure: strong hook → relevant experience → specific approach → clear CTA.
Be specific with numbers and results. Avoid "I am the perfect candidate".

Write a proposal for:
${o.jobDescription}

Skills: ${o.skills.join(", ") || "General"}
Experience: ${o.experience}
${o.budget   ? `Budget: ${o.budget}`     : ""}
${o.timeline ? `Timeline: ${o.timeline}` : ""}`;

  try {
    const response = await cohere.chat({
      model: "c4ai-aya-expanse-32b",
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: prompt }],
        },
      ],
      temperature: 0.75,
      responseFormat: { type: "text" },
    });

    const contentItem = response.message?.content?.[0];
    const text = contentItem && "text" in contentItem ? contentItem.text?.trim() : null;
    if (!text) throw new ApiError("Cohere returned an empty response.", 502);

    return calculateScore(text, o);
  } catch (err: any) {
    if (err instanceof ApiError) throw err;

    // Cohere HTTP error codes
    if (err?.status === 401) throw new ApiError("Invalid Cohere API key.", 400);
    if (err?.status === 429) throw new ApiError("Cohere rate limit hit. Wait a moment.", 429);
    if (err?.status === 402) throw new ApiError("Cohere quota exceeded. Check billing.", 402);

    console.error("Cohere generation error:", err?.message || err);
    throw new ApiError("AI generation failed. Please try again.", 502);
  }
};

function calculateScore(text: string, o: GenOpts): { text: string; score: number } {
  let score = 70;
  if (text.length > 600)                  score += 5;
  if (o.skills.length > 2)               score += 5;
  if (o.experience === "senior")         score += 5;
  if (/\d+/.test(text))                  score += 4;   // contains numbers = specific
  if (!/perfect candidate/i.test(text)) score += 4;   // no clichés
  if (o.tone === "confident")            score += 4;
  return { text, score: Math.min(100, Math.max(60, score)) };
}