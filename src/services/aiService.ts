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
  userApiKey?: string; // user's own Cohere key
}

const WORDS: Record<string, number> = { short: 150, medium: 300, detailed: 500 };
const TONES: Record<string, string> = {
  formal: "formal and professional",
  conversational: "friendly and conversational",
  confident: "confident and assertive",
};

export const generateProposal = async (o: GenOpts): Promise<{ text: string; score: number }> => {
  // User key takes priority over server key
  const apiKey = o.userApiKey;

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
${o.budget ? `Budget: ${o.budget}` : ""}
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
  let score = 60; // Base score

  // Length scoring (0-15 points)
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const targetWords = WORDS[o.length] || 300;
  const wordRatio = wordCount / targetWords;
  
  if (wordRatio >= 0.8 && wordRatio <= 1.2) {
    score += 15; // Perfect length (80-120% of target)
  } else if (wordRatio >= 0.6 && wordRatio <= 1.4) {
    score += 10; // Good length (60-140% of target)
  } else if (wordRatio >= 0.4 && wordRatio <= 1.6) {
    score += 5; // Acceptable length
  }

  // Skills mentioned (0-10 points)
  const skillsInText = o.skills.filter((skill) =>
    text.toLowerCase().includes(skill.toLowerCase())
  ).length;
  score += Math.min(skillsInText * 2, 10);

  // Experience level alignment (0-5 points)
  if (o.experience === "senior" && /(\d+\+?\s*years?|decade|extensive|seasoned)/i.test(text)) {
    score += 5;
  } else if (o.experience === "mid" && /(\d+\s*years?|experience|proven)/i.test(text)) {
    score += 4;
  } else if (o.experience === "junior") {
    score += 3;
  }

  // Specificity indicators (0-10 points)
  const specificityMarkers = [
    /\d+%/g, // Percentages (e.g., "50% faster")
    /\$\d+/g, // Dollar amounts (e.g., "$10k revenue")
    /\d+\s*(years?|months?|weeks?|days?)/gi, // Time periods
    /\d+\+/g, // Numbers with plus (5+, 10+)
    /\d+x/gi, // Multipliers (2x, 3x faster)
  ];
  
  let specificityCount = 0;
  specificityMarkers.forEach((regex) => {
    specificityCount += (text.match(regex) || []).length;
  });
  score += Math.min(specificityCount * 2, 10);

  // Avoid clichés (penalty: -2 per cliché, max -6)
  const cliches = [
    /perfect candidate/i,
    /hard worker/i,
    /team player/i,
    /fast learner/i,
    /jack of all trades/i,
    /go above and beyond/i,
  ];
  const clicheCount = cliches.filter((regex) => regex.test(text)).length;
  score -= Math.min(clicheCount * 2, 6);

  // Professional structure (0-5 points)
  const hasGreeting = /dear|hello|hi|greetings/i.test(text.substring(0, 100));
  const hasClosing = /best regards|sincerely|thanks|thank you|looking forward|cheers/i.test(
    text.substring(Math.max(0, text.length - 150))
  );
  
  if (hasGreeting) score += 2;
  if (hasClosing) score += 3;

  // Tone bonus (0-3 points)
  if (o.tone === "confident" && /I can|I will|I have|my expertise/i.test(text)) {
    score += 3;
  } else if (o.tone === "formal" && /would be|pleased to|opportunity to/i.test(text)) {
    score += 2;
  } else if (o.tone === "conversational" && /Let's|I'd love|excited to/i.test(text)) {
    score += 2;
  }

  // Ensure score is within bounds and return whole number
  return { text, score: Math.min(100, Math.max(60, Math.round(score))) };
}