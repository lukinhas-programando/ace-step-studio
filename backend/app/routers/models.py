from fastapi import APIRouter, HTTPException

from ..services.model_manager import download_model, list_models

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
async def get_models() -> list[dict[str, str | bool | None]]:
    return list_models()


@router.post("/{model_id}/download")
async def trigger_download(model_id: str) -> dict[str, str]:
    try:
        download_model(model_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "started", "model_id": model_id}
