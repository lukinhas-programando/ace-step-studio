from typing import Literal, Optional

from pydantic import BaseModel, Field


class LLMTaskRequest(BaseModel):
    task: Literal["prompt", "lyrics", "title", "image"] = "prompt"
    seed_prompt: str = Field(..., description="User supplied instruction or topic")
    style_tags: list[str] = Field(default_factory=list)
    instrumental: bool = False
    language: Optional[str] = None


class LLMTaskResponse(BaseModel):
    task: str
    output: str
    provider: Literal["ace", "openai-compat"]
    metadata: dict[str, str] = Field(default_factory=dict)
