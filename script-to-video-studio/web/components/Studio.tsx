"use client";

import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import type { RemixOptions } from "@/lib/types";
import { GenerateForm } from "./GenerateForm";
import { GenerationsPanel } from "./GenerationsPanel";
import { SignInCard } from "./SignInCard";

export function Studio() {
  const { user, loading } = useAuthUser();
  const [remix, setRemix] = useState<RemixOptions | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  if (user == null) {
    return <SignInCard />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="sticky top-0 flex h-screen w-80 shrink-0 flex-col border-r border-neutral-800 bg-neutral-900/40">
        <div className="border-b border-neutral-800 px-5 py-4">
          <h1 className="text-base font-semibold">Script to Video Studio</h1>
          <p className="mt-0.5 text-xs text-neutral-400">
            Powered by the{" "}
            <a
              href="https://docs.videogen.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 underline transition hover:text-neutral-200"
            >
              VideoGen API
            </a>
          </p>
        </div>

        <GenerationsPanel uid={user.uid} onRemix={setRemix} />

        <div className="flex items-center justify-between gap-2 border-t border-neutral-800 px-5 py-3 text-sm">
          <span className="truncate text-neutral-400">{user.email}</span>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="shrink-0 cursor-pointer rounded-lg border border-neutral-700 px-3 py-1.5 text-neutral-300 transition hover:bg-neutral-800"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-6 py-10">
          <GenerateForm remix={remix} />
        </div>
      </main>
    </div>
  );
}
