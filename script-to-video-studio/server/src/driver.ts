import { FieldValue } from "firebase-admin/firestore";
import { db, generationsCollection } from "./firebaseAdmin.js";
import { vg } from "./videogen.js";
import { resolveQuality } from "./presets.js";
import { errMessage, sleep } from "./util.js";

const GENERATE_POLL_MS = 2_500;
const EXPORT_POLL_MS = 3_000;

async function patch(id: string, data: Record<string, unknown>): Promise<void> {
  await generationsCollection.doc(id).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Kicks off the full pipeline for a generation that already has a workflow run.
 * Safe to fire-and-forget: this is a long-lived Node process, not serverless.
 */
export function startGenerationDriver(id: string): void {
  void driveGenerate(id).catch(async (err) => {
    console.error(`[driver] generate failed for ${id}:`, err);
    await patch(id, { status: "failed", error: errMessage(err) }).catch(() => undefined);
  });
}

async function driveGenerate(id: string): Promise<void> {
  const snapshot = await generationsCollection.doc(id).get();
  const data = snapshot.data();
  const workflowRunId = typeof data?.workflowRunId === "string" ? data.workflowRunId : null;
  if (workflowRunId == null) {
    return;
  }

  // Poll the workflow run for its progress percentage until it reaches a
  // terminal state. (Webhooks tell us about completion, but only polling gives
  // us a live progress bar.)
  for (;;) {
    const run = await vg.workflows.getWorkflowRun({ workflowRunId });
    const progress =
      typeof run.progressPercentage === "number"
        ? Math.max(0, Math.min(100, Math.round(run.progressPercentage)))
        : 0;

    if (run.status === "pending" || run.status === "running") {
      await patch(id, { status: "generating", step: "generate", generateProgress: progress });
      await sleep(GENERATE_POLL_MS);
      continue;
    }

    if (run.status === "succeeded") {
      await patch(id, {
        status: "generated",
        step: "generate",
        generateProgress: 100,
        projectId: run.projectId,
        projectUrl: run.projectUrl,
      });
      await maybeStartExport(id);
      return;
    }

    // failed | cancelled
    await patch(id, {
      status: "failed",
      error: run.error?.message ?? `Workflow ${run.status}.`,
    });
    return;
  }
}

/**
 * Atomically claims the export step so the polling loop and the webhook can't
 * both trigger an export. Whoever wins the claim starts the export.
 */
export async function maybeStartExport(id: string): Promise<void> {
  const claim = await db.runTransaction(async (tx) => {
    const ref = generationsCollection.doc(id);
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    if (data == null) {
      return null;
    }
    if (data.exportClaimed === true) {
      return null;
    }
    const projectId = typeof data.projectId === "string" ? data.projectId : null;
    if (projectId == null) {
      return null;
    }

    tx.update(ref, {
      exportClaimed: true,
      status: "exporting",
      step: "export",
      generateProgress: 100,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      projectId,
      quality: resolveQuality(typeof data.quality === "string" ? data.quality : "HIGH"),
    };
  });

  if (claim == null) {
    return;
  }

  void driveExport(id, claim.projectId, claim.quality).catch(async (err) => {
    console.error(`[driver] export failed for ${id}:`, err);
    await patch(id, { status: "failed", error: errMessage(err) }).catch(() => undefined);
  });
}

/**
 * Re-fetches a finished export to refresh its signed download/thumbnail URLs.
 * Signed URLs expire, so the UI calls this on page load to re-hydrate the
 * stored outputs.
 */
export async function refreshExportUrls(id: string): Promise<void> {
  const snapshot = await generationsCollection.doc(id).get();
  const data = snapshot.data();
  const projectId = typeof data?.projectId === "string" ? data.projectId : null;
  const exportId = typeof data?.exportId === "string" ? data.exportId : null;

  if (projectId == null || exportId == null) {
    return;
  }

  const projectExport = await vg.projects.getProjectExport({ projectId, exportId });

  if (projectExport.status === "succeeded" && projectExport.downloadUrl != null) {
    await patch(id, {
      status: "ready",
      step: "done",
      exportProgress: 100,
      downloadUrl: projectExport.downloadUrl,
      thumbnailUrl: projectExport.thumbnailUrl ?? null,
    });
  }
}

async function driveExport(
  id: string,
  projectId: string,
  quality: ReturnType<typeof resolveQuality>,
): Promise<void> {
  const { exportId } = await vg.projects.exportProject({ projectId, quality });
  await patch(id, { exportId, exportProgress: 0 });

  // Poll the export for its real progress percentage until it reaches a
  // terminal state.
  for (;;) {
    const projectExport = await vg.projects.getProjectExport({ projectId, exportId });

    if (projectExport.status === "succeeded") {
      await patch(id, {
        status: "ready",
        step: "done",
        exportProgress: 100,
        downloadUrl: projectExport.downloadUrl ?? null,
        thumbnailUrl: projectExport.thumbnailUrl ?? null,
      });
      return;
    }

    if (projectExport.status === "failed") {
      await patch(id, {
        status: "failed",
        error: projectExport.error?.message ?? "Export failed.",
      });
      return;
    }

    const progress = readExportProgress(projectExport);
    if (progress != null) {
      await patch(id, { exportProgress: progress });
    }
    await sleep(EXPORT_POLL_MS);
  }
}

function readExportProgress(
  projectExport: Awaited<ReturnType<typeof vg.projects.getProjectExport>>,
): number | null {
  if (
    "progressPercentage" in projectExport &&
    typeof projectExport.progressPercentage === "number"
  ) {
    return Math.max(0, Math.min(100, Math.round(projectExport.progressPercentage)));
  }
  return null;
}
