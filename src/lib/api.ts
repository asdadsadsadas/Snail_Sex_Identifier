/**
 * Snail Classification API Service
 *
 * Provides the interface to the backend classification API (which uses Gemini Vision).
 * Falls back to mock classification when the server is unreachable or
 * VITE_USE_MOCK_YOLO is set to "true".
 *
 * ── Setup ─────────────────────────────────────────────────────────
 * The backend server runs on http://localhost:3001 by default.
 * Start it with:  npm run dev:server
 *
 * Or set VITE_YOLO_API_URL to a custom endpoint, e.g. for your
 * deployed Railway backend.
 */

import type { SnailGender, PregnantStatus } from "../types";

// ── Configuration ────────────────────────────────────────────────
// Points to the local Express server by default.
// In production, set VITE_YOLO_API_URL to your deployed server URL.
// e.g. VITE_YOLO_API_URL=https://your-app.railway.app
// Supports both full URLs (with /classify) and base URLs.
const API_URL = (() => {
  const env = import.meta.env.VITE_YOLO_API_URL;
  if (env) {
    // If it already ends with /classify, use as-is (backward compat)
    return env.endsWith("/classify") ? env : `${env.replace(/\/+$/, "")}/classify`;
  }
  return "http://localhost:3001/classify";
})();

// ── Response Shape ───────────────────────────────────────────────

export interface ClassificationResult {
  sex: SnailGender;
  pregnancyStatus: PregnantStatus;
  confidence: number;
  morphologicalNotes: string;
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Classify a snail photo using the backend API (Gemini Vision).
 *
 * Sends the image blob to the backend server via FormData.
 * Automatically falls back to mock if:
 * - VITE_USE_MOCK_YOLO === "true"
 * - The backend server is unreachable
 */
export async function classifySnailImage(imageBlob: Blob): Promise<ClassificationResult> {
  const forceMock = import.meta.env.VITE_USE_MOCK_YOLO === "true";

  if (!forceMock) {
    try {
      const formData = new FormData();
      formData.append("image", imageBlob, "snail.jpg");

      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        return {
          sex: data.sex as SnailGender,
          pregnancyStatus: data.pregnancyStatus as PregnantStatus,
          confidence: data.confidence,
          morphologicalNotes: data.morphologicalNotes ?? "",
        };
      }

      console.warn(`API returned ${response.status}, falling back to mock`);
    } catch (err) {
      console.warn(
        "Backend server unreachable (is it running?). Falling back to mock classification.",
        err
      );
    }
  }

  return mockClassifySnailImage();
}

// ── Mock (used while real model is being deployed) ───────────────

const mockGenders: SnailGender[] = ["Male", "Female"];
const mockStatuses: PregnantStatus[] = ["Pregnant", "Not Pregnant"];

const mockNotes: Record<string, string[]> = {
  Male: [
    "Shell exhibits narrow aperture typical of male morphology. Operculum well-developed and darkly pigmented.",
    "Tentacles elongated with subtle dorsal curl. Shell length-to-width ratio suggests male phenotype.",
    "Male characteristics confirmed: prominent right tentacle, narrow shell opening.",
  ],
  Female: [
    "Shell shows wide aperture indicative of female morphology. Noticeable soft-tissue development in mantle area.",
    "Broader shell base observed. Operculum lighter in pigmentation, consistent with female specimens.",
    "Female phenotype confirmed: wide aperture, lighter operculum, and rounded shell apex.",
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Simulated delay and response to mimic a real model inference call. */
async function mockClassifySnailImage(): Promise<ClassificationResult> {
  // Simulate network latency (0.5 – 1.2 seconds)
  const delay = 500 + Math.random() * 700;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const sex = pickRandom(mockGenders);
  const pregnancyStatus =
    sex === "Female" ? pickRandom(mockStatuses) : "Not Pregnant";
  const confidence = Math.round((93 + Math.random() * 6.9) * 10) / 10;
  const notes = pickRandom(mockNotes[sex]);

  return { sex, pregnancyStatus, confidence, morphologicalNotes: notes };
}

/** Helper: blob from a data URL */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch?.[1] ?? "image/jpeg";
  const bytes = atob(parts[1]!);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i);
  }
  return new Blob([arr], { type: mime });
}
