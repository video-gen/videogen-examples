# Talking Avatar Webhook Server

A production-style webhook server that receives text, generates speech, creates a talking avatar video, and delivers the result via webhook — no polling required for the long-running avatar step.

https://github.com/user-attachments/assets/PLACEHOLDER-VIDEO-DEMO

## How it works

```
POST /generate-avatar { text: "Hello world" }
        │
        ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│  Text-to-Speech │ ──► │  Audio file ready │ ──► │  Audio-to-Avatar     │
│  (polling, ~5s) │     │                  │     │  (webhook, ~60s)     │
└─────────────────┘     └──────────────────┘     └──────────┬───────────┘
                                                            │
                                                            ▼
                                                 ┌──────────────────────┐
                                                 │  Webhook received    │
                                                 │  → job updated       │
                                                 │  → callback fired    │
                                                 └──────────────────────┘
```

1. `POST /generate-avatar` starts the pipeline — TTS runs first (polled, since it's fast)
2. The TTS audio output is fed into avatar generation (long-running)
3. A VideoGen webhook delivers the completed avatar video to `POST /webhooks/videogen`
4. The server verifies the webhook signature and updates the job status
5. Optionally forwards the result to your own callback URL

## Stack

- [FastAPI](https://fastapi.tiangolo.com) — Python web framework
- [VideoGen Python SDK](https://docs.videogen.io/libraries/python) — media generation + webhook verification
- [Pydantic](https://docs.pydantic.dev) — data validation
- [Docker](https://www.docker.com) — containerized deployment

## VideoGen endpoints used

- `POST /v1/tools/text-to-speech` — Generate speech from text
- `POST /v1/tools/audio-to-avatar-clip` — Create avatar video from audio
- `GET /v1/resources/tts-voices` — List available voices
- `GET /v1/resources/avatar-presenters` — List available presenters
- Webhook signature verification via `verify_webhook_signature`

## Setup

### Prerequisites

- Python 3.11+
- A [VideoGen API key](https://app.videogen.io/developers)
- [ngrok](https://ngrok.com) for local webhook testing (or deploy to a public URL)

### Install and run

```bash
cd talking-avatar-webhook
cp .env.example .env
# Edit .env with your API key

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

uvicorn main:app --reload
```

The server runs at [http://localhost:8000](http://localhost:8000). Interactive docs at [http://localhost:8000/docs](http://localhost:8000/docs).

### Setting up webhooks

#### 1. Expose your local server with ngrok

```bash
ngrok http 8000
```

Copy the forwarding URL (e.g. `https://abc123.ngrok.app`).

#### 2. Register a webhook endpoint

```bash
curl -X POST https://api.videogen.io/v1/webhooks/endpoints \
  -H "Authorization: Bearer $VIDEOGEN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://abc123.ngrok.app/webhooks/videogen",
    "events": ["tool_execution.succeeded", "tool_execution.failed", "tool_execution.cancelled"]
  }'
```

#### 3. Save the signing secret

Copy the `signingSecret` from the response and add it to your `.env`:

```
VIDEOGEN_WEBHOOK_SECRET=whsec_...
PUBLIC_URL=https://abc123.ngrok.app
```

Restart the server.

### Environment variables

| Variable                  | Description                                         |
| ------------------------- | --------------------------------------------------- |
| `VIDEOGEN_API_KEY`        | Your VideoGen API key                               |
| `VIDEOGEN_WEBHOOK_SECRET` | Webhook signing secret (from endpoint registration) |
| `PUBLIC_URL`              | Your server's public URL (for webhook delivery)     |

## API

### `POST /generate-avatar`

Start a talking avatar generation.

```json
{
  "text": "Hello! Welcome to our product demo.",
  "voice_id": "optional_voice_id",
  "presenter_id": "optional_presenter_id",
  "callback_url": "https://your-app.com/webhook"
}
```

### `GET /jobs/{job_id}`

Check job status. Returns `generating_speech`, `generating_avatar`, `succeeded`, `failed`, or `cancelled`.

### `GET /voices`

List available TTS voices.

### `GET /presenters`

List available avatar presenters.

### `POST /webhooks/videogen`

Internal — receives VideoGen webhook events.

## Deploy

### Docker

```bash
docker compose up -d
```

### Railway / Render

1. Connect your GitHub repo
2. Set the root directory to `talking-avatar-webhook`
3. Set environment variables in the dashboard
4. Deploy — the `Dockerfile` is auto-detected

## Learn more

- [VideoGen API Docs](https://docs.videogen.io)
- [Handling Responses: Polling & Webhooks](https://docs.videogen.io/handling-responses-polling-and-webhooks)
- [Standard Webhooks Spec](https://www.standardwebhooks.com/)
