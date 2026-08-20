/* eslint-disable no-console */

/**
 * Shared CLI helpers for the two examples-E2E entry points:
 *   - `runExamplesE2e.ts`       — LOCAL: provisions a throwaway key against `pnpm dev:api`.
 *   - `runExamplesE2eRemote.ts` — REMOTE: runs the example apps locally but points them at a
 *                                 deployed developer API using an injected API token.
 */

import {
  ALL_EXAMPLE_E2E_CASES,
  type ExampleE2eCaseId,
  type ExampleE2eCaseResult,
} from "./examplesE2eCases.js";

export const parseOnlyArg = (): ExampleE2eCaseId[] => {
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

export const printReport = ({
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
