"use server";

import { VideoGenClient, pollExecutedTool } from "@videogen/sdk";
import { openai } from "@ai-sdk/openai";
import { generateText, tool } from "ai";
import { z } from "zod";

const vg = new VideoGenClient({ token: process.env.VIDEOGEN_API_KEY! });

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
  const voices = await vg.resources.getTtsVoices();
  return voices.voices.map((v) => ({
    id: v.voiceId,
    name: v.displayName,
    language: v.language,
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
          const { toolExecutionId } = await vg.tools.promptToImage({
            prompt: imagePrompt,
          });
          const execution = await pollExecutedTool(vg, toolExecutionId);
          if (execution.status === "succeeded" && execution.results?.[0]) {
            const fileId = execution.results[0].fileId;
            const hydrated = await vg.files.hydrateFile({ fileId });
            const url = hydrated.file.downloadSource?.url;
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
          const { toolExecutionId } = await vg.tools.promptToVideoClip({
            prompt: videoPrompt,
          });
          const execution = await pollExecutedTool(vg, toolExecutionId);
          if (execution.status === "succeeded" && execution.results?.[0]) {
            const fileId = execution.results[0].fileId;
            await vg.files.enablePublicPreview({ fileId });
            const hydrated = await vg.files.hydrateFile({ fileId });
            const publicPlaybackId = hydrated.file.publicPlaybackId;
            const url = hydrated.file.downloadSource?.url ?? "";
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
          "Convert text to speech audio. Use for voiceovers and narration.",
        parameters: z.object({
          text: z.string().describe("The text to convert to speech"),
          voiceId: z
            .string()
            .optional()
            .describe("Voice ID to use for speech synthesis"),
        }),
        execute: async ({ text, voiceId: toolVoiceId }) => {
          const { toolExecutionId } = await vg.tools.textToSpeech({
            text,
            voiceId: toolVoiceId ?? voiceId,
          });
          const execution = await pollExecutedTool(vg, toolExecutionId);
          if (execution.status === "succeeded" && execution.results?.[0]) {
            const fileId = execution.results[0].fileId;
            const hydrated = await vg.files.hydrateFile({ fileId });
            const url = hydrated.file.downloadSource?.url;
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
