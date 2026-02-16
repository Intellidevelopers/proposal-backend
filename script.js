import 'dotenv/config';
import { CohereClientV2 } from 'cohere-ai';

const COHERE_API_KEY = process.env.COHERE_API_KEY;

if (!COHERE_API_KEY) {
  console.error("⚠️ COHERE_API_KEY is missing in .env");
  process.exit(1);
}

const cohere = new CohereClientV2({ token: COHERE_API_KEY });

async function testCohereProposal() {
  const prompt = `
You are an expert freelance proposal writer. Write a confident, 150-word proposal for a React + Node.js job.
Include a strong hook, relevant experience, specific approach, and clear CTA.
Avoid clichés like "I am the perfect candidate".
`;

  try {
    const response = await cohere.chat({
      model: "c4ai-aya-expanse-32b",
      messages: [
        { role: "user", content: [{ type: "text", text: prompt }] }
      ],
      temperature: 0.7,
      responseFormat: { type: "text" },
    });

    // ✅ Extract the text correctly
    const text = response.message?.content?.[0]?.text?.trim();
    if (!text) {
      console.log("No text returned:", response);
      return;
    }

    console.log("\n=== Cohere Proposal Output ===\n");
    console.log(text);

  } catch (err) {
    console.error("Cohere Chat failed:", err?.message || err);
  }
}

testCohereProposal();
