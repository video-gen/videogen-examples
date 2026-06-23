"use client";

import { useState } from "react";

type Voice = { id: string; name: string; language: string };

export function GenerateForm({
  voices,
  selectedVoice,
  onVoiceChange,
  onGenerate,
  loading,
}: {
  voices: Voice[];
  selectedVoice: string;
  onVoiceChange: (voiceId: string) => void;
  onGenerate: (prompt: string) => void;
  loading: boolean;
}) {
  const [prompt, setPrompt] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    onGenerate(prompt.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="prompt"
          className="mb-2 block text-sm font-medium text-gray-300"
        >
          Content description
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. A product launch announcement for a new AI-powered camera that shoots in the dark..."
          rows={3}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-end gap-4">
        <div className="flex-1">
          <label
            htmlFor="voice"
            className="mb-2 block text-sm font-medium text-gray-300"
          >
            Narrator voice
          </label>
          <div className="relative">
            <select
              id="voice"
              value={selectedVoice}
              onChange={(e) => onVoiceChange(e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-700 bg-gray-900 py-2.5 pl-4 pr-10 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.language})
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="cursor-pointer rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Generating...
            </span>
          ) : (
            "Generate"
          )}
        </button>
      </div>
    </form>
  );
}
