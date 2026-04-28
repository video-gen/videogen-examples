from pydantic import BaseModel


class GenerateAvatarRequest(BaseModel):
    text: str
    voice_id: str | None = None
    presenter_id: str | None = None
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


class PresenterInfo(BaseModel):
    presenter_id: str
    display_name: str
