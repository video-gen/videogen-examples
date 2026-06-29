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
 *   - Built TS SDK: `cd api/sdks/typescript && pnpm install && pnpm build`
 */

import {
  provisionAndWriteLocalExampleEnvFiles,
  waitForDeveloperApiHealth,
} from "../../api/scripts/local-examples-provision.js";
import {
  ALL_EXAMPLE_E2E_CASES,
  runExampleE2eCases,
  type ExampleE2eCaseId,
  type ExampleE2eCaseResult,
} from "./examplesE2eCases.js";

const parseOnlyArg = (): ExampleE2eCaseId[] => {
  const onlyIndex = process.argv.indexOf("--only");
  if (onlyIndex === -1) {
    return [...ALL_EXAMPLE_E2E_CASES];
  }

  const raw = process.argv[onlyIndex + 1] ?? "";
  const ids = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return ids.map((id) => {
    const match = ALL_EXAMPLE_E2E_CASES.find((caseId) => caseId === id);
    if (match == null) {
      throw new Error(
        `Unknown --only id "${id}". Valid: ${ALL_EXAMPLE_E2E_CASES.join(", ")}`,
      );
    }

    return match;
  });
};

const printReport = ({
  results,
  totalDurationMs,
}: {
  results: ExampleE2eCaseResult[];
  totalDurationMs: number;
}): void => {
  console.log("\n=== examples E2E report ===\n");

  for (const result of results) {
    const status = result.passed ? "PASS" : "FAIL";
    const seconds = Math.round(result.durationMs / 1000);
    console.log(`${status}  ${result.label} (${seconds}s)`);
    if (result.errorMessage != null) {
      console.log(`       ${result.errorMessage}`);
    }
  }

  const failed = results.filter((result) => !result.passed).length;
  console.log(
    `\n${results.length - failed}/${results.length} passed · total ${Math.round(totalDurationMs / 1000)}s\n`,
  );
};

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
