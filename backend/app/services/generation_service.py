from __future__ import annotations

from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Generation
from ..schemas.generation import GenerationCreate, GenerationResponse
from .cover_theme import compute_theme


class GenerationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_generations(self, limit: int = 25) -> Iterable[Generation]:
        result = await self.session.execute(
            select(Generation).order_by(Generation.created_at.desc()).limit(limit)
        )
        return result.scalars().all()

    async def get(self, generation_id: str) -> Generation | None:
        return await self.session.get(Generation, generation_id)

    async def create(self, payload: GenerationCreate) -> Generation:
        generation = Generation(
            title=payload.title,
            task_type=payload.task_type,
            mode=payload.mode,
            model_variant=payload.model_variant,
            prompt=payload.inputs.prompt,
            lyrics=payload.inputs.lyrics,
            instrumental=payload.inputs.instrumental,
            bpm=payload.inputs.bpm,
            duration_seconds=payload.inputs.duration_seconds,
            key=payload.inputs.key,
            time_signature=payload.inputs.time_signature,
            metadata_json=payload.metadata,
            cover_color=payload.cover_color,
            cover_icon=payload.cover_icon,
        )
        self.session.add(generation)
        await self.session.commit()
        await self.session.refresh(generation)
        if not generation.cover_color or not generation.cover_icon:
            color, icon = compute_theme(generation.id)
            generation.cover_color = generation.cover_color or color
            generation.cover_icon = generation.cover_icon or icon
            await self.session.commit()
            await self.session.refresh(generation)
        return generation

    async def update(
        self,
        generation: Generation,
        **fields,
    ) -> Generation:
        for key, value in fields.items():
            setattr(generation, key, value)
        await self.session.commit()
        await self.session.refresh(generation)
        return generation

    async def delete(self, generation: Generation) -> None:
        await self.session.delete(generation)
        await self.session.commit()

    @staticmethod
    def serialize(generation: Generation) -> GenerationResponse:
        color = generation.cover_color
        icon = generation.cover_icon
        if not color or not icon:
            theme_color, theme_icon = compute_theme(generation.id)
            color = color or theme_color
            icon = icon or theme_icon
        response = GenerationResponse.model_validate(generation)
        return response.model_copy(update={"cover_color": color, "cover_icon": icon})
