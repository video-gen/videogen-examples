import type { Timestamp } from "firebase/firestore";

export type GenerationStatus =
  | "generating"
  | "generated"
  | "exporting"
  | "ready"
  | "failed";

export type GenerationStep = "generate" | "export" | "done";

export type RemixOptions = {
  script: string;
  aspectRatioId: string;
  qualityId: string;
};

export type Generation = {
  id: string;
  uid: string;
  script: string;
  aspectRatio: { width: number; height: number };
  aspectRatioId: string;
  aspectRatioLabel: string;
  quality: string;
  qualityLabel: string;
  status: GenerationStatus;
  step: GenerationStep;
  generateProgress: number;
  exportProgress: number;
  workflowRunId: string | null;
  projectId: string | null;
  projectUrl: string | null;
  exportId: string | null;
  downloadUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
  createdAt: Timestamp | null;
};
