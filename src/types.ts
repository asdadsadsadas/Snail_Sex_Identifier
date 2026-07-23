export type SnailGender = "Male" | "Female";
export type PregnantStatus = "Pregnant" | "Not Pregnant";

export interface SnailRecord {
  id: string;
  date: string;
  gender: SnailGender;
  pregnantStatus: PregnantStatus;
  confidence: number;
  imageUrl?: string;
  shellLength?: number;
  shellWidth?: number;
  operculum?: string;
  tentacles?: string;
  morphologicalNotes?: string;
}

export type ScreenName = "Home" | "Scan" | "History" | "Stats" | "Detail";

/** Minimal snapshot returned by the mock (or real) YOLO API. */
export interface YoloResult {
  sex: SnailGender;
  pregnancyStatus: PregnantStatus;
  confidence: number;
  morphologicalNotes: string;
}
