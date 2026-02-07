from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path
from typing import Optional
import time

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import AsyncSessionLocal, get_session
from ..models import Generation
from ..schemas.generation import GenerationCreate, GenerationResponse, GenerationUpdate
from ..services.ace_engine import create_job_from_model, engine
from ..services.generation_service import GenerationService
from ..services.cover_theme import compute_theme
from ..services.image_generator import image_generator
from ..services.llm import llm_service
from ..schemas.llm import LLMTaskRequest
from ..config import settings
from ..runtime_config import get_runtime_config

router = APIRouter(prefix="/api/generations", tags=["generations"])
logger = logging.getLogger(__name__)


def _cover_url(generation: Generation) -> Optional[str]:
    if generation.cover_image_path:
        return f"/api/generations/{generation.id}/cover"
    return None


def _sanitize_filename(title: str, fallback: str) -> str:
    base = re.sub(r"[^A-Za-z0-9 _-]+", "", title).strip()
    if not base:
        base = fallback
    return base[:64].strip() or fallback


def _to_response(generation: Generation) -> GenerationResponse:
    color = generation.cover_color
    icon = generation.cover_icon
    if not color or not icon:
        theme_color, theme_icon = compute_theme(generation.id)
        color = color or theme_color
        icon = icon or theme_icon
    response = GenerationResponse.model_validate(generation)
    if generation.output_audio_path:
        response = response.model_copy(update={"audio_url": f"/api/generations/{generation.id}/audio"})
    response = response.model_copy(update={"cover_color": color, "cover_icon": icon, "cover_image_url": _cover_url(generation)})
    return response


@router.post("", response_model=GenerationResponse)
async def queue_generation(
    payload: GenerationCreate,
    session: AsyncSession = Depends(get_session),
) -> GenerationResponse:
    service = GenerationService(session)
    generation = await service.create(payload)

    asyncio.create_task(run_generation_job(generation.id))
    return _to_response(generation)


@router.get("/{generation_id}", response_model=GenerationResponse)
async def get_generation(
    generation_id: str,
    session: AsyncSession = Depends(get_session),
) -> GenerationResponse:
    service = GenerationService(session)
    generation = await service.get(generation_id)
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    return _to_response(generation)


@router.get("/{generation_id}/audio")
async def download_audio(
    generation_id: str,
    session: AsyncSession = Depends(get_session),
):
    service = GenerationService(session)
    generation = await service.get(generation_id)
    if not generation or not generation.output_audio_path:
        raise HTTPException(status_code=404, detail="Audio not ready")
    ext = Path(generation.output_audio_path).suffix or ".wav"
    title = _sanitize_filename(generation.title or "song", generation_id)
    return FileResponse(generation.output_audio_path, filename=f"{title}{ext}")


@router.get("/{generation_id}/cover")
async def get_cover_image(
    generation_id: str,
    session: AsyncSession = Depends(get_session),
):
    service = GenerationService(session)
    generation = await service.get(generation_id)
    if not generation or not generation.cover_image_path:
        raise HTTPException(status_code=404, detail="Cover not found")
    path = Path(generation.cover_image_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Cover not found")
    return FileResponse(path)


@router.delete("/{generation_id}")
async def delete_generation(
    generation_id: str,
    session: AsyncSession = Depends(get_session),
):
    service = GenerationService(session)
    generation = await service.get(generation_id)
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    if generation.output_audio_path:
        try:
            Path(generation.output_audio_path).unlink(missing_ok=True)
        except Exception:
            pass
    await service.delete(generation)
    return {"status": "deleted"}


@router.put("/{generation_id}", response_model=GenerationResponse)
async def update_generation(
    generation_id: str,
    payload: GenerationUpdate,
    session: AsyncSession = Depends(get_session),
) -> GenerationResponse:
    service = GenerationService(session)
    generation = await service.get(generation_id)
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    updated = await service.update(
        generation,
        **{k: v for k, v in payload.dict(exclude_unset=True).items()},
    )
    return _to_response(updated)


@router.post("/{generation_id}/cover", response_model=GenerationResponse)
async def upload_cover(
    generation_id: str,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
) -> GenerationResponse:
    service = GenerationService(session)
    generation = await service.get(generation_id)
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    dest_dir = settings.resolve_path(settings.generations_dir) / generation.id
    dest_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "").suffix.lower() or ".jpg"
    timestamp = int(time.time())
    dest_path = dest_dir / f"cover_upload_{timestamp}{suffix}"
    if generation.cover_image_path:
        try:
            Path(generation.cover_image_path).unlink(missing_ok=True)
        except Exception:
            pass
    with dest_path.open("wb") as dest:
        contents = await file.read()
        dest.write(contents)
    updated = await service.update(generation, cover_image_path=str(dest_path))
    return _to_response(updated)


