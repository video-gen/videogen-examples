import { env } from "./env.js";
import { vg } from "./videogen.js";

const WEBHOOK_EVENTS = [
  "workflow_run.succeeded",
  "workflow_run.failed",
  "workflow_run.cancelled",
] as const;

let webhookSecret: string | undefined = env.webhookSecret;

export function getWebhookSecret(): string | undefined {
  return webhookSecret;
}

/**
 * Webhooks are optional. If a signing secret is provided we verify with it; if
 * a public URL is provided we auto-register an endpoint and hold its secret for
 * this process. Otherwise we rely on polling alone (still fully functional).
 */
export async function ensureWebhookEndpoint(): Promise<void> {
  if (webhookSecret != null) {
    console.log("[webhook] Using VIDEOGEN_WEBHOOK_SECRET — incoming webhooks will be verified.");
    return;
  }

  if (env.webhookPublicUrl == null) {
    console.log(
      "[webhook] No WEBHOOK_PUBLIC_URL set — skipping registration. Progress is tracked by polling.",
    );
    return;
  }

  const url = `${env.webhookPublicUrl.replace(/\/$/, "")}/api/webhooks/videogen`;
  try {
    const endpoint = await vg.webhooks.createWebhookEndpoint({
      url,
      events: [...WEBHOOK_EVENTS],
    });
    webhookSecret = endpoint.signingSecret;
    console.log(`[webhook] Registered endpoint: ${url}`);
    console.log(
      `[webhook] Signing secret (set VIDEOGEN_WEBHOOK_SECRET to reuse on restart): ${endpoint.signingSecret}`,
    );
  } catch (err) {
    console.warn("[webhook] Failed to register endpoint; falling back to polling.", err);
  }
}
