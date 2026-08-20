import { chromium } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { LocalExamplesEnvSetup } from "../../api/scripts/local-examples-provision.js";
import {
  ensureNpmInstalled,
  ensureExamplePythonVenv,
  fetchJson,
  pollToolExecutionUntilTerminal,
  readFirestoreStringField,
  readJsonArray,
  readJsonObject,
  readJsonStringField,
  REPO_ROOT,
  runCommand,
  sleep,
  startManagedProcess,
  waitForHttpOk,
  waitForHttpReachable,
  type ManagedProcess,
} from "./examplesE2eUtil.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type ExampleE2eCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  durationMs: number;
  errorMessage: string | null;
};

const SOCIAL_CONTENT_PORT = 3020;
const TALKING_AVATAR_PORT = 8000;
const STUDIO_SERVER_PORT = 4100;
const FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const AUTH_EMULATOR_URL = "http://127.0.0.1:9099";
/** One-sentence script + STANDARD export; ~2–3 min typical, 10 min ceiling for cold local stack. */
const SCRIPT_TO_VIDEO_STUDIO_GENERATION_TIMEOUT_MS = 10 * 60_000;

/**
 * Provisioned credentials injected directly into every example subprocess. The
 * provisioning step already writes these into each example's `.env`, but some
 * example entrypoints resolve their `.env` relative to the script file rather
 * than the working directory (e.g. python-dotenv's `load_dotenv()` searches
 * upward from the calling file). Injecting them here guarantees the vars are
 * present regardless of each example's `.env` discovery behavior.
 */
const provisionedExampleEnv = (setup: LocalExamplesEnvSetup): NodeJS.ProcessEnv => ({
  VIDEOGEN_API_KEY: setup.apiKey,
  VIDEOGEN_API_URL: setup.baseUrl,
  OPENAI_API_KEY: setup.openAiApiKey,
});

const runCase = async ({
  id,
  label,
  run,
}: {
  id: string;
  label: string;
  run: () => Promise<void>;
}): Promise<ExampleE2eCaseResult> => {
  const startedAt = Date.now();

  try {
    await run();
    return {
      id,
      label,
      passed: true,
      durationMs: Date.now() - startedAt,
      errorMessage: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      id,
      label,
      passed: false,
      durationMs: Date.now() - startedAt,
      errorMessage: message,
    };
  }
};

export const runAiSocialContentHappyPath = async ({
  setup,
}: {
  setup: LocalExamplesEnvSetup;
}): Promise<ExampleE2eCaseResult> => {
  return await runCase({
    id: "ai-social-content",
    label: "AI Social Content Generator",
    run: async () => {
      const exampleDir = resolve(REPO_ROOT, "examples/ai-social-content");
      await ensureNpmInstalled({ cwd: exampleDir });

      const socialContentOrigin = `http://127.0.0.1:${SOCIAL_CONTENT_PORT}`;
      const devServer = startManagedProcess({
        name: "ai-social-content",
        command: "npm",
        args: ["run", "dev", "--", "-p", String(SOCIAL_CONTENT_PORT), "-H", "127.0.0.1"],
        cwd: exampleDir,
        env: provisionedExampleEnv(setup),
      });

      try {
        await waitForHttpOk({ url: socialContentOrigin, timeoutMs: 180_000 });

        const browser = await chromium.launch({ headless: true });
        try {
          const page = await browser.newPage();
          await page.goto(socialContentOrigin, { waitUntil: "networkidle" });

          await page.getByLabel("Content description").fill(
            "Create only one static social image (no video or voiceover): a simple green leaf icon.",
          );
          await page.getByRole("button", { name: "Generate" }).click();

          await page.getByText("AI Summary").waitFor({ timeout: 300_000 });
          await page.locator('img[alt]').first().waitFor({ timeout: 60_000 });
        } finally {
          await browser.close();
        }
      } finally {
        await devServer.stop();
      }
    },
  });
};

const readStringFieldAnyCasing = ({
  obj,
  fieldNames,
}: {
  obj: Record<string, unknown>;
  fieldNames: string[];
}): string | null => {
  for (const fieldName of fieldNames) {
    const value = readJsonStringField({ obj, fieldName });
    if (value != null) {
      return value;
    }
  }

  return null;
};

const developerApiHeaders = (apiKey: string): HeadersInit => ({
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
});

/**
 * The talking-avatar example only lists ACTOR entities that already have a
 * reference image. Remote e2e uses a long-lived API key that may have none.
 */
