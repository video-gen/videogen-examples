# AI Image Editor

A conversational AI agent that can generate, transform, upscale, remove backgrounds from, and vectorize images through natural language. Uses the OpenAI Agents SDK for multi-turn conversation and the VideoGen API for image operations.

https://github.com/user-attachments/assets/PLACEHOLDER-VIDEO-DEMO

## How it works

1. You chat with the agent in natural language
2. The agent decides which image operations to perform based on your request
3. It remembers context from the conversation — chain operations on the same image
4. Upload your own images to transform, vectorize, or upscale them

**Example conversation:**

```
You: Generate a logo for a coffee shop called Sunrise Beans
Agent: [generates image, shows URL]

You: Remove the background
Agent: [removes background from the logo, shows transparent PNG URL]

You: Now vectorize it
Agent: [converts to SVG, shows download URL]

You: Upscale the original version
Agent: [upscales the first logo, shows high-res URL]
```

## Stack

- [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) — agentic orchestration
- [VideoGen Python SDK](https://docs.videogen.io/libraries/python) — image generation and manipulation
- [Gradio](https://www.gradio.app) — chat interface with image upload

## VideoGen endpoints used

- `POST /v1/tools/prompt-to-image` — Generate images from text
- `POST /v1/tools/image-to-image` — Transform images with a prompt
- `POST /v1/tools/vectorize-image` — Convert to SVG
- `POST /v1/tools/remove-image-background` — Remove backgrounds
- `POST /v1/tools/upscale-image` — Upscale to higher resolution
- `POST /v1/files/upload` — Upload user images
- `POST /v1/files/search` — Find previously generated images
- `POST /v1/files/{id}/hydrate` — Get download URLs

## Setup

### Prerequisites

- Python 3.11+
- A [VideoGen API key](https://app.videogen.io/developers)
- An [OpenAI API key](https://platform.openai.com/api-keys)

### Install and run

```bash
cd ai-image-editor
cp .env.example .env
# Edit .env with your API keys

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python main.py
```

Open [http://localhost:7860](http://localhost:7860).

### Environment variables

| Variable           | Description                                                                |
| ------------------ | -------------------------------------------------------------------------- |
| `VIDEOGEN_API_KEY` | Your VideoGen API key ([get one here](https://app.videogen.io/developers)) |
| `OPENAI_API_KEY`   | Your OpenAI API key for the Agents SDK                                     |

## Deploy to Hugging Face Spaces

1. Create a new Space at [huggingface.co/new-space](https://huggingface.co/new-space)
2. Select "Gradio" as the SDK
3. Push this directory to the Space repo
4. Add `VIDEOGEN_API_KEY` and `OPENAI_API_KEY` as Space secrets

Or use the HF CLI:

```bash
pip install huggingface_hub
huggingface-cli login
huggingface-cli repo create ai-image-editor --type space --space-sdk gradio
git clone https://huggingface.co/spaces/YOUR_USERNAME/ai-image-editor
cp -r . ../ai-image-editor-space/
cd ../ai-image-editor-space && git add . && git commit -m "Initial" && git push
```

## Learn more

- [VideoGen API Docs](https://docs.videogen.io)
- [OpenAI Agents SDK](https://github.com/openai/openai-agents-python)
- [Use VideoGen with AI Agents](https://docs.videogen.io/use-with-ai-agents)
