from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import Generation
from ..schemas.generation import GenerationResponse
from ..services.cover_theme import compute_theme
from ..services.generation_service import GenerationService

router = APIRouter(prefix="/api/history", tags=["history"])


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
    cover_url = generation.cover_image_path and f"/api/generations/{generation.id}/cover"
    return response.model_copy(update={"cover_color": color, "cover_icon": icon, "cover_image_url": cover_url})


@router.get("", response_model=list[GenerationResponse])
async def list_history(
    limit: int = 25,
    session: AsyncSession = Depends(get_session),
) -> list[GenerationResponse]:
    service = GenerationService(session)
    generations = await service.list_generations(limit=limit)
    return [_to_response(item) for item in generations]
