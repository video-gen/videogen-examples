"use server";

import {
  VideoGen,
  createPublicPreview,
  type ExecutedTool,
} from "@videogen/sdk";
import { z } from "zod";

const EXAMPLE_IMAGE_QUALITY = "STANDARD";
const EXAMPLE_VIDEO_QUALITY = "STANDARD";

const vg = new VideoGen({
  apiKey: process.env.VIDEOGEN_API_KEY!,
  ...(process.env.VIDEOGEN_API_URL != null &&
  process.env.VIDEOGEN_API_URL !== ""
    ? { baseUrl: process.env.VIDEOGEN_API_URL }
    : {}),
});

export type GenerationResult = {
  type: "image" | "video" | "audio";
  url: string;
  description: string;
};

export type GenerateResponse = {
  results: GenerationResult[];
  summary: string;
};

export async function getVoices() {
  const res = await vg.resources.listTtsVoices();

  return res.ttsVoices
    .filter((voice) => voice.supportsDirectToolExecution)
    .map((voice) => ({
      id: voice.voiceId,
      name: voice.displayName,
      language: voice.languageCode,
    }));
}

// VideoGen's text endpoint returns plain text, so we ask the model for a JSON
// content plan and parse it here — no agent framework or OpenAI key required.
const ContentPlanSchema = z.object({
  imagePrompt: z.string().min(1).nullable(),
  videoPrompt: z.string().min(1).nullable(),
  speechText: z.string().min(1).nullable(),
  summary: z.string().min(1),
});

type ContentPlan = z.infer<typeof ContentPlanSchema>;

const PLAN_SYSTEM_PROMPT = `You are a social media content planning assistant. Given a topic, decide which media assets would best serve it and write the generation prompts.

Respond with ONLY a JSON object (no markdown, no code fences) matching exactly:
{
  "imagePrompt": string | null,   // detailed, visually compelling description, or null to skip
  "videoPrompt": string | null,   // short engaging video clip description, or null to skip
  "speechText": string | null,    // narration script to voice aloud, or null to skip
  "summary": string               // 1-2 plain-text sentences describing what you created
}

Rules:
- Include at least one non-null asset.
- The summary must be plain text: no markdown, headings, bullet points, bold/italics, links, URLs, or file IDs.`;

function parseContentPlan(raw: string, fallbackTopic: string): ContentPlan {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const jsonSlice =
    start !== -1 && end !== -1 && end > start ? raw.slice(start, end + 1) : raw;

  try {
    const parsed: unknown = JSON.parse(jsonSlice);
    const result = ContentPlanSchema.safeParse(parsed);
    if (
      result.success &&
      (result.data.imagePrompt != null ||
        result.data.videoPrompt != null ||
        result.data.speechText != null)
    ) {
      return result.data;
    }
  } catch {
    // Fall through to a sensible default if the model didn't return clean JSON.
  }

  return {
    imagePrompt: `An eye-catching social media image about: ${fallbackTopic}`,
    videoPrompt: null,
    speechText: null,
    summary: `Generated a social media image about ${fallbackTopic}.`,
  };
}

async function previewToolResult({
  execution,
  description,
  type,
}: {
  execution: ExecutedTool;
  description: string;
  type: GenerationResult["type"];
}): Promise<GenerationResult | null> {
  const fileId = execution.results[0]?.fileId;
  if (fileId == null) {
    return null;
  }

  const preview = await createPublicPreview({
    client: vg,
    fileId,
    waitForEmbedPlaybackId: false,
  });
  const url = preview.staticPublicPreviewSource?.url;
  if (url == null) {
    return null;
  }

  return {
    type,
    url,
    description,
  };
}

export async function generate(
  prompt: string,
  voiceId?: string,
): Promise<GenerateResponse> {
  const results: GenerationResult[] = [];

  const textResponse = await vg.text.generateText({
    prompt: `Topic: "${prompt}"`,
    system: PLAN_SYSTEM_PROMPT,
    quality: "STANDARD",
    maxOutputTokens: 600,
  });

  const plan = parseContentPlan(textResponse.text, prompt);

  if (plan.imagePrompt != null) {
    const execution = await vg.tools.generateImageAndWait({
      prompt: plan.imagePrompt,
      quality: EXAMPLE_IMAGE_QUALITY,
    });
    const result = await previewToolResult({
      execution,
      description: plan.imagePrompt,
      type: "image",
    });
    if (result != null) {
      results.push(result);
    }
  }

  if (plan.videoPrompt != null) {
    const execution = await vg.tools.generateVideoClipAndWait({
      prompt: plan.videoPrompt,
      quality: EXAMPLE_VIDEO_QUALITY,
      generateAudio: false,
    });
    const result = await previewToolResult({
      execution,
      description: plan.videoPrompt,
      type: "video",
    });
    if (result != null) {
      results.push(result);
    }
  }

  if (plan.speechText != null && voiceId != null) {
    const execution = await vg.tools.textToSpeechAndWait({
      ttsText: plan.speechText,
      voiceId,
    });
    const result = await previewToolResult({
      execution,
      description: plan.speechText,
      type: "audio",
    });
    if (result != null) {
      results.push(result);
    }
  }

  return {
    results,
    summary: plan.summary,
  };
}
