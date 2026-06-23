import type { Response } from "express";
import type { AuthedRequest } from "./auth.js";
import { errMessage } from "./util.js";
import { vg } from "./videogen.js";

const SYSTEM_PROMPT = `You are a scriptwriter for short, narrated videos.
Turn the user's request into a clear, engaging spoken-word script.
Rules:
- Output ONLY the words to be narrated — plain spoken text.
- No scene directions, camera notes, headings, markdown, bullet points, or labels.
- Keep it tight and natural to read aloud (roughly 90-160 words unless the request clearly needs more).`;

export async function handleGenerateScript(req: AuthedRequest, res: Response): Promise<void> {
  const body = (req.body ?? {}) as { prompt?: unknown; currentScript?: unknown };
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const currentScript = typeof body.currentScript === "string" ? body.currentScript.trim() : "";
  if (prompt.length === 0) {
    res.status(400).json({ error: "A prompt is required." });
    return;
  }

  // With an existing script, treat the prompt as a rewrite instruction; otherwise
  // write a fresh script from the prompt.
  const llmPrompt =
    currentScript.length > 0
      ? `Current script:\n\n${currentScript}\n\nRewrite it following this instruction:\n\n${prompt}`
      : `Write a script about:\n\n${prompt}`;

  try {
    const { text } = await vg.text.generateText({
      prompt: llmPrompt,
      system: SYSTEM_PROMPT,
    });
    res.json({ script: text.trim() });
  } catch (err) {
    res.status(502).json({ error: "Failed to generate script.", detail: errMessage(err) });
  }
}
