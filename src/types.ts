export type SnailGender = "Male" | "Female";
export type PregnantStatus = "Pregnant" | "Not Pregnant";

export interface SnailRecord {
  id: string;
  photoUrl: string;
  date: string;
  gender: SnailGender;
  pregnantStatus: PregnantStatus;
  confidence: number;
  shellLength: number | null;
  shellWidth: number | null;
  operculum: string | null;
  tentacles: string | null;
  morphologicalNotes: string;
  createdAt: any;
}

export interface SnailRecordInput {
  photoUrl: string;
  date: string;
  gender: SnailGender;
  pregnantStatus: PregnantStatus;
  confidence: number;
  shellLength: number | null;
  shellWidth: number | null;
  operculum: string | null;
  tentacles: string | null;
  morphologicalNotes: string;
}

export interface SnailCounts {
  total: number;
  male: number;
  female: number;
  pregnant: number;
}
