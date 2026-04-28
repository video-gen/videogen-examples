"""
Talking Avatar Webhook Server

A production-style FastAPI server that:
1. Receives text, generates speech (TTS), then creates a talking avatar video
2. Uses webhooks to receive completion notifications (no polling)
3. Verifies webhook signatures for security
"""

import os
import uuid
from contextlib import asynccontextmanager

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from videogen import VideoGenApi, poll_executed_tool, verify_webhook_signature

from models import (
    GenerateAvatarRequest,
    JobStatus,
    PresenterInfo,
    VoiceInfo,
)

load_dotenv()

client = VideoGenApi(token=os.environ["VIDEOGEN_API_KEY"])
WEBHOOK_SECRET = os.environ.get("VIDEOGEN_WEBHOOK_SECRET", "")
PUBLIC_URL = os.environ.get("PUBLIC_URL", "http://localhost:8000")

jobs: dict[str, JobStatus] = {}
job_callbacks: dict[str, str] = {}

# Maps tool_execution_id -> job_id for webhook routing
execution_to_job: dict[str, str] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Register the webhook endpoint on startup if a secret isn't already set."""
    if not WEBHOOK_SECRET:
        print(
            "⚠️  No VIDEOGEN_WEBHOOK_SECRET set. "
            "Register a webhook endpoint at https://app.videogen.io/developers "
            "or via the API, then set the signing secret in .env"
        )
    yield


app = FastAPI(
    title="Talking Avatar Webhook Server",
    description="Generate talking avatar videos from text using VideoGen webhooks.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/voices", response_model=list[VoiceInfo])
def list_voices():
    """List available TTS voices."""
    response = client.resources.get_tts_voices()
    return [
        VoiceInfo(
            voice_id=v.voice_id,
            display_name=v.display_name,
            language=v.language,
        )
        for v in response.voices
    ]


@app.get("/presenters", response_model=list[PresenterInfo])
def list_presenters():
    """List available avatar presenters."""
    response = client.resources.get_avatar_presenters()
    return [
        PresenterInfo(
            presenter_id=p.presenter_id,
            display_name=p.display_name,
        )
        for p in response.presenters
    ]


@app.post("/generate-avatar", response_model=JobStatus)
def generate_avatar(req: GenerateAvatarRequest):
    """
    Start a talking avatar generation pipeline:
    1. Generate speech from text (TTS)
    2. Use the audio to create an avatar video

    The pipeline uses polling for step 1 (TTS is fast), then registers a webhook
    for step 2 (avatar generation takes longer).
    """
    job_id = str(uuid.uuid4())
    job = JobStatus(job_id=job_id, status="generating_speech")
    jobs[job_id] = job

    # Step 1: Text-to-Speech (poll since it's quick ~5-10s)
    tts_response = client.tools.text_to_speech(
        text=req.text,
        voice_id=req.voice_id,
    )
    job.tts_execution_id = tts_response.tool_execution_id
    tts_result = poll_executed_tool(client, tts_response.tool_execution_id)

    if tts_result.status != "succeeded" or not tts_result.results:
        job.status = "failed"
        job.error = "TTS generation failed"
        return job

    audio_file_id = tts_result.results[0].file_id
    job.status = "generating_avatar"

    # Step 2: Audio-to-Avatar (uses webhook callback for completion)
    avatar_response = client.tools.audio_to_avatar_clip(
        audio_file_id=audio_file_id,
        presenter_id=req.presenter_id,
    )
    job.avatar_execution_id = avatar_response.tool_execution_id
    execution_to_job[avatar_response.tool_execution_id] = job_id

    # Store callback URL if provided
    if req.callback_url:
        job_callbacks[job_id] = req.callback_url

    return job


@app.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job(job_id: str):
    """Check the status of a generation job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]


@app.post("/webhooks/videogen")
async def handle_webhook(request: Request):
    """
    Receive and verify VideoGen webhook events.
    Updates job status when avatar generation completes.
    """
    raw_body = (await request.body()).decode()
    headers = dict(request.headers)

    if not WEBHOOK_SECRET:
        raise HTTPException(
            status_code=500, detail="Webhook secret not configured"
        )

    # Verify the webhook signature
    try:
        payload = verify_webhook_signature(
            raw_body=raw_body,
            headers=headers,
            signing_secret=WEBHOOK_SECRET,
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    event = payload.get("event", "")
    execution_id = payload.get("toolExecutionId", "")

    # Route the event to the correct job
    job_id = execution_to_job.get(execution_id)
    if not job_id or job_id not in jobs:
        return {"status": "ignored", "reason": "unknown execution"}

    job = jobs[job_id]
    is_terminal_event = False

    if event == "tool_execution.succeeded":
        is_terminal_event = True
        job.status = "succeeded"
        results = payload.get("results", [])
        if results:
            file_data = results[0].get("file", {})
            download_source = file_data.get("downloadSource", {})
            job.result_url = download_source.get("url")

    elif event == "tool_execution.failed":
        is_terminal_event = True
        job.status = "failed"
        job.error = "Avatar generation failed"

    elif event == "tool_execution.cancelled":
        is_terminal_event = True
        job.status = "cancelled"

    if is_terminal_event:
        callback_url = job_callbacks.pop(job_id, None)
        if callback_url:
            try:
                async with httpx.AsyncClient() as http:
                    await http.post(
                        callback_url,
                        json=job.model_dump(),
                        timeout=10.0,
                    )
            except Exception as exc:
                print(f"Failed to forward callback for job {job_id}: {exc}")

        # Clean up the mapping
        execution_to_job.pop(execution_id, None)

    return {"status": "processed"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
