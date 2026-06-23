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
