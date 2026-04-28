"use client";

import { useState, useEffect } from "react";
import { generate, getVoices, type GenerateResponse } from "./actions";
import { GenerateForm } from "@/components/GenerateForm";
import { ResultsGallery } from "@/components/ResultsGallery";

type Voice = { id: string; name: string; language: string };

export default function Home() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [response, setResponse] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getVoices().then((v) => {
      setVoices(v);
      if (v.length > 0) setSelectedVoice(v[0].id);
    });
  }, []);

  async function handleGenerate(prompt: string) {
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const res = await generate(prompt, selectedVoice || undefined);
      setResponse(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-12 text-center">
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-white">
          AI Social Content Generator
        </h1>
        <p className="text-lg text-gray-400">
          Describe a topic and let AI generate images, videos, and voiceovers
          for your social media content.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Powered by{" "}
          <a
            href="https://videogen.docs.buildwithfern.com"
            className="text-blue-400 hover:text-blue-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            VideoGen API
          </a>{" "}
          +{" "}
          <a
            href="https://sdk.vercel.ai"
            className="text-blue-400 hover:text-blue-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            Vercel AI SDK
          </a>
        </p>
      </header>

      <GenerateForm
        voices={voices}
        selectedVoice={selectedVoice}
        onVoiceChange={setSelectedVoice}
        onGenerate={handleGenerate}
        loading={loading}
      />

      {error && (
        <div className="mt-6 rounded-lg border border-red-800 bg-red-950/50 p-4 text-red-300">
          {error}
        </div>
      )}

      {response && <ResultsGallery response={response} />}
    </main>
  );
}
