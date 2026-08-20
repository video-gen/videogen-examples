/* eslint-disable no-console */

/**
 * Runs happy-path E2E checks for every app under `examples/` against a DEPLOYED
 * developer API (DEV / PRERELEASE / PROD) instead of a local `pnpm dev:api`.
 *
 * The example apps still run locally (Next.js dev servers, Python/uvicorn, Firebase
 * emulators, Playwright), but every VideoGen SDK call inside them targets the real
 * deployed API host using the injected developer API token. This is one of the
 * suites the `e2e-tests-job` Cloud Run Job invokes.
 *
 *   VIDEOGEN_API_TOKEN=vg_... VIDEOGEN_BASE_URL=https://dev.api.videogen.io \
 *     tsx examples/scripts/runExamplesE2eRemote.ts
 *   ... --only ai-image-editor,talking-avatar-webhook
 *
 * Required env:
 *   - VIDEOGEN_API_TOKEN  developer API key for the target environment
 *   - VIDEOGEN_BASE_URL   deployed developer API base URL (e.g. https://dev.api.videogen.io)
 * Optional env:
 *   - OPENAI_API_KEY      only needed by the ai-image-editor agent path (unused by its happy path)
 *
 * Local prerequisites (same runtimes as `pnpm examples:e2e`, just remote API):
 *   - Node + npm, Python 3, Java 11+ (Firebase emulators), Playwright browsers.
 */

import { buildRemoteExamplesEnvSetup } from "../../api/scripts/remote-examples-setup.js";
import { waitForDeveloperApiHealth } from "../../api/scripts/local-examples-provision.js";
import { runExampleE2eCases } from "./examplesE2eCases.js";
import { parseOnlyArg, printReport } from "./examplesE2eRunnerShared.js";

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (value == null || value === "") {
    throw new Error(`Missing required env var ${name} for remote examples E2E run.`);
  }

  return value;
};

async function main(): Promise<void> {
  const startedAt = Date.now();
  const only = parseOnlyArg();

  const apiKey = requireEnv("VIDEOGEN_API_TOKEN");
  const baseUrl = requireEnv("VIDEOGEN_BASE_URL");
  const openAiApiKey = process.env.OPENAI_API_KEY ?? "";

  console.log("\nExamples E2E (remote API)\n");
  console.log(`Target developer API: ${baseUrl}`);
  console.log("Waiting for developer API health...");
  await waitForDeveloperApiHealth({ baseUrl, logProgress: true });

  console.log("Writing example env files (pointed at the deployed API)...");
  const setup = buildRemoteExamplesEnvSetup({ apiKey, baseUrl, openAiApiKey });
  console.log(`VideoGen API key: ${apiKey.slice(0, 8)}...`);
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