@router.delete("/{generation_id}/cover", response_model=GenerationResponse)
async def delete_cover(
    generation_id: str,
    session: AsyncSession = Depends(get_session),
) -> GenerationResponse:
    service = GenerationService(session)
    generation = await service.get(generation_id)
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    if generation.cover_image_path:
        try:
            Path(generation.cover_image_path).unlink(missing_ok=True)
        except Exception:
            pass
    updated = await service.update(generation, cover_image_path=None)
    return _to_response(updated)


async def _generate_cover_for_song(
    generation: Generation,
    service: GenerationService,
    base_prompt: Optional[str],
) -> Generation:
    config = get_runtime_config()
    if (config.image_generation_provider or "none").lower() == "none":
        raise RuntimeError("Image generation is disabled in settings")
    prompt_seed = base_prompt or generation.prompt or generation.title or ""
    if not prompt_seed:
        raise RuntimeError("No prompt available for image generation")
    metadata = generation.metadata_json or {}
    new_prompt = prompt_seed
    try:
        llm_result = await llm_service.run(
            LLMTaskRequest(
                task="image",
                seed_prompt=prompt_seed,
                instrumental=generation.instrumental,
                style_tags=[],
            )
        )
        if llm_result.output:
            new_prompt = llm_result.output
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM image prompt generation failed for %s: %s", generation.id, exc)
    metadata["image_prompt"] = new_prompt

    cover_path = await image_generator.generate_cover(generation.id, new_prompt)
    if not cover_path:
        raise RuntimeError("Image generation did not return a cover")
    return await service.update(generation, metadata_json=metadata, cover_image_path=cover_path)


@router.post("/{generation_id}/cover/regenerate", response_model=GenerationResponse)
async def regenerate_cover(
    generation_id: str,
    session: AsyncSession = Depends(get_session),
) -> GenerationResponse:
    service = GenerationService(session)
    generation = await service.get(generation_id)
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    metadata = generation.metadata_json or {}
    prompt = metadata.get("image_prompt") or generation.prompt or generation.title
    try:
        updated = await _generate_cover_for_song(generation, service, prompt)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.warning("Manual image generation failed for %s: %s", generation_id, exc)
        raise HTTPException(status_code=500, detail="Image generation failed") from exc
    return _to_response(updated)


async def run_generation_job(generation_id: str) -> None:
    async with AsyncSessionLocal() as session:
        service = GenerationService(session)
        generation = await service.get(generation_id)
        if not generation:
            return
        image_task: asyncio.Task[str | None] | None = None
        image_prompt: Optional[str] = None
        try:
            metadata = generation.metadata_json or {}
            image_prompt = metadata.get("image_prompt") or generation.prompt or generation.title
            if image_prompt:
                image_task = asyncio.create_task(image_generator.generate_cover(generation.id, image_prompt))

            job = create_job_from_model(generation)
            engine.ensure_variant(job.model_variant)
            result = await engine.generate_async(job)
            merged_metadata = {**metadata, **(result.metadata or {})}
            await service.update(
                generation,
                status="ready",
                prompt=result.prompt,
                lyrics=result.lyrics,
                bpm=result.bpm,
                duration_seconds=result.duration_seconds or generation.duration_seconds,
                key=result.key or generation.key,
                time_signature=result.time_signature or generation.time_signature,
                output_audio_path=str(result.audio_path),
                metadata_json=merged_metadata,
            )
            if image_task:
                try:
                    cover_path = await image_task
                    if cover_path:
                        await service.update(generation, cover_image_path=cover_path)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Image generation failed for %s: %s", generation.id, exc)
        except Exception as exc:  # noqa: BLE001
            await service.update(
                generation,
                status="failed",
                error_message=str(exc),
            )
            if image_task:
                image_task.cancel()
