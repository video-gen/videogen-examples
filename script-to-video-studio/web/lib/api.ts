import { auth } from "./firebase";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100";

export type CreateGenerationInput = {
  script: string;
  aspectRatioId: string;
  qualityId: string;
};

export async function createGeneration(input: CreateGenerationInput): Promise<{ id: string }> {
  const user = auth.currentUser;
  if (user == null) {
    throw new Error("You must be signed in.");
  }

  const token = await user.getIdToken();
  const res = await fetch(`${API_BASE_URL}/api/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const data: { error?: string; detail?: string } = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? data.error ?? "Failed to start generation.");
  }

  return res.json();
}

export async function refreshGeneration(id: string): Promise<void> {
  const user = auth.currentUser;
  if (user == null) {
    return;
  }

  const token = await user.getIdToken();
  await fetch(`${API_BASE_URL}/api/generations/${id}/refresh`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => undefined);
}

export async function generateScript(input: {
  prompt: string;
  currentScript?: string;
}): Promise<{ script: string }> {
  const user = auth.currentUser;
  if (user == null) {
    throw new Error("You must be signed in.");
  }

  const token = await user.getIdToken();
  const res = await fetch(`${API_BASE_URL}/api/script`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const data: { error?: string; detail?: string } = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? data.error ?? "Failed to generate script.");
  }

  return res.json();
}
