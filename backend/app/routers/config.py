from fastapi import APIRouter

from ..config import settings
from ..hardware import mps_available
from ..runtime_config import get_runtime_config, update_runtime_config
from ..schemas.config import ConfigResponse, ConfigUpdateRequest
from ..services.ace_engine import engine
from ..services.ace_prompt import ace_prompt_engine

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("", response_model=ConfigResponse)
async def get_config() -> ConfigResponse:
    runtime_config = get_runtime_config()
    mps = mps_available()
    adg_supported = not mps
    adg_reason = "Adaptive Dual Guidance is not available on macOS MPS due to float64 limitations." if mps else None
    return ConfigResponse(
        app_name=settings.app_name,
        host=settings.host,
        port=settings.port,
        model_variants=settings.model_variants,
        enable_repaint=settings.enable_repaint,
        enable_cover=settings.enable_cover,
        enable_future_modes=settings.enable_future_modes,
        lm_enabled=runtime_config.lm_enabled,
        lm_backend=runtime_config.lm_backend,
        lm_checkpoint=runtime_config.lm_checkpoint,
        lm_device=runtime_config.lm_device,
        lm_offload_to_cpu=runtime_config.lm_offload_to_cpu,
        openai_enabled=runtime_config.openai_enabled,
        openai_endpoint=runtime_config.openai_endpoint,
        openai_api_key=runtime_config.openai_api_key,
        openai_model=runtime_config.openai_model,
        openai_prompt_system_prompt=runtime_config.openai_prompt_system_prompt,
        openai_lyrics_system_prompt=runtime_config.openai_lyrics_system_prompt,
        openai_title_system_prompt=runtime_config.openai_title_system_prompt,
        image_generation_provider=runtime_config.image_generation_provider,
        image_prompt_system_prompt=runtime_config.image_prompt_system_prompt,
        fal_api_key=runtime_config.fal_api_key,
        comfy_base_url=runtime_config.comfy_base_url,
        comfy_workflow_json=runtime_config.comfy_workflow_json,
        a1111_base_url=runtime_config.a1111_base_url,
        thinking_simple_mode=runtime_config.thinking_simple_mode,
        thinking_custom_mode=runtime_config.thinking_custom_mode,
        use_cot_caption=runtime_config.use_cot_caption,
        use_cot_language=runtime_config.use_cot_language,
        use_cot_metas=runtime_config.use_cot_metas,
        allow_lm_batch=runtime_config.allow_lm_batch,
        data_dirs={
            "reference": str(settings.resolve_path(settings.reference_audio_dir)),
            "source": str(settings.resolve_path(settings.source_audio_dir)),
            "generations": str(settings.resolve_path(settings.generations_dir)),
        },
        default_model_variant=runtime_config.default_model_variant,
        base_inference_steps=runtime_config.base_inference_steps,
        turbo_inference_steps=runtime_config.turbo_inference_steps,
        shift_inference_steps=runtime_config.shift_inference_steps,
        use_adg=runtime_config.use_adg,
        cfg_interval_start=runtime_config.cfg_interval_start,
        cfg_interval_end=runtime_config.cfg_interval_end,
        infer_method=runtime_config.infer_method,
        mps_available=mps,
        adg_supported=adg_supported,
        adg_unavailable_reason=adg_reason,
    )


@router.put("", response_model=ConfigResponse)
async def update_config(payload: ConfigUpdateRequest) -> ConfigResponse:
    data = payload.model_dump(exclude_unset=True)
    if data.get("use_adg") and mps_available():
        data["use_adg"] = False
    update_runtime_config(**data)
    engine.handle_runtime_config_change()
    ace_prompt_engine.handle_runtime_config_change()
    return await get_config()