const ensureTalkingAvatarActorWithReference = async ({
  setup,
}: {
  setup: LocalExamplesEnvSetup;
}): Promise<void> => {
  const baseUrl = setup.baseUrl.replace(/\/$/, "");
  const listed = readJsonObject(
    await fetchJson({
      url: `${baseUrl}/v1/entities?entityType=ACTOR&limit=50`,
      init: { headers: developerApiHeaders(setup.apiKey) },
    }),
  );
  const entities = listed.entities;
  if (Array.isArray(entities)) {
    for (const entry of entities) {
      const entity = readJsonObject(entry);
      const entityId = readStringFieldAnyCasing({
        obj: entity,
        fieldNames: ["entityId", "entity_id"],
      });
      const references = entity.references;
      const isBuiltIn = entity.isBuiltIn === true || entity.is_built_in === true;
      const actorConfig =
        entity.actorConfig != null && typeof entity.actorConfig === "object"
          ? readJsonObject(entity.actorConfig)
          : entity.actor_config != null && typeof entity.actor_config === "object"
            ? readJsonObject(entity.actor_config)
            : null;
      const hasAvatarPresenter =
        actorConfig?.hasAvatarPresenter === true || actorConfig?.has_avatar_presenter === true;
      if (
        entityId != null &&
        (isBuiltIn ||
          hasAvatarPresenter ||
          (Array.isArray(references) && references.length > 0))
      ) {
        return;
      }
    }
  }

  const created = readJsonObject(
    await fetchJson({
      url: `${baseUrl}/v1/entities`,
      init: {
        method: "POST",
        headers: developerApiHeaders(setup.apiKey),
        body: JSON.stringify({
          entityType: "ACTOR",
          name: "Examples e2e talking avatar",
          description: "Seeded by examples-e2e when the API key has no actor references.",
        }),
      },
    }),
  );
  const actorEntityId = readStringFieldAnyCasing({
    obj: created,
    fieldNames: ["entityId", "entity_id"],
  });
  if (actorEntityId == null) {
    throw new Error(`create entity did not return an id: ${JSON.stringify(created)}`);
  }

  const started = readJsonObject(
    await fetchJson({
      url: `${baseUrl}/v1/tools/generate-image`,
      init: {
        method: "POST",
        headers: developerApiHeaders(setup.apiKey),
        body: JSON.stringify({
          prompt:
            "Photorealistic head-and-shoulders portrait of an adult looking at the camera, studio lighting, plain background.",
          quality: "LOW",
          numResults: 1,
        }),
      },
    }),
  );
  const toolExecutionId = readStringFieldAnyCasing({
    obj: started,
    fieldNames: ["toolExecutionId", "tool_execution_id"],
  });
  if (toolExecutionId == null) {
    throw new Error(`generate-image did not return an execution id: ${JSON.stringify(started)}`);
  }

  await pollToolExecutionUntilTerminal({
    apiKey: setup.apiKey,
    baseUrl,
    toolExecutionId,
    timeoutMs: 180_000,
  });

  const executed = readJsonObject(
    await fetchJson({
      url: `${baseUrl}/v1/tools/executions/${toolExecutionId}`,
      init: { headers: developerApiHeaders(setup.apiKey) },
    }),
  );
  const results = executed.results;
  const firstResult =
    Array.isArray(results) && results[0] != null ? readJsonObject(results[0]) : null;
  const portraitFileId =
    firstResult == null
      ? null
      : readStringFieldAnyCasing({
          obj: firstResult,
          fieldNames: ["fileId", "file_id"],
        });
  if (portraitFileId == null) {
    throw new Error(`generate-image succeeded without a file id: ${JSON.stringify(executed)}`);
  }

  await fetchJson({
    url: `${baseUrl}/v1/entities/${actorEntityId}/references`,
    init: {
      method: "POST",
      headers: developerApiHeaders(setup.apiKey),
      body: JSON.stringify({
        fileId: portraitFileId,
        isDefault: true,
        description: "Examples e2e talking-avatar reference",
      }),
    },
  });
};

