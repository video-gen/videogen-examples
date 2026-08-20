import { VideoGen } from "@videogen/sdk";
import { env } from "./env.js";

export const vg = new VideoGen({
  apiKey: env.videogenApiKey,
  ...(env.videogenApiUrl != null ? { baseUrl: env.videogenApiUrl } : {}),
});
