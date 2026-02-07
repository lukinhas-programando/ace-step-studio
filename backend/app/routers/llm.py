from fastapi import APIRouter, HTTPException, Query

from ..schemas.llm import LLMTaskRequest, LLMTaskResponse
from ..services.llm import llm_service

router = APIRouter(prefix="/api/llm", tags=["llm"])


@router.post("", response_model=LLMTaskResponse)
async def run_llm_task(payload: LLMTaskRequest) -> LLMTaskResponse:
    return await llm_service.run(payload)


@router.get("/models", response_model=list[str])
async def list_llm_models(
    endpoint: str | None = Query(default=None),
    api_key: str | None = Query(default=None),
) -> list[str]:
    try:
        return await llm_service.list_openai_models(
            endpoint=endpoint,
            api_key=api_key,
            require_enabled=False,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