export const runTalkingAvatarHappyPath = async ({
  setup,
}: {
  setup: LocalExamplesEnvSetup;
}): Promise<ExampleE2eCaseResult> => {
  return await runCase({
    id: "talking-avatar-webhook",
    label: "Talking Avatar Webhook Server",
    run: async () => {
      const exampleDir = resolve(REPO_ROOT, "examples/talking-avatar-webhook");
      const { pythonPath } = await ensureExamplePythonVenv({
        cwd: exampleDir,
        requirementsPath: resolve(exampleDir, "requirements.txt"),
      });

      const server = startManagedProcess({
        name: "talking-avatar",
        command: pythonPath,
        args: ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", String(TALKING_AVATAR_PORT)],
        cwd: exampleDir,
        env: provisionedExampleEnv(setup),
      });

      try {
        await waitForHttpOk({
          url: `http://127.0.0.1:${TALKING_AVATAR_PORT}/docs`,
          timeoutMs: 120_000,
        });

        await ensureTalkingAvatarActorWithReference({ setup });

        const voicesRaw = readJsonArray(
          await fetchJson({ url: `http://127.0.0.1:${TALKING_AVATAR_PORT}/voices` }),
        );
        const actorsRaw = readJsonArray(
          await fetchJson({ url: `http://127.0.0.1:${TALKING_AVATAR_PORT}/actors` }),
        );

        const voices: string[] = [];
        for (const entry of voicesRaw) {
          const voiceId = readJsonStringField({
            obj: readJsonObject(entry),
            fieldName: "voice_id",
          });
          if (voiceId != null) {
            voices.push(voiceId);
          }
        }

        const actors: string[] = [];
        for (const entry of actorsRaw) {
          const actorEntityId = readJsonStringField({
            obj: readJsonObject(entry),
            fieldName: "actor_entity_id",
          });
          if (actorEntityId != null) {
            actors.push(actorEntityId);
          }
        }

        if (voices.length === 0 || actors.length === 0) {
          throw new Error(
            `Expected at least one voice and one actor from the example server (voices=${voices.length}, actors=${actors.length})`,
          );
        }

        const job = readJsonObject(
          await fetchJson({
            url: `http://127.0.0.1:${TALKING_AVATAR_PORT}/generate-avatar`,
            init: {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: "Hello from the talking avatar examples e2e test.",
                voice_id: voices[0],
                actor_entity_id: actors[0],
              }),
            },
          }),
        );

        const ttsExecutionId = readJsonStringField({
          obj: job,
          fieldName: "tts_execution_id",
        });
        const avatarExecutionId = readJsonStringField({
          obj: job,
          fieldName: "avatar_execution_id",
        });

        if (ttsExecutionId == null || avatarExecutionId == null) {
          throw new Error(`generate-avatar did not return execution ids: ${JSON.stringify(job)}`);
        }

        await pollToolExecutionUntilTerminal({
          apiKey: setup.apiKey,
          baseUrl: setup.baseUrl,
          toolExecutionId: ttsExecutionId,
          timeoutMs: 180_000,
        });

        await pollToolExecutionUntilTerminal({
          apiKey: setup.apiKey,
          baseUrl: setup.baseUrl,
          toolExecutionId: avatarExecutionId,
          timeoutMs: 600_000,
        });
      } finally {
        await server.stop();
      }
    },
  });
};

export const runAiImageEditorHappyPath = async ({
  setup,
}: {
  setup: LocalExamplesEnvSetup;
}): Promise<ExampleE2eCaseResult> => {
  return await runCase({
    id: "ai-image-editor",
    label: "AI Image Editor",
    run: async () => {
      const exampleDir = resolve(REPO_ROOT, "examples/ai-image-editor");
      const { pythonPath } = await ensureExamplePythonVenv({
        cwd: exampleDir,
        requirementsPath: resolve(exampleDir, "requirements.txt"),
      });

      await runCommand({
        command: pythonPath,
        args: [resolve(REPO_ROOT, "examples/scripts/e2e/ai_image_editor_happy_path.py")],
        cwd: exampleDir,
        env: { ...provisionedExampleEnv(setup), PYTHONPATH: exampleDir },
      });
    },
  });
};

const waitForFirebaseEmulators = async (): Promise<void> => {
  await waitForHttpOk({
    url: `${AUTH_EMULATOR_URL}/emulator/v1/projects/demo-script-to-video/config`,
    timeoutMs: 180_000,
  });

  await waitForHttpReachable({
    url: `http://${FIRESTORE_EMULATOR_HOST}/`,
    timeoutMs: 180_000,
  });
};

