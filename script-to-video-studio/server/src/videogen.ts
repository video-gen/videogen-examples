import { VideoGenClient } from "@videogen/sdk";
import { env } from "./env.js";

export const vg = new VideoGenClient({
  token: env.videogenApiKey,
  ...(env.videogenApiUrl != null ? { baseUrl: env.videogenApiUrl } : {}),
});
