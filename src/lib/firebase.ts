/**
 * Firebase configuration and service module.
 *
 * Photos are stored as base64 data URLs directly in Firestore documents
 * (up to ~800KB per document limit), avoiding the need for Cloud Storage.
 * If you later enable Firebase Storage, you can swap to uploading files there.
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
  type Timestamp,
  type Firestore,
  serverTimestamp,
} from "firebase/firestore";
import type { SnailGender, PregnantStatus } from "../types";

// ── Firebase Config ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyB0GZOtJsPn7zw4kPHRRnjjZmoCao9Eu6c",
  authDomain: "snail-c6aee.firebaseapp.com",
  projectId: "snail-c6aee",
  storageBucket: "snail-c6aee.firebasestorage.app",
  messagingSenderId: "712503067281",
  appId: "1:712503067281:web:9e3321c90842ba5cb63530",
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

function getApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

function getDb(): Firestore {
  if (!db) {
    db = getFirestore(getApp());
  }
  return db;
}

// ── Types ────────────────────────────────────────────────────────

export interface SnailLog {
  id: string;
  /** Base64 data URL or empty string if no photo. */
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
  createdAt: Timestamp | null;
}

export interface SnailLogInput {
  /** Base64 data URL of the photo (e.g. "data:image/jpeg;base64,...") */
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

// ── Firestore Helpers ────────────────────────────────────────────

const SNAILS_COLLECTION = "snails";

/** Format a Firestore doc into a SnailLog. */
function docToLog(docSnap: any): SnailLog {
  const data = docSnap.data()!;
  return {
    id: docSnap.id,
    photoUrl: data.photoUrl ?? "",
    date: data.date ?? "",
    gender: data.gender ?? "Male",
    pregnantStatus: data.pregnantStatus ?? "Not Pregnant",
    confidence: data.confidence ?? 0,
    shellLength: data.shellLength ?? null,
    shellWidth: data.shellWidth ?? null,
    operculum: data.operculum ?? null,
    tentacles: data.tentacles ?? null,
    morphologicalNotes: data.morphologicalNotes ?? "",
    createdAt: data.createdAt ?? null,
  } as SnailLog;
}

/** Add a new snail log to Firestore. Returns the new document ID. */
export async function addSnailLog(input: SnailLogInput): Promise<string> {
  const docRef = await addDoc(collection(getDb(), SNAILS_COLLECTION), {
    ...input,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/** Get all snail logs ordered by date descending. */
export async function getAllSnailLogs(): Promise<SnailLog[]> {
  const q = query(
    collection(getDb(), SNAILS_COLLECTION),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToLog);
}

/** Get a single snail log by ID. */
export async function getSnailLogById(id: string): Promise<SnailLog | null> {
  const snap = await getDoc(doc(getDb(), SNAILS_COLLECTION, id));
  if (!snap.exists()) return null;
  return docToLog(snap);
}

/** Get the most recent N snail logs. */
export async function getRecentSnailLogs(n: number): Promise<SnailLog[]> {
  const q = query(
    collection(getDb(), SNAILS_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(n)
  );
  const snap = await getDocs(q);
  return snap.docs.map(docToLog);
}

/** Update specific fields on a snail log. */
export async function updateSnailLog(
  id: string,
  updates: Partial<SnailLogInput>
): Promise<void> {
  await updateDoc(doc(getDb(), SNAILS_COLLECTION, id), updates);
}

/** Delete a snail log by ID. */
export async function deleteSnailLog(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), SNAILS_COLLECTION, id));
}

// ── Aggregate Queries ────────────────────────────────────────────

export interface SnailCounts {
  total: number;
  male: number;
  female: number;
  pregnant: number;
}

/**
 * Get aggregate counts from the snails collection using server-side aggregation.
 * No documents are fetched — only count results are returned.
 * This is dramatically faster than fetching all docs and counting client-side.
 */
export async function getSnailCounts(): Promise<SnailCounts> {
  const db = getDb();
  const collRef = collection(db, SNAILS_COLLECTION);

  const [
    totalSnap,
    maleSnap,
    femaleSnap,
    pregnantSnap,
  ] = await Promise.all([
    getCountFromServer(query(collRef)),
    getCountFromServer(query(collRef, where("gender", "==", "Male"))),
    getCountFromServer(query(collRef, where("gender", "==", "Female"))),
    getCountFromServer(query(collRef, where("pregnantStatus", "==", "Pregnant"))),
  ]);

  return {
    total: totalSnap.data().count,
    male: maleSnap.data().count,
    female: femaleSnap.data().count,
    pregnant: pregnantSnap.data().count,
  };
}
