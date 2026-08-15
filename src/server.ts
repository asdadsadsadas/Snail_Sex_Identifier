/**
 * Snail Sexing AI — Backend Server
 *
 * Express server that:
 * 1. Serves the built React frontend (in production)
 * 2. Provides a POST /classify endpoint that uses Gemini 2.0 Flash Vision
 *    to classify snail sex and pregnancy from photos
 *
 * ── Setup ─────────────────────────────────────────────────────────
 * 1. Get a free Gemini API key: https://aistudio.google.com/apikey
 * 2. Copy .env.example to .env and add your key
 * 3. Run: npm run dev:server
 * 4. In another terminal: npm run dev
 */

import express from "express";
import multer from "multer";

/** Inline type for multer's uploaded file — avoids import issues across multer versions */
interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}
import cors from "cors";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

// ── Polyfill __dirname for ESM ────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Configuration ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// ── Express Setup ─────────────────────────────────────────────────
const app = express();
app.use(cors());

// Parse JSON bodies (for any future JSON endpoints)
app.use(express.json({ limit: "50mb" }));

// ── File Upload Middleware ───────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
});

// ── Gemini Client ─────────────────────────────────────────────────
let ai: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!ai) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "your-gemini-api-key-here") {
      throw new Error(
        "Gemini API key not configured. " +
          "Set GEMINI_API_KEY in your .env file. " +
          "Get a free key at https://aistudio.google.com/apikey"
      );
    }
    ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return ai;
}

// ── Classification Prompt ─────────────────────────────────────────
const CLASSIFICATION_PROMPT = `You are a malacologist specializing in gastropod morphology. Analyze this snail photo and classify its sex and pregnancy status.

Key morphological indicators for sex determination:
- **MALES**: Narrower shell aperture, more elongated shell shape, right tentacle is modified into a copulatory organ (often thicker/curved), operculum is typically darker and more heavily calcified, shell length-to-width ratio is usually higher
- **FEMALES**: Wider shell aperture, broader/rounder shell base, lighter operculum pigmentation, shell apex is more rounded, mantle area shows more soft tissue development

For **pregnancy** (gravid status in females):
- Look for visible eggs or embryos through the shell (pale yellow/white masses)
- Swelling in the mantle cavity area
- Only assess for female specimens

Respond with valid JSON only — no markdown, no code fences. Use this exact schema:
{
  "sex": "Male" or "Female",
  "pregnancyStatus": "Pregnant" or "Not Pregnant",
  "confidence": number between 0 and 100,
  "morphologicalNotes": "Brief 1-2 sentence description of key morphological features observed"
}

Guidelines:
- If the image is not a snail or quality is too poor, set confidence below 50%
- pregnancyStatus should only be "Pregnant" if sex is "Female"
- Be conservative with confidence — only give high confidence (85%+) when clear morphological features are visible
- If uncertain, default to lower confidence rather than guessing`;

// ── Routes ────────────────────────────────────────────────────────

/** Health check */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", model: "gemini-flash-latest" });
});

/**
 * POST /classify
 *
 * Accepts a multipart form with an "image" field containing the snail photo.
 * Returns a ClassificationResult JSON matching the frontend's expected schema.
 */
app.post("/classify", upload.single("image"), async (req, res) => {
  try {
    const file = req.file as UploadedFile | undefined;

    // ── Validate input ──────────────────────────────────────────
    if (!file) {
      res.status(400).json({ error: "No image provided. Send a file in the 'image' field." });
      return;
    }

    const mimeType = file.mimetype;
    if (!mimeType.startsWith("image/")) {
      res.status(400).json({ error: "File must be an image." });
      return;
    }

    // ── Encode image to base64 ──────────────────────────────────
    const base64Image = file.buffer.toString("base64");

    // ── Classify with Gemini ────────────────────────────────────
    const client = getAiClient();

    const response = await client.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            { text: CLASSIFICATION_PROMPT },
            {
              inlineData: {
                data: base64Image,
                mimeType,
              },
            },
          ],
        },
      ],
      config: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            sex: {
              type: "STRING",
              enum: ["Male", "Female"],
            },
            pregnancyStatus: {
              type: "STRING",
              enum: ["Pregnant", "Not Pregnant"],
            },
            confidence: {
              type: "NUMBER",
              description: "Confidence score between 0 and 100",
            },
            morphologicalNotes: {
              type: "STRING",
              description: "Brief description of observed morphological features",
            },
          },
          required: ["sex", "pregnancyStatus", "confidence", "morphologicalNotes"],
        },
      },
    });

    // ── Parse response ──────────────────────────────────────────
    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    let result: {
      sex: string;
      pregnancyStatus: string;
      confidence: number;
      morphologicalNotes: string;
    };

    try {
      result = JSON.parse(text);
    } catch {
      console.error("Failed to parse Gemini response:", text);
      throw new Error("Invalid JSON response from Gemini");
    }

    // ── Validate result shape ───────────────────────────────────
    const validSexes = ["Male", "Female"];
    const validPregnancies = ["Pregnant", "Not Pregnant"];

    if (!validSexes.includes(result.sex)) {
      throw new Error(`Invalid sex value: ${result.sex}`);
    }
    if (!validPregnancies.includes(result.pregnancyStatus)) {
      throw new Error(`Invalid pregnancyStatus value: ${result.pregnancyStatus}`);
    }
    if (result.sex === "Male" && result.pregnancyStatus === "Pregnant") {
      // Gemini fix: clamp pregnancy to Not Pregnant for males
      result.pregnancyStatus = "Not Pregnant";
    }

    const confidence = Math.min(100, Math.max(0, result.confidence ?? 50));
    const rounded = Math.round(confidence * 10) / 10;

    // ── Return result ───────────────────────────────────────────
    res.json({
      sex: result.sex,
      pregnancyStatus: result.pregnancyStatus,
      confidence: rounded,
      morphologicalNotes: result.morphologicalNotes || "No morphological notes available.",
    });
  } catch (error: any) {
    console.error("Classification error:", error.message || error);
    res.status(500).json({
      error: "Classification failed",
      detail: error.message || "Unknown error",
    });
  }
});

// ── Serve Frontend (production only) ─────────────────────────────
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "../dist");
  app.use(express.static(distPath));

  // All non-API routes → index.html (SPA support)
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// ── Start Server ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  🐌 Snail Sexing AI — Server
  ─────────────────────────────
  URL:      http://localhost:${PORT}
  Health:   http://localhost:${PORT}/health
  Classify: POST http://localhost:${PORT}/classify
  Model:    Gemini 2.0 Flash
  API Key:  ${GEMINI_API_KEY ? "✅ Configured" : "❌ Not set — see .env.example"}
  Mode:     ${process.env.NODE_ENV === "production" ? "🚀 Production (serving frontend)" : "🔧 Development"}
  `);
});
