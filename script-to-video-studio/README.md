# Script to Video Studio

A small, self-hostable wrapper around the [VideoGen API](https://docs.videogen.io) that turns a script into a finished MP4 — with **sign-in, a database, webhooks, and realtime progress** so you can fire off several videos at once, close the tab, and come back later.

It's deliberately built like a scrappy indie project: a **Next.js** frontend, a **Node/Express** backend, and **Firebase** (Auth + Firestore) running entirely on the **local emulators** — no real Firebase project required.

```
┌──────────────┐    create     ┌──────────────┐   workflow + export   ┌────────────┐
│  Next.js UI  │ ───────────►  │ Node backend │ ───────────────────►  │  VideoGen  │
│  (Firebase   │   ID token    │  (API key)   │ ◄─── webhook + poll ─  │    API     │
│   Auth)      │               │              │                       └────────────┘
└──────┬───────┘               └──────┬───────┘
       │   realtime onSnapshot        │ writes progress
       └──────────────◄───────────────┤
                  Firestore (emulator)
```

## How it works

1. You sign in (Firebase Auth emulator — any email/password works locally).
2. (Optional) You type an idea and hit **Generate script** — VideoGen's text generation endpoint (`POST /v1/text/generate`) drafts a narration you can edit or **re-generate**. No extra LLM key required.
3. You submit the script + a couple of presets. The frontend calls the backend with your Firebase ID token.
4. The backend (holding **one** VideoGen API key) starts a **script-to-video workflow**, writes a `generations/{id}` doc to Firestore, and kicks off a driver.
5. **Step 1 — Generate:** the backend polls the workflow run for `progressPercentage` and streams it into Firestore. A `workflow_run.succeeded` **webhook** (if configured) advances it instantly; polling is the always-on fallback.
6. **Step 2 — Export:** on completion the backend exports the project to an MP4, polls until it's ready, and writes the download URL.
7. The frontend subscribes to your generations with Firestore **realtime** (`onSnapshot`), so both progress bars update live and survive reloads.

Once a generation starts, it can't be edited — the only editable surface is the draft form. To branch off a finished (or running) generation, hit **Remix** on its card: it loads that generation's options (script + presets) back into the form so you can tweak and generate again.

## What's wrapped

The public script-to-video API is intentionally small, so the form wraps exactly what you can drive today:

| Option        | Where         | Presets                                            |
| ------------- | ------------- | -------------------------------------------------- |
| Script/topic  | workflow      | free text                                          |
| Aspect ratio  | workflow      | 16:9, 9:16, 1:1                                    |
| Export quality| export        | Standard, High, Full HD, Ultra (4K)                |

> Voice, visual style, captions, and music use the API's server-side defaults — they aren't exposed on the public workflow endpoint yet.

## VideoGen endpoints used

- `POST /v1/workflows/script-to-video` — start generation
- `GET /v1/workflows/runs/{id}` — poll progress
- `POST /v1/projects/{id}/export` + `GET /v1/projects/{id}/exports/{exportId}` — export + poll
- `POST /v1/webhooks/endpoints` + `verifyWebhookSignature` — optional webhook fast-path

## Prerequisites

- Node.js 20+
- **Java 11+** (the Firestore emulator needs a JRE)
- A [VideoGen API key](https://app.videogen.io/developers)

## Setup

```bash
cd examples/script-to-video-studio

# Install root tooling (firebase emulators + concurrently) and both apps
npm run install:all

# Backend env
cp server/.env.example server/.env
#   → set VIDEOGEN_API_KEY

# Frontend env
cp web/.env.local.example web/.env.local
```

## Run

One command starts the emulators, the backend, and the frontend together:

```bash
npm run dev
```

Then open **http://localhost:3000**. (Emulator UI: http://localhost:4001.)

Prefer separate terminals?

```bash
npm run emulators      # Firebase Auth + Firestore emulators
npm run dev:server     # Node backend on :4100
npm run dev:web        # Next.js on :3000
```

## Webhooks (optional)

Everything works on polling alone. To also use webhooks:

- **Local API:** if you point `VIDEOGEN_API_URL` at a local VideoGen API, set `WEBHOOK_PUBLIC_URL=http://localhost:4100` in `server/.env`. The server auto-registers an endpoint and prints the signing secret on boot.
- **Hosted API:** expose the backend with a tunnel (e.g. `ngrok http 4100`) and set `WEBHOOK_PUBLIC_URL` to the tunnel URL. Paste the printed secret into `VIDEOGEN_WEBHOOK_SECRET` to reuse it across restarts.

## Environment variables

### `server/.env`

| Variable                  | Required | Description                                            |
| ------------------------- | -------- | ------------------------------------------------------ |
| `VIDEOGEN_API_KEY`        | yes      | Your VideoGen developer API key                        |
| `VIDEOGEN_API_URL`        | no       | Override the API base URL                              |
| `WEBHOOK_PUBLIC_URL`      | no       | Public URL to auto-register a webhook endpoint         |
| `VIDEOGEN_WEBHOOK_SECRET` | no       | Reuse a known signing secret instead of registering    |
| `PORT`                    | no       | Backend port (default 4100)                            |
| `WEB_ORIGIN`              | no       | Allowed CORS origin (default http://localhost:3000)    |
| `FIREBASE_PROJECT_ID`     | no       | Emulator project id (default `demo-script-to-video`)   |

### `web/.env.local`

| Variable                          | Description                                  |
| --------------------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`        | Backend base URL                             |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Must match the backend's project id          |
| `NEXT_PUBLIC_USE_EMULATORS`       | `true` for local emulators                   |

## Notes

- The backend runs as a long-lived process, so per-generation driver loops are simple background promises. In a serverless deployment you'd move these to a queue/cron instead.
- Firestore security rules let the browser **read only its own** generations; all writes go through the backend with the Admin SDK.

## Learn more

- [VideoGen API Docs](https://docs.videogen.io)
- [Handling Responses: Polling & Webhooks](https://docs.videogen.io/handling-responses-polling-and-webhooks)
- [Firebase Local Emulator Suite](https://firebase.google.com/docs/emulator-suite)
