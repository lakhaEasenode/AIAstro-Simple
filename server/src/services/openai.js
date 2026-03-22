import OpenAI from "openai";
import { normalizeAssistantAnswer } from "../utils/formatters.js";

function buildSystemPrompt(user) {
  return `
You are AstroAI, a concise astrology-style assistant.

Rules:
- Keep every answer very short: maximum 3 short lines.
- If the user writes in Hindi or Devanagari, answer in Hindi. Otherwise answer in English.
- Use a warm, confident, and practical tone.
- Use the conversation history to maintain context for this specific user.
- Treat astrology, kundali, palm, and face reading as interpretive guidance, not certain fact.
- Avoid fear-based wording and avoid medical, legal, or financial certainty.
- The current user's name is ${user.name}.
`.trim();
}

export async function generateAstroReply({ user, history, text, imageFile }) {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  const input = [
    {
      role: "system",
      content: buildSystemPrompt(user)
    }
  ];

  history.forEach((message) => {
    input.push({
      role: message.role,
      content: message.content || (message.hasImage ? "User shared an image." : "")
    });
  });

  const currentContent = [];

  if (text?.trim()) {
    currentContent.push({
      type: "input_text",
      text: text.trim()
    });
  }

  if (imageFile) {
    currentContent.push({
      type: "input_image",
      image_url: `data:${imageFile.mimetype || "image/jpeg"};base64,${imageFile.buffer.toString("base64")}`
    });
  }

  input.push({
    role: "user",
    content: currentContent.length ? currentContent : "Give a short reading."
  });

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    input,
    max_output_tokens: 180
  });

  return normalizeAssistantAnswer(response.output_text || "");
}
