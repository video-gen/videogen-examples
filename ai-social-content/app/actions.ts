"use server";

import { VideoGenClient, VideoGenError, pollExecutedTool } from "@videogen/sdk";
import { openai } from "@ai-sdk/openai";
import { generateText, tool } from "ai";
import { z } from "zod";

const VIDEOGEN_API_BASE =
  process.env.VIDEOGEN_API_URL ?? "http://localhost:4010";

const vg = new VideoGenClient({
  token: process.env.VIDEOGEN_API_KEY!,
  baseUrl: VIDEOGEN_API_BASE,
});

/**
 * Some published SDK versions still call removed paths (e.g. `prompt-to-image`).
 * The Developer API uses `POST /v1/tools/generate-image` and `.../generate-video-clip` per OpenAPI.
 */
const startToolExecution = async ({
  path,
  body,
}: {
  path: "/v1/tools/generate-image" | "/v1/tools/generate-video-clip";
  body: Record<string, unknown>;
}): Promise<{ toolExecutionId: string }> => {
  const token = process.env.VIDEOGEN_API_KEY;

  if (token == null || token.length === 0) {
    throw new VideoGenError({ message: "VIDEOGEN_API_KEY is not set." });
  }

  const res = await fetch(`${VIDEOGEN_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const responseText = await res.text();
  let responseJson: unknown;

  try {
    responseJson = JSON.parse(responseText) as unknown;
  } catch {
    throw new VideoGenError({
      message: `VideoGen API ${path} returned non-JSON.`,
      statusCode: res.status,
      body: responseText,
    });
  }

  if (!res.ok) {
    throw new VideoGenError({
      message: `VideoGen API ${path} failed.`,
      statusCode: res.status,
      body: responseJson,
    });
  }

  if (
    typeof responseJson !== "object" ||
    responseJson === null ||
    !("toolExecutionId" in responseJson) ||
    typeof (responseJson as { toolExecutionId: unknown }).toolExecutionId !==
      "string"
  ) {
    throw new VideoGenError({
      message: "VideoGen API returned an unexpected start-tool response shape.",
      statusCode: res.status,
      body: responseJson,
    });
  }

  return {
    toolExecutionId: (responseJson as { toolExecutionId: string }).toolExecutionId,
  };
};

export type GenerationResult = {
  type: "image" | "video" | "audio";
  url: string;
  publicPlaybackId?: string;
  description: string;
};

export type GenerateResponse = {
  results: GenerationResult[];
  summary: string;
};

export async function getVoices() {
  const res = await vg.resources.listTtsVoices();
  return res.ttsVoices
    .filter((v) => v.supportsDirectToolExecution)
    .map((v) => ({
      id: v.voiceId,
      name: v.displayName,
      language: v.languageCode,
    }));
}

export async function generate(
  prompt: string,
  voiceId?: string,
): Promise<GenerateResponse> {
  const results: GenerationResult[] = [];

  const { text } = await generateText({
    model: openai("gpt-4o"),
    tools: {
      generateImage: tool({
        description:
          "Generate an image from a text prompt. Use for social media visuals, thumbnails, or illustrations.",
        parameters: z.object({
          prompt: z
            .string()
            .describe("Detailed visual description of the image to generate"),
        }),
        execute: async ({ prompt: imagePrompt }) => {
          const { toolExecutionId } = await vg.tools.generateImage({
            prompt: imagePrompt,
          });
          const execution = await pollExecutedTool(vg, toolExecutionId);
          if (execution.status === "succeeded" && execution.results?.[0]) {
            const fileId = execution.results[0].fileId;
            const hydrated = await vg.files.hydrateFile({ fileId });
            const url = hydrated.downloadSource?.url;
            if (url) {
              results.push({
                type: "image",
                url,
                description: imagePrompt,
              });
            }
            return { status: "succeeded", fileId };
          }
          return { status: execution.status };
        },
      }),

      generateVideoClip: tool({
        description:
          "Generate a short video clip from a text prompt. Use for social media video content.",
        parameters: z.object({
          prompt: z
            .string()
            .describe("Description of the video clip to generate"),
        }),
        execute: async ({ prompt: videoPrompt }) => {
          const { toolExecutionId } = await vg.tools.generateVideoClip({
            prompt: videoPrompt,
          });
          const execution = await pollExecutedTool(vg, toolExecutionId);
          if (execution.status === "succeeded" && execution.results?.[0]) {
            const fileId = execution.results[0].fileId;
            await vg.files.enablePublicPreview({ fileId });
            const hydrated = await vg.files.hydrateFile({ fileId });
            const publicPlaybackId = hydrated.publicPlaybackId;
            const url = hydrated.downloadSource?.url ?? "";
            results.push({
              type: "video",
              url,
              publicPlaybackId: publicPlaybackId ?? undefined,
              description: videoPrompt,
            });
            return { status: "succeeded", fileId };
          }
          return { status: execution.status };
        },
      }),

      generateSpeech: tool({
        description:
          "Convert text to speech audio. Use for voiceovers and narration. The narrator voice is the one the user selected in the form (VideoGen API ids look like vg_voic_...); do not invent voice names or provider codes.",
        parameters: z.object({
          text: z.string().describe("The text to convert to speech"),
        }),
        execute: async ({ text }) => {
          const { toolExecutionId } = await vg.tools.textToSpeech({
            ttsText: text,
            voiceId,
          });
          const execution = await pollExecutedTool(vg, toolExecutionId);
          if (execution.status === "succeeded" && execution.results?.[0]) {
            const fileId = execution.results[0].fileId;
            const hydrated = await vg.files.hydrateFile({ fileId });
            const url = hydrated.downloadSource?.url;
            if (url) {
              results.push({
                type: "audio",
                url,
                description: text,
              });
            }
            return { status: "succeeded", fileId };
          }
          return { status: execution.status };
        },
      }),
    },
    maxSteps: 6,
    prompt: `You are a social media content creation assistant. The user wants content about: "${prompt}".

Decide which media assets would best serve this content. You might generate:
- An eye-catching image for the post
- A short video clip for engagement
- A voiceover narration for accessibility or video content

Generate the assets that make the most sense for the topic. Be creative with your prompts to the generation tools — write detailed, visually compelling descriptions.`,
  });

  return {
    results,
    summary: text ?? "Content generated successfully.",
  };
}
