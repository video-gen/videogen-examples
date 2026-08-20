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
from videogen import VideoGen, VideoGenError, verify_webhook_signature

from models import (
    ActorInfo,
    GenerateAvatarRequest,
    JobStatus,
    VoiceInfo,
)

load_dotenv()

_videogen_api_url = os.environ.get("VIDEOGEN_API_URL")
client = VideoGen(
    api_key=os.environ["VIDEOGEN_API_KEY"],
    **({"base_url": _videogen_api_url} if _videogen_api_url not in (None, "") else {}),
)
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
            "Register a webhook endpoint at https://app.videogen.io/api "
            "or via the API, then set the signing secret in .env"
        )
    yield


app = FastAPI(
    title="Talking Avatar Webhook Server",
    description="Generate talking avatar videos from text using VideoGen webhooks.",
    version="1.0.0",
    lifespan=lifespan,
)


def _read_string_field(obj: object, *field_names: str) -> str | None:
    """Read a string from either snake_case or camelCase SDK payloads."""
    if not isinstance(obj, dict):
        return None
    for field_name in field_names:
        value = obj.get(field_name)
        if isinstance(value, str) and value:
            return value
    return None


def _read_bool_field(obj: object, *field_names: str) -> bool | None:
    """Read a bool from either snake_case or camelCase SDK payloads."""
    if not isinstance(obj, dict):
        return None
    for field_name in field_names:
        value = obj.get(field_name)
        if isinstance(value, bool):
            return value
    return None


@app.get("/actors", response_model=list[ActorInfo])
def list_actors():
    """List ACTOR entities available to this API key."""
    response = client.entities.list_entities(entity_type="ACTOR", limit=50)
    actors: list[ActorInfo] = []
    for entity in response.get("entities") or []:
        if not isinstance(entity, dict):
            continue
        actor_entity_id = _read_string_field(entity, "entity_id", "entityId")
        name = _read_string_field(entity, "name")
        references = entity.get("references")
        is_built_in = _read_bool_field(entity, "is_built_in", "isBuiltIn") is True
        actor_config = entity.get("actor_config")
        if actor_config is None:
            actor_config = entity.get("actorConfig")
        has_avatar_presenter = False
        if isinstance(actor_config, dict):
            has_avatar_presenter = (
                _read_bool_field(
                    actor_config, "has_avatar_presenter", "hasAvatarPresenter"
                )
                is True
            )
        if actor_entity_id is None or name is None:
            continue
        if not is_built_in and not has_avatar_presenter and not references:
            continue
        actors.append(ActorInfo(actor_entity_id=actor_entity_id, name=name))
    return actors


@app.get("/voices", response_model=list[VoiceInfo])
def list_voices():
    """List available TTS voices."""
    response = client.resources.list_tts_voices(limit=100)
    raw_voices = response.get("tts_voices") or response.get("ttsVoices") or []
    ranked: list[tuple[bool, VoiceInfo]] = []
    for voice in raw_voices:
        if not isinstance(voice, dict):
            continue
        voice_id = _read_string_field(voice, "voice_id", "voiceId")
        display_name = _read_string_field(voice, "display_name", "displayName")
        language = _read_string_field(voice, "language_code", "languageCode")
        if voice_id is None or display_name is None or language is None:
            continue
        supports_direct = voice.get("supports_direct_tool_execution")
        if supports_direct is None:
            supports_direct = voice.get("supportsDirectToolExecution")
        ranked.append(
            (
                bool(supports_direct),
                VoiceInfo(
                    voice_id=voice_id,
                    display_name=display_name,
                    language=language,
                ),
            )
        )
    ranked.sort(key=lambda item: (not item[0], item[1].display_name))
    return [item[1] for item in ranked]


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
    tts_kwargs: dict = {"tts_text": req.text}
    if req.voice_id is not None:
        tts_kwargs["voice_id"] = req.voice_id

    try:
        tts_result = client.tools.text_to_speech_and_wait(**tts_kwargs)
    except (VideoGenError, KeyError, IndexError, TypeError):
        job.status = "failed"
        job.error = "TTS generation failed"
        return job

    job.tts_execution_id = tts_result.get("tool_execution_id")
    results = tts_result.get("results") or []
    audio_file_id = results[0].get("file_id") if results else None
    if audio_file_id is None:
        job.status = "failed"
        job.error = "TTS generation failed"
        return job

    job.status = "generating_avatar"

    # Step 2: Generate Avatar (uses webhook callback for completion)
    avatar_kwargs: dict = {
        "actor_entity_id": req.actor_entity_id,
        "audio_file_id": audio_file_id,
    }
    if req.avatar_quality is not None:
        avatar_kwargs["avatar_quality"] = req.avatar_quality

    try:
        avatar_response = client.tools.generate_avatar(**avatar_kwargs)
        avatar_execution_id = avatar_response["tool_execution_id"]
    except (VideoGenError, KeyError, TypeError):
        job.status = "failed"
        job.error = "Avatar generation failed"
        return job

    job.avatar_execution_id = avatar_execution_id
    execution_to_job[avatar_execution_id] = job_id

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

    # verify_webhook_signature returns the parsed event with snake_case keys.
    try:
        event = verify_webhook_signature(
            raw_body=raw_body,
            headers=headers,
            secret=WEBHOOK_SECRET,
        )
    except VideoGenError:
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    event_name = event.get("event", "")
    execution_id = event.get("tool_execution_id", "")

    # Route the event to the correct job
    job_id = execution_to_job.get(execution_id)
    if not job_id or job_id not in jobs:
        return {"status": "ignored", "reason": "unknown execution"}

    job = jobs[job_id]
    is_terminal_event = False

    if event_name == "tool_execution.succeeded":
        is_terminal_event = True
        job.status = "succeeded"
        results = event.get("results") or []
        if results:
            first = results[0]
            # Prefer the convenience top-level download URL when present.
            job.result_url = first.get("download_url")
            if job.result_url is None:
                file_data = first.get("file") or {}
                download_source = file_data.get("download_source") or {}
                job.result_url = download_source.get("url")

    elif event_name == "tool_execution.failed":
        is_terminal_event = True
        job.status = "failed"
        job.error = "Avatar generation failed"

    elif event_name == "tool_execution.cancelled":
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
