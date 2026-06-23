# AI Social Content Generator

An AI-powered social media content generator that creates images, videos, and voiceovers from a single topic prompt. VideoGen's text endpoint decides which media assets to create based on your description — no other AI provider key required.

https://github.com/user-attachments/assets/PLACEHOLDER-VIDEO-DEMO

## How it works

1. You describe a topic or content idea
2. VideoGen's text endpoint (`POST /v1/text/generate`) returns a JSON content plan deciding which media assets to generate and their prompts
3. The app calls VideoGen tools to create images, video clips, and voiceovers from that plan
4. Results are displayed in a gallery with embedded video playback

## Stack

- [Next.js 15](https://nextjs.org) — React framework
- [VideoGen TypeScript SDK](https://docs.videogen.io/libraries/typescript) — text + media generation
- [@videogen/player-react](https://www.npmjs.com/package/@videogen/player-react) — video embedding
- [Tailwind CSS](https://tailwindcss.com) — styling

## VideoGen endpoints used

- `POST /v1/text/generate` — Plan which assets to create (text generation)
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

### Install and run

```bash
cd ai-social-content
cp .env.example .env.local
# Edit .env.local with your API key

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable           | Description                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `VIDEOGEN_API_KEY` | Your VideoGen API key ([get one here](https://app.videogen.io/developers))                                                 |
| `VIDEOGEN_API_URL` | Optional. Defaults to `https://api.videogen.io`. Set to `http://localhost:4010` only if you run the Developer API locally. |

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvideo-gen%2Fvideogen-examples%2Ftree%2Fmain%2Fai-social-content&env=VIDEOGEN_API_KEY&envDescription=API%20key%20for%20VideoGen&envLink=https%3A%2F%2Fapp.videogen.io%2Fdevelopers)

## Learn more

- [VideoGen API Docs](https://docs.videogen.io)
- [Use VideoGen with AI Agents](https://docs.videogen.io/use-with-ai-agents)
