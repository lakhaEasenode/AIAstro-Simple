import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs/promises";
import multer from "multer";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});

const app = express();
const port = Number(process.env.PORT || 3303);
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
let runtimeApiKey = (process.env.OPENAI_API_KEY || "").trim();

app.use(cors());
app.use(express.json({ limit: "200kb" }));

const systemPrompt = `
You are AstroAI, a concise astrology-style assistant for a lightweight MVP.

Rules:
- Keep every answer extremely short: maximum 3 short lines.
- If the user writes in Hindi or uses Devanagari, answer in Hindi. Otherwise answer in English.
- Use a warm, confident, and simple tone.
- Treat kundali, palm, and face reading as interpretive guidance, not certain fact.
- If the image or birth details are unclear, say that briefly and still give the best short reading possible.
- Avoid fear-based wording and avoid medical, legal, or financial certainty.
- Do not add long disclaimers.
`.trim();

function buildUserPrompt({ question, hasImage }) {
  return `
Analyze the user's astrology request and give a very short answer.

Input summary:
- Image attached: ${hasImage ? "Yes" : "No"}
- User message: ${question || "General short reading requested"}

Output requirements:
- Maximum 3 short lines only
- Hindi if the user asks in Hindi, otherwise English
- Mention the strongest short insight first
- If the message contains date of birth, time, place, or other context, use it from the text itself
- If an image is present, infer whether it looks like a kundali, palm, or face image from the image itself
`.trim();
}

function normalizeAnswer(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("\n");
}

function getOpenAIClient() {
  if (!runtimeApiKey) {
    return null;
  }

  return new OpenAI({ apiKey: runtimeApiKey });
}

async function persistApiKey(apiKey) {
  const envPath = path.join(rootDir, ".env");
  let currentEnv = "";

  try {
    currentEnv = await fs.readFile(envPath, "utf8");
  } catch (error) {
    currentEnv = "";
  }

  const nextLine = `OPENAI_API_KEY=${apiKey}`;
  let nextEnv;

  if (/^OPENAI_API_KEY=.*$/m.test(currentEnv)) {
    nextEnv = currentEnv.replace(/^OPENAI_API_KEY=.*$/m, nextLine);
  } else {
    nextEnv = currentEnv.trim() ? `${currentEnv.trim()}\n${nextLine}\n` : `${nextLine}\n`;
  }

  await fs.writeFile(envPath, nextEnv, "utf8");
}

app.get("/api/config-status", (_req, res) => {
  res.json({
    configured: Boolean(runtimeApiKey)
  });
});

app.post("/api/config", async (req, res) => {
  const apiKey = String(req.body?.apiKey || "").trim();

  if (!apiKey || !apiKey.startsWith("sk-")) {
    return res.status(400).json({
      error: "Enter a valid OpenAI secret key."
    });
  }

  try {
    runtimeApiKey = apiKey;
    process.env.OPENAI_API_KEY = apiKey;
    await persistApiKey(apiKey);

    return res.json({
      ok: true
    });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to save the API key locally."
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    port,
    model,
    apiKeyConfigured: Boolean(runtimeApiKey)
  });
});

app.post("/api/astro", upload.single("image"), async (req, res) => {
  const openai = getOpenAIClient();

  if (!openai) {
    return res.status(500).json({
      error: "OPENAI_API_KEY is missing in the server .env file."
    });
  }

  const question = (req.body.question || "").trim();

  if (!req.file && !question) {
    return res.status(400).json({
      error: "Add a message or an image."
    });
  }

  try {
    const content = [
      {
        type: "input_text",
        text: buildUserPrompt({
          question,
          hasImage: Boolean(req.file)
        })
      }
    ];

    if (req.file) {
      const mimeType = req.file.mimetype || "image/jpeg";
      const base64Image = req.file.buffer.toString("base64");

      content.push({
        type: "input_image",
        image_url: `data:${mimeType};base64,${base64Image}`
      });
    }

    const response = await openai.responses.create({
      model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content }
      ],
      max_output_tokens: 120
    });

    const answer = normalizeAnswer(response.output_text || "");

    if (!answer) {
      throw new Error("The model returned an empty answer.");
    }

    return res.json({
      answer
    });
  } catch (error) {
    const message =
      error?.status === 401
        ? "OpenAI authentication failed. Check the API key."
        : error?.status === 429
          ? "Rate limit reached on the OpenAI API. Please try again shortly."
          : error?.message || "Unable to generate a reading right now.";

    return res.status(500).json({
      error: message
    });
  }
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    app.use(express.static(distDir));

    app.get("*", async (_req, res) => {
      const html = await fs.readFile(path.join(distDir, "index.html"), "utf8");
      res.type("html").send(html);
    });
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({
      root: rootDir,
      server: {
        middlewareMode: true
      },
      appType: "custom"
    });

    app.use(vite.middlewares);

    app.get("*", async (req, res, next) => {
      try {
        const templatePath = path.join(rootDir, "index.html");
        const template = await fs.readFile(templatePath, "utf8");
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.type("html").send(html);
      } catch (error) {
        vite.ssrFixStacktrace(error);
        next(error);
      }
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`AstroAI running on http://localhost:${port}`);
  });
}

startServer();
