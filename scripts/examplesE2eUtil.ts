import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { importWithRetry } from "@videogen/defs";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, "../..");

export type ManagedProcess = {
  name: string;
  child: ChildProcessWithoutNullStreams;
  stop: () => Promise<void>;
};

export const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
};

export const runCommand = async ({
  command,
  args,
  cwd,
  env,
}: {
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
}): Promise<void> => {
  await new Promise<void>((resolveCommand, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: "inherit",
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolveCommand();
        return;
      }

      reject(new Error(`Command failed (${code}): ${command} ${args.join(" ")}`));
    });
  });
};

export const startManagedProcess = ({
  name,
  command,
  args,
  cwd,
  env,
}: {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
}): ManagedProcess => {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: "pipe",
    shell: false,
  });

  child.stdout.on("data", (chunk: Buffer) => {
    process.stdout.write(`[${name}] ${chunk.toString()}`);
  });

  child.stderr.on("data", (chunk: Buffer) => {
    process.stderr.write(`[${name}] ${chunk.toString()}`);
  });

  const stop = async (): Promise<void> => {
    if (child.exitCode != null) {
      return;
    }

    child.kill("SIGTERM");

    await Promise.race([
      new Promise<void>((resolveStop) => {
        child.on("exit", () => resolveStop());
      }),
      sleep(5_000).then(() => {
        child.kill("SIGKILL");
      }),
    ]);
  };

  return { name, child, stop };
};

export const waitForHttpOk = async ({
  url,
  timeoutMs = 120_000,
  pollIntervalMs = 1_000,
}: {
  url: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<void> => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry.
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(`Timed out waiting for ${url}`);
};

export const fetchJson = async ({
  url,
  init,
}: {
  url: string;
  init?: RequestInit;
}): Promise<unknown> => {
  const response = await fetch(url, init);
  const text = await response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}: ${text}`);
  }

  return parsed;
};

export const readJsonObject = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    throw new Error("Expected JSON object response");
  }

  return value;
};

export const readJsonArray = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error("Expected JSON array response");
  }

  return value;
};

export const readJsonStringField = ({
  obj,
  fieldName,
}: {
  obj: Record<string, unknown>;
  fieldName: string;
}): string | null => {
  const value = obj[fieldName];
  return typeof value === "string" ? value : null;
};

export const ensureNpmInstalled = async ({
  cwd,
  installArgs = ["install"],
}: {
  cwd: string;
  installArgs?: string[];
}): Promise<void> => {
  if (existsSync(resolve(cwd, "node_modules"))) {
    return;
  }

  await runCommand({ command: "npm", args: installArgs, cwd });
};

export const ensureExamplePythonVenv = async ({
  cwd,
  requirementsPath,
}: {
  cwd: string;
  requirementsPath: string;
}): Promise<{ pythonPath: string }> => {
  const venvDir = resolve(cwd, ".venv");
  const pythonPath =
    process.platform === "win32"
      ? resolve(venvDir, "Scripts", "python.exe")
      : resolve(venvDir, "bin", "python");

  if (!existsSync(pythonPath)) {
    await runCommand({
      command: "python3",
      args: ["-m", "venv", venvDir],
      cwd,
    });
  }

  if (existsSync(requirementsPath)) {
    await runCommand({
      command: pythonPath,
      args: ["-m", "pip", "install", "-r", requirementsPath],
      cwd,
    });
  }

  // PyPI 1.0.0 was published before pyproject.toml picked up SDK ext deps; install them
  // from the monorepo manifest until the next videogen PyPI release.
  const sdkExtRequirementsPath = resolve(REPO_ROOT, "api/sdks/python/requirements_ext.txt");
  if (existsSync(sdkExtRequirementsPath)) {
    await runCommand({
      command: pythonPath,
      args: ["-m", "pip", "install", "-r", sdkExtRequirementsPath],
      cwd,
    });
  }

  return { pythonPath };
};

export const readFirestoreStringField = ({
  fields,
  name,
}: {
  fields: Record<string, unknown> | undefined;
  name: string;
}): string | null => {
  const field = fields?.[name];
  if (typeof field !== "object" || field == null || Array.isArray(field)) {
    return null;
  }

  const stringValue = field.stringValue;
  return typeof stringValue === "string" ? stringValue : null;
};

export const loadVideoGenSdk = async (): Promise<{
  VideoGenClient: new (opts: { token: string; baseUrl: string }) => VideoGenSdkClient;
  pollExecutedTool: (
    client: VideoGenSdkClient,
    toolExecutionId: string,
    options?: { pollIntervalMs?: number; timeoutMs?: number },
  ) => Promise<{ status?: string }>;
}> => {
  const sdkEntry = resolve(REPO_ROOT, "api/sdks/typescript/dist/esm/index.mjs");

  if (!existsSync(sdkEntry)) {
    throw new Error(
      "TypeScript SDK not built. Run: cd api/sdks/typescript && pnpm install && pnpm build",
    );
  }

  const sdkModule = await importWithRetry(() => import(sdkEntry));

  if (
    typeof sdkModule !== "object" ||
    sdkModule == null ||
    !("VideoGenClient" in sdkModule) ||
    !("pollExecutedTool" in sdkModule) ||
    typeof sdkModule.VideoGenClient !== "function" ||
    typeof sdkModule.pollExecutedTool !== "function"
  ) {
    throw new Error("Unexpected SDK export shape from api/sdks/typescript/dist");
  }

  return {
    VideoGenClient: sdkModule.VideoGenClient,
    pollExecutedTool: sdkModule.pollExecutedTool,
  };
};

type VideoGenSdkClient = object;

export const pollToolExecutionUntilTerminal = async ({
  apiKey,
  baseUrl,
  toolExecutionId,
  timeoutMs,
}: {
  apiKey: string;
  baseUrl: string;
  toolExecutionId: string;
  timeoutMs: number;
}): Promise<{ status: string }> => {
  const { VideoGenClient, pollExecutedTool } = await loadVideoGenSdk();
  const client = new VideoGenClient({ token: apiKey, baseUrl });
  const result = await pollExecutedTool(client, toolExecutionId, {
    pollIntervalMs: 2_000,
    timeoutMs,
  });

  const status = result.status ?? "unknown";
  if (status !== "succeeded") {
    throw new Error(`Tool execution ${toolExecutionId} ended with status=${status}`);
  }

  return { status };
};
