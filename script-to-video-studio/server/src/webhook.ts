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

export async function handleVideoGenWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body);
  const secret = getWebhookSecret();

  if (secret != null) {
    const headers = {
      "webhook-id": String(req.headers["webhook-id"] ?? ""),
      "webhook-timestamp": String(req.headers["webhook-timestamp"] ?? ""),
      "webhook-signature": String(req.headers["webhook-signature"] ?? ""),
    };
    try {
      // Verify the Standard Webhooks signature for security. We then parse the
      // raw body ourselves to read the workflow-run fields.
      verifyWebhookSignature(rawBody, headers, secret);
    } catch (err) {
      console.warn("[webhook] signature verification failed:", err);
      res.status(400).json({ error: "Invalid signature." });
      return;
    }
  }

  let payload: WorkflowRunWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    res.status(400).json({ error: "Invalid JSON." });
    return;
  }

  // Acknowledge fast, then do the work.
  res.status(200).json({ received: true });

  if (!payload.event?.startsWith("workflow_run.")) {
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
