from typing import Literal

from pydantic import BaseModel


class ActorInfo(BaseModel):
    actor_entity_id: str
    name: str


class GenerateAvatarRequest(BaseModel):
    text: str
    actor_entity_id: str
    avatar_quality: Literal["LOW", "STANDARD", "HIGH", "MAX"] | None = None
    voice_id: str | None = None
    callback_url: str | None = None


class JobStatus(BaseModel):
    job_id: str
    status: str
    tts_execution_id: str | None = None
    avatar_execution_id: str | None = None
    result_url: str | None = None
    error: str | None = None


class VoiceInfo(BaseModel):
    voice_id: str
    display_name: str
    language: str
