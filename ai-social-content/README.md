# AI Social Content Generator

An AI-powered social media content generator that creates images, videos, and voiceovers from a single topic prompt. The AI agent decides which media assets to create based on your description.

https://github.com/user-attachments/assets/PLACEHOLDER-VIDEO-DEMO

## How it works

1. You describe a topic or content idea
2. An AI agent (GPT-4o via Vercel AI SDK) decides which media assets to generate
3. The agent calls VideoGen tools to create images, video clips, and voiceovers
4. Results are displayed in a gallery with embedded video playback

## Stack

- [Next.js 15](https://nextjs.org) — React framework
- [Vercel AI SDK](https://sdk.vercel.ai) — AI agent orchestration
- [VideoGen TypeScript SDK](https://videogen.docs.buildwithfern.com/libraries/typescript) — media generation
- [@videogen/player-react](https://www.npmjs.com/package/@videogen/player-react) — video embedding
- [Tailwind CSS](https://tailwindcss.com) — styling

## VideoGen endpoints used

- `POST /v1/tools/generate-image` — Generate images from text
- `POST /v1/tools/generate-video-clip` — Generate video clips from text
- `POST /v1/tools/text-to-speech` — Convert text to speech
- `POST /v1/files/{id}/enable-public-preview` — Enable video embedding
- `POST /v1/files/{id}/hydrate` — Get download URLs
- `GET /v1/resources/tts-voices` — List available voices

## Setup

### Prerequisites

- Node.js 18+
- A [VideoGen API key](https://app.videogen.io/developers)
- An [OpenAI API key](https://platform.openai.com/api-keys)

### Install and run

```bash
cd ai-social-content
cp .env.example .env.local
# Edit .env.local with your API keys

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Description |
| --- | --- |
| `VIDEOGEN_API_KEY` | Your VideoGen API key ([get one here](https://app.videogen.io/developers)) |
| `OPENAI_API_KEY` | Your OpenAI API key for GPT-4o |

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvideo-gen%2Fvideogen-examples%2Ftree%2Fmain%2Fai-social-content&env=VIDEOGEN_API_KEY,OPENAI_API_KEY&envDescription=API%20keys%20for%20VideoGen%20and%20OpenAI&envLink=https%3A%2F%2Fapp.videogen.io%2Fdevelopers)

## Learn more

- [VideoGen API Docs](https://videogen.docs.buildwithfern.com)
- [Vercel AI SDK — Tool Calling](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)
- [Use VideoGen with AI Agents](https://videogen.docs.buildwithfern.com/use-with-ai-agents)
