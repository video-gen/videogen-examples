"use client";

import type { GenerateResponse } from "@/app/actions";

export function ResultsGallery({ response }: { response: GenerateResponse }) {
  return (
    <div className="mt-10 space-y-6">
      <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
        <h2 className="mb-1 text-sm font-medium text-gray-400">AI Summary</h2>
        <p className="text-gray-200">{response.summary}</p>
      </div>

      {response.results.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2">
          {response.results.map((result, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900"
            >
              <div className="p-3">
                <span className="inline-block rounded bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-300 uppercase">
                  {result.type}
                </span>
              </div>

              <div className="px-3 pb-3">
                {result.type === "image" && (
                  <img
                    src={result.url}
                    alt={result.description}
                    className="w-full rounded"
                  />
                )}

                {result.type === "video" && (
                  <video
                    src={result.url}
                    controls
                    className="w-full rounded"
                  />
                )}

                {result.type === "audio" && (
                  <audio src={result.url} controls className="w-full" />
                )}

                <p className="mt-2 text-sm text-gray-400 line-clamp-2">
                  {result.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