const signUpFirebaseEmulatorUser = async (): Promise<string> => {
  const email = `examples-e2e-${Date.now()}@videogen.io`;
  const password = "examples-e2e-password";

  const response = readJsonObject(
    await fetchJson({
      url: `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      },
    }),
  );

  const idToken = readJsonStringField({ obj: response, fieldName: "idToken" });

  if (idToken == null || idToken === "") {
    throw new Error("Firebase emulator sign-up did not return an idToken");
  }

  return idToken;
};

const pollStudioGenerationSucceeded = async ({
  generationId,
  idToken,
  timeoutMs,
}: {
  generationId: string;
  idToken: string;
  timeoutMs: number;
}): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  const url = `http://${FIRESTORE_EMULATOR_HOST}/v1/projects/demo-script-to-video/databases/(default)/documents/generations/${generationId}`;

  while (Date.now() < deadline) {
    const doc = readJsonObject(
      await fetchJson({
        url,
        init: { headers: { Authorization: `Bearer ${idToken}` } },
      }),
    );
    const fieldsValue = doc.fields;
    const fields =
      typeof fieldsValue === "object" && fieldsValue != null && !Array.isArray(fieldsValue)
        ? fieldsValue
        : undefined;

    const status = readFirestoreStringField({ fields, name: "status" });
    const downloadUrl = readFirestoreStringField({ fields, name: "downloadUrl" });
    const error = readFirestoreStringField({ fields, name: "error" });

    if (status === "failed") {
      throw new Error(error ?? "Script-to-video studio generation failed");
    }

    if (status === "ready" && downloadUrl != null && downloadUrl !== "") {
      return;
    }

    await sleep(5_000);
  }

  throw new Error(`Timed out waiting for generation ${generationId} to succeed`);
};

export const runScriptToVideoStudioHappyPath = async ({
  setup,
}: {
  setup: LocalExamplesEnvSetup;
}): Promise<ExampleE2eCaseResult> => {
  return await runCase({
    id: "script-to-video-studio",
    label: "Script to Video Studio",
    run: async () => {
      const exampleDir = resolve(REPO_ROOT, "examples/script-to-video-studio");
      await ensureNpmInstalled({ cwd: exampleDir, installArgs: ["run", "install:all"] });

      const processes: ManagedProcess[] = [];

      processes.push(
        startManagedProcess({
          name: "studio-emulators",
          command: "npm",
          args: ["run", "emulators"],
          cwd: exampleDir,
        }),
      );

      processes.push(
        startManagedProcess({
          name: "studio-server",
          command: "npm",
          args: ["run", "dev:server"],
          cwd: exampleDir,
          env: provisionedExampleEnv(setup),
        }),
      );

      try {
        await waitForFirebaseEmulators();

        await waitForHttpOk({
          url: `http://127.0.0.1:${STUDIO_SERVER_PORT}/api/health`,
          timeoutMs: 180_000,
        });

        const idToken = await signUpFirebaseEmulatorUser();

        const created = readJsonObject(
          await fetchJson({
            url: `http://127.0.0.1:${STUDIO_SERVER_PORT}/api/generations`,
            init: {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                script: "Examples E2E test. This is one short sentence for a minimal video.",
                aspectRatioId: "landscape",
                qualityId: "STANDARD",
              }),
            },
          }),
        );

        const generationId = readJsonStringField({ obj: created, fieldName: "id" });
        if (generationId == null || generationId === "") {
          throw new Error(`POST /api/generations did not return id: ${JSON.stringify(created)}`);
        }

        await pollStudioGenerationSucceeded({
          generationId,
          idToken,
          timeoutMs: SCRIPT_TO_VIDEO_STUDIO_GENERATION_TIMEOUT_MS,
        });
      } finally {
        for (const proc of processes.reverse()) {
          await proc.stop();
        }
      }
    },
  });
};

export const ALL_EXAMPLE_E2E_CASES = [
  "ai-social-content",
  "talking-avatar-webhook",
  "ai-image-editor",
  "script-to-video-studio",
] as const;

export type ExampleE2eCaseId = (typeof ALL_EXAMPLE_E2E_CASES)[number];

export const runExampleE2eCases = async ({
  setup,
  only,
}: {
  setup: LocalExamplesEnvSetup;
  only: ExampleE2eCaseId[];
}): Promise<ExampleE2eCaseResult[]> => {
  const selected = new Set(only);
  const results: ExampleE2eCaseResult[] = [];

  if (selected.has("ai-social-content")) {
    results.push(await runAiSocialContentHappyPath({ setup }));
  }

  if (selected.has("talking-avatar-webhook")) {
    results.push(await runTalkingAvatarHappyPath({ setup }));
  }

  if (selected.has("ai-image-editor")) {
    results.push(await runAiImageEditorHappyPath({ setup }));
  }

  if (selected.has("script-to-video-studio")) {
    results.push(await runScriptToVideoStudioHappyPath({ setup }));
  }

  return results;
};
