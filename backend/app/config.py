from pathlib import Path
from typing import Literal, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ace_step_", env_file=".env", env_file_encoding="utf-8")

    app_name: str = "ACE-Step Studio"
    debug: bool = False

    # Networking
    host: str = Field(default="0.0.0.0", description="Bind address for FastAPI (can be set to Tailscale IP)")
    port: int = Field(default=8788, description="HTTP port; avoid conflicts with SillyTavern (8000)")
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5175"], alias="corsOrigins")

    # Paths
    project_root: Path = Field(default=Path(__file__).resolve().parents[2])
    data_root: Path = Field(default=Path("data"))
    ace_repo_path: Path = Field(default=Path("../ACE-Step-1.5"), description="Path to the ACE-Step repository")
    checkpoints_path: Path = Field(default=Path("../ACE-Step-1.5/checkpoints"))

    # Models
    default_model_config: str = Field(default="acestep-v15-turbo", description="Default DiT model configuration")
    model_variants: list[str] = Field(default_factory=lambda: ["base", "turbo", "shift"])
    model_config_map: dict[str, str] = Field(
        default_factory=lambda: {
            "turbo": "acestep-v15-turbo",
            "shift": "acestep-v15-turbo-continuous",
            "base": "acestep-v15-base",
        }
    )
    default_model_variant: str = "turbo"
    device: str = Field(default="auto", description="Preferred torch device (auto/cuda/mps/cpu)")
    use_flash_attention: bool = Field(default=False, description="Enable flash attention when available")
    compile_model: bool = False
    offload_to_cpu: bool = Field(default=False, description="Offload DiT weights to CPU when idle")
    offload_dit_to_cpu: bool = Field(default=False, description="Offload only DiT to CPU when idle")
    base_inference_steps: int = Field(default=32, ge=1, le=50)
    turbo_inference_steps: int = Field(default=8, ge=1, le=20)
    shift_inference_steps: int = Field(default=8, ge=1, le=20)
    use_adg: bool = Field(default=False)
    cfg_interval_start: float = Field(default=0.0, ge=0.0, le=1.0)
    cfg_interval_end: float = Field(default=1.0, ge=0.0, le=1.0)
    infer_method: Literal["ode", "sde"] = "ode"

    # LM configuration
    lm_enabled: bool = True
    lm_checkpoint: str = "acestep-5Hz-lm-0.6B"
    lm_backend: Literal["pt", "vllm"] = "pt"
    lm_device: str = "auto"
    lm_offload_to_cpu: bool = False
    lm_init_on_start: bool = True

    # Optional OpenAI-compatible endpoint for prompt/lyrics expansion
    openai_enabled: bool = False
    openai_endpoint: Optional[str] = None
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    openai_prompt_system_prompt: str = (
        "You are a music creative director writing a concise but vivid one-paragraph 'song description' for an AI music model. "
        "Expand the user's short idea into a single paragraph (3-5 sentences) that covers genre, mood, instrumentation, vocal character, "
        "and arrangement arc. Keep it under 120 words, write in plain English, and avoid bullet lists, rhyme schemes, or lyric formatting. "
        "Mention only elements relevant to the prompt. Never invent non-English words unless the user explicitly requests another language. "
        "Return ONLY the song concept in plain text-no markup, formatting, commentary, or special characters."
    )
    openai_lyrics_system_prompt: str = (
        "You are a professional songwriter. Given a song description, write polished English lyrics in a standard pop structure "
        "(Verse/Chorus/Bridge etc.). Use clear section labels in square brackets (e.g. [Chorus]). You can also add a brief one- or two-word "
        "style for each section (e.g. [Chorus - building]). Keep total length under ~200 words, and stay on topic. If the user requests "
        "instrumental, reply exactly with [Instrumental]. Otherwise, make sure the lyrics tell a coherent story, rhyme lightly, and never mix "
        "languages unless asked. Avoid nonsense syllables unless the prompt demands scatting. Do NOT apply any additional markup to the text-"
        "no additional formatting. It must follow the structure exactly.\n\n## EXAMPLE\n\n[Verse 1]\nFound him by the back porch door\n"
        "Two odd socks and a crooked smile\nSaid he'd sworn off masters\nBeen walking free awhile\nDust on his ears, but his eyes shone clear\n"
        "Like \"boy, you're doing fine right here\"\n\n[Chorus - low dynamics]\nDobby's boots on the floor by my bed\nLittle hat hanging off my "
        "old post instead\nHe folds my shirts, but he won't call me boss\nSays, \"friends don't measure love in what they've lost\"\nHe's "
        "patched-up, proud, and a little bit loud\nDobby's boots on the floor, and I'm damn glad now\n\n[Verse 2]\nHe stares at my timecard clock\n"
        "Says, \"chains don't always look like chains\"\nHelps Ma with the evening chores\nSings low through the window rain\nTells me, "
        "\"boy, don't break yourself in two\nFreedom's something you can choose\"\n\nReturn ONLY the song lyrics in plain text-no markup, formatting, "
        "commentary, or special characters other than section tags."
    )
    openai_title_system_prompt: str = (
        "You are a professional songwriter. Given a song description, write a creative but relevant English title for the song concept. "
        "The song title should match the vibe and intent of the song concept provided, and should be no more than 6 words long-though any "
        "length (even a single word if it works) six words or under is acceptable. Return ONLY the song lyrics in plain text-no markup, "
        "formatting, commentary, or special characters other than section tags."
    )

    # Image generation
    image_generation_provider: Literal["none", "fal", "comfy", "a1111"] = "none"
    image_prompt_system_prompt: str = (
        "You are a professional photographer. Given a song description, write a prompt for an AI image generator to become the cover image "
        "for the song concept. The prompt should match the vibe and intent of the song concept provided.\n\nFollow these guidelines:\n"
        "1. Stock photo feel. Unassuming in the sense that it's not distracting, but interesting in the sense that it's aesthetically pleasing.\n"
        "2.\n\nExamples:\nA serene landscape photograph of a quiet mountain valley at dawn, snow-dusted peaks rising in the distance, a still alpine "
        "lake reflecting the mountains. Pine trees line the shoreline. Soft morning mist, cool color palette. Natural light, gentle shadows, "
        "wide-angle shot, high dynamic range, atmospheric, peaceful mood\n\nA fine art architectural photograph of a striking modern statue in a quiet "
        "city park, abstract bronze form with sharp geometric lines, mounted on a stone pedestal. Surrounded by manicured grass and tall trees, "
        "distant city buildings softly blurred. Overcast daylight, diffused light, subtle shadows. Calm, contemplative mood, wide-angle composition, "
        "muted colors, high detail, cinematic tone\n\nA vintage roadside photography shot of an old rundown desert gas station storefront along Route 66, "
        "cracked concrete forecourt, faded hand-painted signage, rusted pumps, sun-bleached wood and peeling paint. Empty highway stretching behind it. "
        "Harsh midday desert light, deep shadows. Nostalgic, lonely mood, wide-angle lens, film grain, faded colors\n\nReturn ONLY the image prompt in "
        "plain text-no markup, formatting, commentary, or special characters other than section tags."
    )
    fal_api_key: Optional[str] = None
    comfy_base_url: Optional[str] = "http://127.0.0.1:8188"
    comfy_workflow_json: str = ""
    a1111_base_url: Optional[str] = "http://127.0.0.1:7860"

    # LM behavior defaults
    thinking_simple_mode: bool = True
    thinking_custom_mode: bool = False
    use_cot_caption: bool = True
    use_cot_language: bool = True
    use_cot_metas: bool = True
    allow_lm_batch: bool = True

    # Storage
    reference_audio_dir: Path = Field(default=Path("data/reference_audio"))
    source_audio_dir: Path = Field(default=Path("data/source_audio"))
    generations_dir: Path = Field(default=Path("data/generations"))
    uploads_dir: Path = Field(default=Path("data/uploads"))

    # Database
    database_url: str = Field(default="sqlite+aiosqlite:///./data/app.db")

    # Feature flags
    enable_repaint: bool = True
    enable_cover: bool = True
    enable_future_modes: bool = True

    def resolve_path(self, path: Path) -> Path:
        if path.is_absolute():
            return path
        return (self.project_root / path).resolve()

    def ensure_directories(self) -> None:
        for directory in [
            self.reference_audio_dir,
            self.source_audio_dir,
            self.generations_dir,
            self.uploads_dir,
        ]:
            resolved = self.resolve_path(directory)
            resolved.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_directories()
