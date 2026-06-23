"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createGeneration, generateScript } from "@/lib/api";
import { ASPECT_RATIO_PRESETS, QUALITY_PRESETS } from "@/lib/presets";
import type { RemixOptions } from "@/lib/types";

function SelectChevron() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-500"
    >
      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`animate-spin ${className ?? ""}`}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function GenerateForm({ remix }: { remix: RemixOptions | null }) {
  const [script, setScript] = useState("");
  const [aspectRatioId, setAspectRatioId] = useState<string>(ASPECT_RATIO_PRESETS[0].id);
  const [qualityId, setQualityId] = useState<string>("HIGH");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The AI prompt is its own thing — a separate one-line box, not the script box.
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [scriptBusy, setScriptBusy] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

  const hasScript = script.trim().length > 0;

  // Remix: load a previous generation's options back into this draft.
  useEffect(() => {
    if (remix == null) {
      return;
    }
    setScript(remix.script);
    setAspectRatioId(remix.aspectRatioId);
    setQualityId(remix.qualityId);
    setError(null);
    setScriptError(null);
    setAiOpen(false);
  }, [remix]);

  useEffect(() => {
    if (aiOpen) {
      aiInputRef.current?.focus();
    }
  }, [aiOpen]);

  async function runAiPrompt() {
    const instruction = aiPrompt.trim();
    if (instruction.length === 0) {
      setScriptError("Describe what the script should be about.");
      return;
    }
    setScriptError(null);
    setScriptBusy(true);
    try {
      const { script: nextScript } = await generateScript({
        prompt: instruction,
        currentScript: hasScript ? script : undefined,
      });
      setScript(nextScript);
      setAiOpen(false);
    } catch (err) {
      setScriptError(err instanceof Error ? err.message : "Failed to write the script.");
    } finally {
      setScriptBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createGeneration({ script: script.trim(), aspectRatioId, qualityId });
      setScript("");
      setAiPrompt("");
      setAiOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start generation.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = script.trim().length > 0 && !busy && !scriptBusy;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col"
    >
      <h2 className="text-lg font-semibold">New video</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Write or paste your script. We&apos;ll generate the video, then export an MP4.
      </p>

      <div className="mt-5 flex flex-1 flex-col gap-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="script">
            Script
          </label>
          <div className="relative">
            <textarea
              id="script"
              value={script}
              disabled={scriptBusy}
              onChange={(event) => setScript(event.target.value)}
              rows={9}
              placeholder="Write your script here, or use “Write with AI” to draft one from a prompt."
              className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 pb-12 text-sm leading-relaxed outline-none focus:border-violet-500 disabled:opacity-60"
            />

            {/* Corner trigger — opens a SEPARATE prompt box, never reusing the script box. */}
            {!aiOpen && !scriptBusy && (
              <button
                type="button"
                onClick={() => setAiOpen(true)}
                className="absolute bottom-2.5 right-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900/90 px-2.5 py-1 text-xs font-medium text-neutral-200 shadow-sm backdrop-blur transition hover:bg-neutral-800"
              >
                {hasScript ? <>↻ Rewrite with AI</> : <>✦ Write with AI</>}
              </button>
            )}

            {/* Separate one-line AI prompt bar + submit button. */}
            {aiOpen && (
              <div className="absolute inset-x-2.5 bottom-2.5 flex items-center gap-2 rounded-lg border border-violet-500/60 bg-neutral-900/95 p-1.5 shadow-lg backdrop-blur">
                <input
                  ref={aiInputRef}
                  type="text"
                  value={aiPrompt}
                  disabled={scriptBusy}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void runAiPrompt();
                    } else if (event.key === "Escape") {
                      setAiOpen(false);
                    }
                  }}
                  placeholder={
                    hasScript
                      ? "How should I rewrite it? (e.g. make it punchier)"
                      : "What should the script be about?"
                  }
                  className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-sm outline-none placeholder:text-neutral-500"
                />
                <button
                  type="button"
                  onClick={() => void runAiPrompt()}
                  disabled={scriptBusy || aiPrompt.trim().length === 0}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {scriptBusy ? (
                    <>
                      <Spinner className="h-3.5 w-3.5" />
                      Writing…
                    </>
                  ) : hasScript ? (
                    <>Rewrite</>
                  ) : (
                    <>Write</>
                  )}
                </button>
                {!scriptBusy && (
                  <button
                    type="button"
                    onClick={() => setAiOpen(false)}
                    aria-label="Close"
                    className="shrink-0 cursor-pointer rounded-md px-1.5 py-1 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Lock the script box while AI is writing. */}
            {scriptBusy && (
              <div className="pointer-events-none absolute inset-0 bottom-14 flex items-center justify-center rounded-lg bg-neutral-950/60 backdrop-blur-[1px]">
                <div className="flex items-center gap-2 text-sm text-neutral-200">
                  <Spinner className="h-4 w-4 text-violet-400" />
                  Writing your script…
                </div>
              </div>
            )}
          </div>
          {scriptError != null && <p className="mt-1.5 text-xs text-red-400">{scriptError}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="aspect">
              Aspect ratio
            </label>
            <div className="relative">
              <select
                id="aspect"
                value={aspectRatioId}
                onChange={(event) => setAspectRatioId(event.target.value)}
                className="w-full cursor-pointer appearance-none rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 pr-9 text-sm outline-none focus:border-violet-500"
              >
                {ASPECT_RATIO_PRESETS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="quality">
              Export quality
            </label>
            <div className="relative">
              <select
                id="quality"
                value={qualityId}
                onChange={(event) => setQualityId(event.target.value)}
                className="w-full cursor-pointer appearance-none rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 pr-9 text-sm outline-none focus:border-violet-500"
              >
                {QUALITY_PRESETS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>
        </div>
      </div>

      {error != null && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-5 w-full cursor-pointer rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Starting…" : "Generate video"}
      </button>
    </form>
  );
}
