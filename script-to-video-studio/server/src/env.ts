import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (value == null || value === "") {
    throw new Error(`Missing required env var: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value == null || value === "" ? undefined : value;
}

export const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "demo-script-to-video";

// The Firebase Admin SDK talks to the local emulators when these are set. We
// default them so a fresh checkout "just works" against `firebase emulators:start`.
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
process.env.GCLOUD_PROJECT ??= PROJECT_ID;

export const env = {
  projectId: PROJECT_ID,
  port: Number(process.env.PORT ?? 4100),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  videogenApiKey: required("VIDEOGEN_API_KEY"),
  videogenApiUrl: optional("VIDEOGEN_API_URL"),
  webhookPublicUrl: optional("WEBHOOK_PUBLIC_URL"),
  webhookSecret: optional("VIDEOGEN_WEBHOOK_SECRET"),
};
