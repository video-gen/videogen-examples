"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { refreshGeneration } from "@/lib/api";
import type { Generation, RemixOptions } from "@/lib/types";
import { GenerationCard } from "./GenerationCard";

function toGeneration(id: string, data: Record<string, unknown>): Generation {
  const aspectRatio =
    typeof data.aspectRatio === "object" && data.aspectRatio != null
      ? (data.aspectRatio as { width: number; height: number })
      : { width: 16, height: 9 };

  return {
    id,
    uid: String(data.uid ?? ""),
    script: String(data.script ?? ""),
    aspectRatio,
    aspectRatioId: String(data.aspectRatioId ?? "landscape"),
    aspectRatioLabel: String(data.aspectRatioLabel ?? ""),
    quality: String(data.quality ?? ""),
    qualityLabel: String(data.qualityLabel ?? ""),
    status: (data.status as Generation["status"]) ?? "generating",
    step: (data.step as Generation["step"]) ?? "generate",
    generateProgress: Number(data.generateProgress ?? 0),
    exportProgress: Number(data.exportProgress ?? 0),
    workflowRunId:
      typeof data.workflowRunId === "string" ? data.workflowRunId : null,
    projectId: typeof data.projectId === "string" ? data.projectId : null,
    projectUrl: typeof data.projectUrl === "string" ? data.projectUrl : null,
    exportId: typeof data.exportId === "string" ? data.exportId : null,
    downloadUrl: typeof data.downloadUrl === "string" ? data.downloadUrl : null,
    thumbnailUrl:
      typeof data.thumbnailUrl === "string" ? data.thumbnailUrl : null,
    error: typeof data.error === "string" ? data.error : null,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
  };
}

export function GenerationsPanel({
  uid,
  onRemix,
}: {
  uid: string;
  onRemix: (options: RemixOptions) => void;
}) {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const rehydratedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const q = query(
      collection(db, "generations"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc"),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        setGenerations(
          snapshot.docs.map((doc) => toGeneration(doc.id, doc.data())),
        );
        setLoading(false);
      },
      (err) => {
        console.error("Failed to subscribe to generations:", err);
        setLoading(false);
      },
    );
  }, [uid]);

  // On load (and as generations finish), re-hydrate the signed download URLs
  // for completed generations, since signed URLs expire between sessions.
  useEffect(() => {
    for (const gen of generations) {
      if (gen.status !== "ready") {
        continue;
      }
      if (rehydratedIdsRef.current.has(gen.id)) {
        continue;
      }
      rehydratedIdsRef.current.add(gen.id);
      void refreshGeneration(gen.id);
    }
  }, [generations]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-5 pb-2 pt-4">
        <h2 className="text-sm font-semibold">Your generations</h2>
        <p className="mt-0.5 text-xs text-neutral-400">
          Generate several at once with live updates. Your generations will
          continue even if you leave the page.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-4 pt-1">
        {loading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : generations.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No generations yet. Write a script and hit Generate.
          </p>
        ) : (
          generations.map((gen) => (
            <GenerationCard key={gen.id} gen={gen} onRemix={onRemix} />
          ))
        )}
      </div>
    </div>
  );
}
