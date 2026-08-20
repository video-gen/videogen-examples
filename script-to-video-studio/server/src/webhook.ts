import type { Request, Response } from "express";
import { verifyWebhookSignature } from "@videogen/sdk";
import { generationsCollection } from "./firebaseAdmin.js";
import { maybeStartExport } from "./driver.js";
import { getWebhookSecret } from "./webhookRegistration.js";

type WorkflowRunWebhookPayload = {
  event: string;
  workflowRunId: string;
  projectId: string;
  projectUrl: string;
  error?: { message?: string } | null;
};

function readWorkflowRunWebhookPayload(value: unknown): WorkflowRunWebhookPayload | null {
  if (value == null || typeof value !== "object") {
    return null;
  }
  if (
    !("event" in value) ||
    !("workflowRunId" in value) ||
    !("projectId" in value) ||
    !("projectUrl" in value)
  ) {
    return null;
  }

  const { event, workflowRunId, projectId, projectUrl } = value;
  if (
    typeof event !== "string" ||
    typeof workflowRunId !== "string" ||
    typeof projectId !== "string" ||
    typeof projectUrl !== "string"
  ) {
    return null;
  }

  const errorValue = "error" in value ? value.error : undefined;
  const error =
    errorValue != null &&
    typeof errorValue === "object" &&
    "message" in errorValue &&
    typeof errorValue.message === "string"
      ? { message: errorValue.message }
      : null;

  return { event, workflowRunId, projectId, projectUrl, error };
}

export async function handleVideoGenWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body);
  const secret = getWebhookSecret();

  let payload: WorkflowRunWebhookPayload | null = null;

  if (secret != null) {
    try {
      payload = readWorkflowRunWebhookPayload(
        verifyWebhookSignature({
          rawBody,
          headers: req.headers,
          secret,
        }),
      );
    } catch (err) {
      console.warn("[webhook] signature verification failed:", err);
      res.status(400).json({ error: "Invalid signature." });
      return;
    }
  } else {
    try {
      const parsed: unknown = JSON.parse(rawBody);
      payload = readWorkflowRunWebhookPayload(parsed);
    } catch {
      payload = null;
    }
  }

  if (payload == null) {
    res.status(400).json({ error: "Invalid JSON." });
    return;
  }

  // Acknowledge fast, then do the work.
  res.status(200).json({ received: true });

  if (!payload.event.startsWith("workflow_run.")) {
    return;
  }

  const query = await generationsCollection
    .where("workflowRunId", "==", payload.workflowRunId)
    .limit(1)
    .get();
  if (query.empty) {
    return;
  }
  const doc = query.docs[0];

  try {
    if (payload.event === "workflow_run.succeeded") {
      await doc.ref.update({
        status: "generated",
        step: "generate",
        generateProgress: 100,
        projectId: payload.projectId,
        projectUrl: payload.projectUrl,
      });
      await maybeStartExport(doc.id);
    } else {
      // workflow_run.failed | workflow_run.cancelled
      await doc.ref.update({
        status: "failed",
        error: payload.error?.message ?? `Workflow ${payload.event}.`,
      });
    }
  } catch (err) {
    console.error("[webhook] failed to apply event:", err);
  }
}
