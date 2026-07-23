/**
 * YOLO Snail Classification API Service
 *
 * This module provides the interface to the external YOLO classification model.
 * When the real API endpoint is ready, update the `API_URL` and the
 * `classifySnailImage` function will send the photo to your model.
 *
 * Until then, `mockClassifySnailImage` simulates the response so the rest of
 * the app is fully clickable and testable.
 */

import type { SnailGender, PregnantStatus } from "../types";

// ── Configuration ────────────────────────────────────────────────
// Swap this URL for your real YOLO model endpoint when it's ready.
const API_URL =
  import.meta.env.VITE_YOLO_API_URL || "https://your-yolo-api.example.com/classify";

// ── Response Shape ───────────────────────────────────────────────

export interface ClassificationResult {
  sex: SnailGender;
  pregnancyStatus: PregnantStatus;
  confidence: number;
  morphologicalNotes: string;
}

// ── Mock Implementation ──────────────────────────────────────────

/**
 * Run YOLO classification against a snail photo.
 *
 * Sends the image blob to the configured API endpoint via FormData.
 * Falls back to the mock classifier when the endpoint isn't reachable
 * or VITE_USE_MOCK_YOLO is set to "true".
 */
export async function classifySnailImage(imageBlob: Blob): Promise<ClassificationResult> {
  const useMock =
    import.meta.env.VITE_USE_MOCK_YOLO === "true" ||
    API_URL.includes("your-yolo-api");

  if (useMock) {
    return mockClassifySnailImage();
  }

  // ── Real API call (ready when your endpoint is live) ──────
  const formData = new FormData();
  formData.append("image", imageBlob, "snail.jpg");

  const response = await fetch(API_URL, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`YOLO API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    sex: data.sex as SnailGender,
    pregnancyStatus: data.pregnancyStatus as PregnantStatus,
    confidence: data.confidence,
    morphologicalNotes: data.morphologicalNotes ?? "",
  };
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
  // Simulate network latency (1.5 – 3 seconds)
  const delay = 1500 + Math.random() * 1500;
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
