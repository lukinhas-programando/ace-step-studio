from pydantic import BaseModel


class ConfigResponse(BaseModel):
    app_name: str
    host: str
    port: int
    model_variants: list[str]
    enable_repaint: bool
    enable_cover: bool
    enable_future_modes: bool
    lm_enabled: bool
    lm_backend: str
    lm_checkpoint: str
    lm_device: str
    lm_offload_to_cpu: bool
    openai_enabled: bool
    openai_endpoint: str | None
    openai_model: str
    openai_api_key: str | None
    openai_prompt_system_prompt: str
    openai_lyrics_system_prompt: str
    openai_title_system_prompt: str
    image_generation_provider: str
    image_prompt_system_prompt: str
    fal_api_key: str | None
    comfy_base_url: str | None
    comfy_workflow_json: str
    a1111_base_url: str | None
    data_dirs: dict[str, str]
    thinking_simple_mode: bool
    thinking_custom_mode: bool
    use_cot_caption: bool
    use_cot_language: bool
    use_cot_metas: bool
    allow_lm_batch: bool
    default_model_variant: str
    base_inference_steps: int
    turbo_inference_steps: int
    shift_inference_steps: int
    use_adg: bool
    cfg_interval_start: float
    cfg_interval_end: float
    infer_method: str
    mps_available: bool
    adg_supported: bool
    adg_unavailable_reason: str | None


class ConfigUpdateRequest(BaseModel):
    lm_enabled: bool | None = None
    lm_checkpoint: str | None = None
    lm_backend: str | None = None
    lm_device: str | None = None
    lm_offload_to_cpu: bool | None = None
    openai_enabled: bool | None = None
    openai_endpoint: str | None = None
    openai_api_key: str | None = None
    openai_model: str | None = None
    openai_prompt_system_prompt: str | None = None
    openai_lyrics_system_prompt: str | None = None
    openai_title_system_prompt: str | None = None
    image_generation_provider: str | None = None
    image_prompt_system_prompt: str | None = None
    fal_api_key: str | None = None
    comfy_base_url: str | None = None
    comfy_workflow_json: str | None = None
    a1111_base_url: str | None = None
    thinking_simple_mode: bool | None = None
    thinking_custom_mode: bool | None = None
    use_cot_caption: bool | None = None
    use_cot_language: bool | None = None
    use_cot_metas: bool | None = None
    allow_lm_batch: bool | None = None
    default_model_variant: str | None = None
    base_inference_steps: int | None = None
    turbo_inference_steps: int | None = None
    shift_inference_steps: int | None = None
    use_adg: bool | None = None
    cfg_interval_start: float | None = None
    cfg_interval_end: float | None = None
    infer_method: str | None = None
