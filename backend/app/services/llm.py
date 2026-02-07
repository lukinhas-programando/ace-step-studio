from __future__ import annotations

import asyncio
import logging
from typing import Literal

import httpx
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_fixed

from ..runtime_config import get_runtime_config
from ..schemas.llm import LLMTaskRequest, LLMTaskResponse
from .ace_prompt import ace_prompt_engine

Provider = Literal["ace", "openai-compat"]
logger = logging.getLogger(__name__)


class LLMService:
    def __init__(self) -> None:
        self._client = httpx.AsyncClient(timeout=30)

    async def _call_openai(self, request: LLMTaskRequest) -> LLMTaskResponse:
        config = get_runtime_config()
        if not config.openai_endpoint:
            raise RuntimeError("OpenAI-compatible endpoint is not configured")

        if request.task == "prompt":
            system_prompt = config.openai_prompt_system_prompt
        elif request.task == "lyrics":
            system_prompt = config.openai_lyrics_system_prompt
        elif request.task == "title":
            system_prompt = config.openai_title_system_prompt
        else:
            system_prompt = config.image_prompt_system_prompt
        headers = {}
        if config.openai_api_key:
            headers["Authorization"] = f"Bearer {config.openai_api_key}"

        url = config.openai_endpoint.rstrip("/") + "/v1/chat/completions"
        logger.info("Calling OpenAI-compatible endpoint %s with model=%s", url, config.openai_model)

        payload = {
            "model": config.openai_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": self._build_user_prompt(request)},
            ],
            "max_tokens": 512,
            "temperature": 0.8,
            "stream": False,
        }

        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(3),
            wait=wait_fixed(2),
            retry=retry_if_exception_type(httpx.HTTPError),
        ):
            with attempt:
                response = await self._client.post(url, json=payload, headers=headers)
                body_preview = response.text[:400].replace("\n", " ") if response.text else ""
                if response.is_error:
                    logger.warning(
                        "OpenAI-compatible endpoint %s responded with %s: %s",
                        url,
                        response.status_code,
                        body_preview,
                    )
                else:
                    logger.debug(
                        "OpenAI-compatible endpoint %s responded with %s: %s",
                        url,
                        response.status_code,
                        body_preview,
                    )
                response.raise_for_status()
                data = response.json()
                first_choice = data.get("choices", [{}])[0]
                message = first_choice.get("message", {})
                text = (
                    message.get("content")
                    or first_choice.get("text", "")
                    or ""
                ).strip()
                return LLMTaskResponse(
                    task=request.task,
                    output=text,
                    provider="openai-compat",
                    metadata={"model": config.openai_model},
                )
        raise RuntimeError("Failed to call OpenAI-compatible endpoint")

    def _build_user_prompt(self, request: LLMTaskRequest) -> str:
        tags = ", ".join(request.style_tags)
        base = f"Instruction: {request.seed_prompt}\n"
        if tags:
            base += f"Style tags: {tags}.\n"
        base += f"Instrumental: {request.instrumental}."
        if request.language:
            base += f" Language: {request.language}."
        if request.task == "lyrics":
            base += "\nWrite structured lyrics with [Verse]/[Chorus] tags."
        elif request.task == "title":
            base += "\nReturn only a short, catchy song title (max 6 words)."
        elif request.task == "image":
            base += "\nDescribe a cinematic album cover concept in one paragraph."
        else:
            base += "\nReturn a vivid ACE-Step style caption."
        return base

    async def _call_ace_prompt(self, request: LLMTaskRequest) -> LLMTaskResponse:
        description = request.seed_prompt
        if request.style_tags:
            description += " | Styles: " + ", ".join(request.style_tags)
        result = await ace_prompt_engine.create_sample(
            query=description,
            instrumental=request.instrumental,
            vocal_language=request.language,
        )
        if request.task == "lyrics":
            output = result.lyrics or result.caption
        elif request.task == "title":
            output = self._format_title(result.caption or request.seed_prompt)
        elif request.task == "image":
            output = result.caption or request.seed_prompt
        else:
            output = result.caption or request.seed_prompt
        metadata = {
            "bpm": result.bpm,
            "duration": result.duration,
            "keyscale": result.keyscale,
            "language": result.language,
            "timesignature": result.timesignature,
        }
        return LLMTaskResponse(
            task=request.task,
            output=output,
            provider="ace",
            metadata={k: str(v) for k, v in metadata.items() if v},
        )

    @staticmethod
    def _format_title(text: str) -> str:
        cleaned = text.strip().split("\n")[0]
        cleaned = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in cleaned)
        cleaned = " ".join(cleaned.split())
        return cleaned or "Untitled"

    async def run(self, request: LLMTaskRequest) -> LLMTaskResponse:
        config = get_runtime_config()
        errors: list[str] = []
        if config.openai_enabled and config.openai_endpoint:
            try:
                return await self._call_openai(request)
            except Exception as exc:  # noqa: BLE001
                errors.append(str(exc))
                logger.warning("OpenAI-compatible LLM failed, falling back: %s", exc)
        if config.lm_enabled:
            try:
                return await self._call_ace_prompt(request)
            except Exception as exc:  # noqa: BLE001
                errors.append(str(exc))
                logger.warning("ACE 5Hz LM failed, falling back: %s", exc)
        note = "; ".join(errors) if errors else "LM disabled"
        return LLMTaskResponse(
            task=request.task,
            output=request.seed_prompt,
            provider="ace",
            metadata={"note": note},
        )

    async def list_openai_models(
        self,
        endpoint: str | None = None,
        api_key: str | None = None,
        require_enabled: bool = True,
    ) -> list[str]:
        config = get_runtime_config()
        resolved_endpoint = (endpoint or config.openai_endpoint or "").strip()
        resolved_api_key = api_key if api_key is not None else config.openai_api_key
        is_enabled = config.openai_enabled or (not require_enabled and bool(resolved_endpoint))
        if not (is_enabled and resolved_endpoint):
            raise RuntimeError("OpenAI-compatible endpoint is not configured or enabled")
        headers = {}
        if resolved_api_key:
            headers["Authorization"] = f"Bearer {resolved_api_key}"
        url = resolved_endpoint.rstrip("/") + "/v1/models"
        logger.info("Fetching models from OpenAI-compatible endpoint %s", url)
        response = await self._client.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        items = data.get("data", [])
        models: list[str] = []
        for item in items:
            model_id = item.get("id")
            if isinstance(model_id, str):
                models.append(model_id)
        return sorted(models)

    async def close(self) -> None:
        await self._client.aclose()


llm_service = LLMService()
