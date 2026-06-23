import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-script-to-video";
const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS !== "false";

const app =
  getApps().length > 0
    ? getApp()
    : initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "demo-api-key",
        projectId,
        authDomain: `${projectId}.firebaseapp.com`,
      });

export const auth = getAuth(app);
export const db = getFirestore(app);

declare global {
  interface Window {
    __vgEmulatorsConnected?: boolean;
  }
}

if (useEmulators && typeof window !== "undefined" && window.__vgEmulatorsConnected !== true) {
  window.__vgEmulatorsConnected = true;

  const authUrl = process.env.NEXT_PUBLIC_AUTH_EMULATOR_URL ?? "http://127.0.0.1:9099";
  const firestoreHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ?? "127.0.0.1";
  const firestorePort = Number(process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT ?? 8080);

  connectAuthEmulator(auth, authUrl, { disableWarnings: true });
  connectFirestoreEmulator(db, firestoreHost, firestorePort);
}
