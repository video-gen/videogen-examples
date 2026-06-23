// env must be imported first: it sets the emulator host vars before the Admin
// SDK initializes.
import { env } from "./env.js";

import cors from "cors";
import express from "express";
import { FieldValue } from "firebase-admin/firestore";

import { requireAuth, type AuthedRequest } from "./auth.js";
import { refreshExportUrls, startGenerationDriver } from "./driver.js";
import { generationsCollection } from "./firebaseAdmin.js";
import {
  ASPECT_RATIO_PRESETS,
  QUALITY_PRESETS,
  resolveAspectRatio,
  resolveAspectRatioPreset,
  resolveQuality,
  resolveQualityPreset,
} from "./presets.js";
import { handleGenerateScript } from "./script.js";
import { errMessage } from "./util.js";
import { vg } from "./videogen.js";
import { handleVideoGenWebhook } from "./webhook.js";
import { ensureWebhookEndpoint } from "./webhookRegistration.js";

const app = express();
app.use(cors({ origin: env.webOrigin }));

// The webhook route needs the raw body for signature verification, so it is
// mounted with a raw body parser BEFORE the JSON parser below.
app.post("/api/webhooks/videogen", express.raw({ type: "*/*" }), handleVideoGenWebhook);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/options", (_req, res) => {
  res.json({ aspectRatios: ASPECT_RATIO_PRESETS, qualities: QUALITY_PRESETS });
});

app.post("/api/script", requireAuth, handleGenerateScript);

app.post("/api/generations", requireAuth, async (req: AuthedRequest, res) => {
  const uid = req.uid;
  if (uid == null) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  const body = (req.body ?? {}) as {
    script?: unknown;
    aspectRatioId?: unknown;
    qualityId?: unknown;
  };

  const script = typeof body.script === "string" ? body.script.trim() : "";
  if (script.length === 0) {
    res.status(400).json({ error: "A script is required." });
    return;
  }

  const aspectRatioId = typeof body.aspectRatioId === "string" ? body.aspectRatioId : "landscape";
  const qualityId = typeof body.qualityId === "string" ? body.qualityId : "HIGH";

  const aspectRatio = resolveAspectRatio(aspectRatioId);
  const aspectPreset = resolveAspectRatioPreset(aspectRatioId);
  const quality = resolveQuality(qualityId);
  const qualityPreset = resolveQualityPreset(quality);

  const ref = generationsCollection.doc();
  await ref.set({
    uid,
    script,
    aspectRatio,
    aspectRatioId: aspectPreset.id,
    aspectRatioLabel: aspectPreset.label,
    quality,
    qualityLabel: qualityPreset.label,
    status: "generating",
    step: "generate",
    generateProgress: 0,
    exportProgress: 0,
    workflowRunId: null,
    projectId: null,
    projectUrl: null,
    exportId: null,
    exportClaimed: false,
    downloadUrl: null,
    thumbnailUrl: null,
    error: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    const run = await vg.workflows.addVisualsNarrationsAndCaptionsToScript({
      script,
      aspectRatio,
    });
    await ref.update({
      workflowRunId: run.workflowRunId,
      projectId: run.projectId,
      projectUrl: run.projectUrl,
      updatedAt: FieldValue.serverTimestamp(),
    });
    startGenerationDriver(ref.id);
  } catch (err) {
    await ref.update({
      status: "failed",
      error: errMessage(err),
      updatedAt: FieldValue.serverTimestamp(),
    });
    res.status(502).json({ error: "Failed to start generation.", detail: errMessage(err) });
    return;
  }

  res.status(201).json({ id: ref.id });
});

app.post(
  "/api/generations/:id/refresh",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const uid = req.uid;
    if (uid == null) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }

    const id = req.params.id;
    const snapshot = await generationsCollection.doc(id).get();
    const data = snapshot.data();
    if (data == null || data.uid !== uid) {
      res.status(404).json({ error: "Not found." });
      return;
    }

    try {
      await refreshExportUrls(id);
    } catch (err) {
      console.error(`[server] failed to refresh export urls for ${id}:`, errMessage(err));
    }

    res.json({ ok: true });
  },
);

app.listen(env.port, () => {
  console.log(`[server] listening on http://localhost:${env.port}`);
  console.log(`[server] Firestore emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`[server] Auth emulator: ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  void ensureWebhookEndpoint();
});
