// Importing env first ensures the emulator host env vars are set before the
// Admin SDK initializes.
import { env } from "./env.js";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  // No service-account credentials needed: when FIRESTORE_EMULATOR_HOST /
  // FIREBASE_AUTH_EMULATOR_HOST are set, the Admin SDK talks to the emulators.
  initializeApp({ projectId: env.projectId });
}

export const db = getFirestore();
export const adminAuth = getAuth();
export const generationsCollection = db.collection("generations");
