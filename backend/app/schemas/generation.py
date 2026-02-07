from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

GenerationMode = Literal["simple", "custom"]
TaskType = Literal["text2music", "cover", "repaint"]
ModelVariant = Literal["base", "turbo", "shift"]


class GenerationInputs(BaseModel):
    prompt: Optional[str] = None
    lyrics: Optional[str] = None
    instrumental: bool = False
    bpm: Optional[int] = Field(default=None, ge=30, le=300)
    duration_seconds: Optional[int] = Field(default=None, ge=10, le=600)
    key: Optional[str] = None
    time_signature: Optional[str] = Field(default=None)


class GenerationCreate(BaseModel):
    title: Optional[str] = None
    task_type: TaskType = "text2music"
    mode: GenerationMode = "simple"
    model_variant: ModelVariant = "turbo"
    cover_strength: Optional[int] = Field(default=None, ge=0, le=100)
    source_audio_id: Optional[str] = None
    reference_audio_id: Optional[str] = None
    inputs: GenerationInputs
    metadata: dict[str, Any] = Field(default_factory=dict)
    cover_color: Optional[str] = None
    cover_icon: Optional[str] = None


class GenerationUpdate(BaseModel):
    status: Optional[str] = None
    error_message: Optional[str] = None
    output_audio_path: Optional[str] = None
    title: Optional[str] = None
    prompt: Optional[str] = None
    lyrics: Optional[str] = None
    cover_color: Optional[str] = None
    cover_icon: Optional[str] = None


class GenerationResponse(BaseModel):
    id: str
    title: Optional[str]
    task_type: TaskType
    mode: GenerationMode
    model_variant: ModelVariant
    status: str
    prompt: Optional[str]
    lyrics: Optional[str]
    metadata: dict[str, Any] = Field(default_factory=dict, alias="metadata_json")
    output_audio_path: Optional[str]
    instrumental: bool
    cover_strength: Optional[int]
    duration_seconds: Optional[int]
    bpm: Optional[int]
    key: Optional[str]
    time_signature: Optional[str]
    cover_color: Optional[str]
    cover_icon: Optional[str]
    cover_image_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    audio_url: Optional[str] = None

    class Config:
        from_attributes = True
        populate_by_name = True
