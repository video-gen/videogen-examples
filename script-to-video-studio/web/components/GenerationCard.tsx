"use client";

import { ProgressBar } from "./ProgressBar";
import type { Generation, RemixOptions } from "@/lib/types";

type ProgressState = "pending" | "active" | "done" | "failed";

function generateState(gen: Generation): ProgressState {
  if (gen.status === "failed" && gen.step === "generate") {
    return "failed";
  }
  if (
    gen.status === "generated" ||
    gen.status === "exporting" ||
    gen.status === "ready"
  ) {
    return "done";
  }
  if (gen.generateProgress >= 100) {
    return "done";
  }
  return "active";
}

function exportState(gen: Generation): ProgressState {
  if (gen.status === "failed") {
    return gen.step === "export" ? "failed" : "pending";
  }
  if (gen.status === "ready") {
    return "done";
  }
  if (gen.status === "exporting") {
    return "active";
  }
  return "pending";
}

export function GenerationCard({
  gen,
  onRemix,
}: {
  gen: Generation;
  onRemix: (options: RemixOptions) => void;
}) {
  const genState = generateState(gen);
  const expState = exportState(gen);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 text-sm text-neutral-200">{gen.script}</p>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span>{gen.aspectRatioLabel}</span>
          <span>·</span>
          <span>{gen.qualityLabel}</span>
        </div>
        <button
          type="button"
          onClick={() =>
            onRemix({
              script: gen.script,
              aspectRatioId: gen.aspectRatioId,
              qualityId: gen.quality,
            })
          }
          title="Load these options back into the form"
          className="shrink-0 cursor-pointer font-medium text-neutral-400 hover:text-violet-400"
        >
          Remix
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <ProgressBar
          label="1 · Generate video"
          percent={gen.generateProgress}
          state={genState}
        />
        <ProgressBar
          label="2 · Export MP4"
          percent={gen.exportProgress}
          state={expState}
        />
      </div>

      {gen.status === "failed" && gen.error != null && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {gen.error}
        </p>
      )}

      {gen.status === "ready" && gen.downloadUrl != null && (
        <div className="mt-4 space-y-2">
          <video
            controls
            playsInline
            poster={gen.thumbnailUrl ?? undefined}
            src={gen.downloadUrl}
            className="w-full rounded-lg border border-neutral-800 bg-black"
          />
          <div className="flex items-center gap-3 text-xs">
            <a
              href={gen.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-violet-400 hover:text-violet-300"
            >
              Download MP4
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
