/* eslint-disable no-console */

/**
 * Runs happy-path E2E checks for every app under `examples/`.
 *
 * Provisions VideoGen + OpenAI credentials automatically (no manual `.env` setup).
 *
 *   pnpm examples:e2e
 *   pnpm examples:e2e -- --only ai-image-editor,talking-avatar-webhook
 *
 * Prerequisites:
 *   - `pnpm dev:api` running (developer API on :4010 + Stripe forwarding)
 *   - `pnpm auth-gcloud` (Secret Manager: OpenAI-Examples-ApiKey_LOCAL)
 *   - Java 11+ for script-to-video-studio Firebase emulators
 */

import {
  provisionAndWriteLocalExampleEnvFiles,
  waitForDeveloperApiHealth,
} from "../../api/scripts/local-examples-provision.js";
import { runExampleE2eCases } from "./examplesE2eCases.js";
import { parseOnlyArg, printReport } from "./examplesE2eRunnerShared.js";

async function main(): Promise<void> {
  const startedAt = Date.now();
  const only = parseOnlyArg();

  console.log("\nExamples E2E\n");
  console.log("Waiting for local developer API...");
  await waitForDeveloperApiHealth();

  console.log("Provisioning credentials + writing example env files...");
  const setup = await provisionAndWriteLocalExampleEnvFiles();
  console.log(`VideoGen API key: ${setup.apiKey.slice(0, 8)}...`);
  console.log(`OpenAI key: loaded from OpenAI-Examples-ApiKey_LOCAL`);
  console.log(`Running cases: ${only.join(", ")}\n`);

  const results = await runExampleE2eCases({ setup, only });
  printReport({ results, totalDurationMs: Date.now() - startedAt });

  const failed = results.some((result) => !result.passed);
  process.exit(failed ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
