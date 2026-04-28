/**
 * Pins `videogen` / `@videogen/sdk` in `examples/` to the version in `api/fern/sdk-version`.
 * Run from repo root: `node examples/scripts/sync-sdk-version.mjs`
 * Or: `pnpm sync-examples-sdk-version` (root) / `pnpm sync-sdk-version` (examples/)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../..");
const sdkVersionPath = join(repoRoot, "api/fern/sdk-version");

const version = readFileSync(sdkVersionPath, "utf8").trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(
    `Invalid or missing SDK version in api/fern/sdk-version: "${version}"`,
  );
  process.exit(1);
}

const requirementsPaths = [
  join(repoRoot, "examples/ai-image-editor/requirements.txt"),
  join(repoRoot, "examples/talking-avatar-webhook/requirements.txt"),
];

for (const reqPath of requirementsPaths) {
  const text = readFileSync(reqPath, "utf8");
  const next = text.replace(/^videogen>=.*$/m, `videogen>=${version}`);
  if (next === text) {
    console.error(
      `No videogen>= line to update in ${reqPath.replace(repoRoot + "/", "")}`,
    );
    process.exit(1);
  }
  writeFileSync(reqPath, next);
}

const pkgPath = join(repoRoot, "examples/ai-social-content/package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.dependencies["@videogen/sdk"] = `^${version}`;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`Examples pinned to @videogen/sdk / videogen ^${version} (api/fern/sdk-version).`);
