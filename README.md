# VideoGen API Examples

[![Docs](https://img.shields.io/badge/docs-docs.videogen.io-blue)](https://docs.videogen.io)

Full-stack example apps demonstrating the [VideoGen API](https://docs.videogen.io). Each example targets a different SDK, framework, and use case.

## Examples

| Example                                                    | Stack                                     | Use case                                                  |
| ---------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------- |
| [Script to Video Studio](./script-to-video-studio/)        | Next.js, Node/Express, Firebase, TS SDK   | Full app: auth, DB, webhooks, realtime script-to-video    |
| [AI Social Content Generator](./ai-social-content/)        | Next.js 15, TypeScript SDK                | VideoGen text endpoint plans what media to generate       |
| [Talking Avatar Webhook Server](./talking-avatar-webhook/) | FastAPI, Python SDK                       | Production webhook pipeline: text → speech → avatar video |
| [AI Image Editor](./ai-image-editor/)                      | OpenAI Agents SDK, Python SDK, Gradio     | Conversational image generation and transformation        |

## Quick start

### Local development (monorepo checkout)

From the repo root, with the local API stack running (`pnpm dev:api`):

```bash
pnpm setup:local-examples
```

This auto-creates a PRO workspace + developer API key and writes `VIDEOGEN_API_KEY` (and `VIDEOGEN_API_URL=http://localhost:4010`) into every example's env file. It also loads `OPENAI_API_KEY` from Secret Manager (`OpenAI-Examples-ApiKey_LOCAL`) for the AI Image Editor example. No browser visit to `/developers` required. Re-run anytime to rotate the shared key.

Run happy-path E2E on every example (auto-setup, no manual env):

```bash
pnpm examples:e2e
pnpm examples:e2e -- --only ai-image-editor   # subset
```

See `.cursor/skills/examples-e2e/SKILL.md` for prerequisites (local API, GCP auth, Java for Firebase emulators, built TS SDK).

### External checkout

1. Get an API key at [app.videogen.io/developers](https://app.videogen.io/developers)
2. Clone this repository:

```bash
git clone https://github.com/video-gen/videogen-examples.git
cd videogen-examples
```

3. Pick an example and follow its README.

## Documentation

- [VideoGen API Docs](https://docs.videogen.io)
- [Getting Started](https://docs.videogen.io/getting-started)
- [Use with AI Agents](https://docs.videogen.io/use-with-ai-agents)
- [Handling Responses: Polling & Webhooks](https://docs.videogen.io/handling-responses-polling-and-webhooks)

## License

MIT
