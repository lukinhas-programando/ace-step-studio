from __future__ import annotations

import json
from pathlib import Path
from threading import RLock

from pydantic import BaseModel

from .config import settings

CONFIG_PATH = settings.resolve_path(Path("data/runtime_config.json"))
_lock = RLock()


class RuntimeConfig(BaseModel):
    lm_enabled: bool = settings.lm_enabled
    lm_checkpoint: str = settings.lm_checkpoint
    lm_backend: str = settings.lm_backend
    lm_device: str = settings.lm_device
    lm_offload_to_cpu: bool = settings.lm_offload_to_cpu

    openai_enabled: bool = settings.openai_enabled
    openai_endpoint: str | None = settings.openai_endpoint
    openai_api_key: str | None = settings.openai_api_key
    openai_model: str = settings.openai_model
    openai_prompt_system_prompt: str = settings.openai_prompt_system_prompt
    openai_lyrics_system_prompt: str = settings.openai_lyrics_system_prompt
    openai_title_system_prompt: str = settings.openai_title_system_prompt

    image_generation_provider: str = settings.image_generation_provider
    image_prompt_system_prompt: str = settings.image_prompt_system_prompt
    fal_api_key: str | None = settings.fal_api_key
    comfy_base_url: str | None = settings.comfy_base_url
    comfy_workflow_json: str = settings.comfy_workflow_json
    a1111_base_url: str | None = settings.a1111_base_url

    thinking_simple_mode: bool = settings.thinking_simple_mode
    thinking_custom_mode: bool = settings.thinking_custom_mode
    use_cot_caption: bool = settings.use_cot_caption
    use_cot_language: bool = settings.use_cot_language
    use_cot_metas: bool = settings.use_cot_metas
    allow_lm_batch: bool = settings.allow_lm_batch

    default_model_variant: str = settings.default_model_variant
    base_inference_steps: int = settings.base_inference_steps
    turbo_inference_steps: int = settings.turbo_inference_steps
    shift_inference_steps: int = settings.shift_inference_steps
    use_adg: bool = settings.use_adg
    cfg_interval_start: float = settings.cfg_interval_start
    cfg_interval_end: float = settings.cfg_interval_end
    infer_method: str = settings.infer_method


_runtime_config: RuntimeConfig | None = None


def _load_from_disk() -> RuntimeConfig:
    if CONFIG_PATH.exists():
        try:
            data = json.loads(CONFIG_PATH.read_text())
            return RuntimeConfig(**data)
        except Exception:
            pass
    return RuntimeConfig()


def _save_to_disk(config: RuntimeConfig) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(config.model_dump_json(indent=2))


def get_runtime_config() -> RuntimeConfig:
    global _runtime_config
    with _lock:
        if _runtime_config is None:
            _runtime_config = _load_from_disk()
        return _runtime_config


def update_runtime_config(**kwargs) -> RuntimeConfig:
    global _runtime_config
    with _lock:
        current = get_runtime_config()
        updated = current.model_copy(update=kwargs)
        _runtime_config = updated
        _save_to_disk(updated)
        return updated
