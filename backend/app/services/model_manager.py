from __future__ import annotations

import threading
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Literal

from huggingface_hub import snapshot_download

from ..config import settings


ModelType = Literal["lm", "dit"]


@dataclass
class ModelSpec:
    id: str
    display_name: str
    repo_id: str
    local_folder: str
    type: ModelType
    description: str

    @property
    def local_path(self) -> Path:
        return settings.resolve_path(settings.checkpoints_path / Path(self.local_folder))


CHECKPOINTS_ROOT = settings.resolve_path(settings.checkpoints_path)

MODEL_SPECS: dict[str, ModelSpec] = {
    "lm-0.6b": ModelSpec(
        id="lm-0.6b",
        display_name="LM 0.6B",
        repo_id="ACE-Step/acestep-5Hz-lm-0.6B",
        local_folder="acestep-5Hz-lm-0.6B",
        type="lm",
        description="Lightweight 0.6B parameter language model for prompt/lyrics expansion.",
    ),
    "lm-1.7b": ModelSpec(
        id="lm-1.7b",
        display_name="LM 1.7B",
        repo_id="ACE-Step/Ace-Step1.5",
        local_folder="acestep-5Hz-lm-1.7B",
        type="lm",
        description="Standard 1.7B parameter language model included with the main release.",
    ),
    "lm-4b": ModelSpec(
        id="lm-4b",
        display_name="LM 4B",
        repo_id="ACE-Step/acestep-5Hz-lm-4B",
        local_folder="acestep-5Hz-lm-4B",
        type="lm",
        description="Largest 4B parameter language model for best lyric planning quality.",
    ),
    "dit-base": ModelSpec(
        id="dit-base",
        display_name="Base DiT",
        repo_id="ACE-Step/acestep-v15-base",
        local_folder="acestep-v15-base",
        type="dit",
        description="High quality DiT base model for detailed generations.",
    ),
    "dit-turbo": ModelSpec(
        id="dit-turbo",
        display_name="Turbo DiT",
        repo_id="ACE-Step/Ace-Step1.5",
        local_folder="acestep-v15-turbo",
        type="dit",
        description="Default turbo DiT model for fast generations.",
    ),
    "dit-shift": ModelSpec(
        id="dit-shift",
        display_name="Turbo Shift",
        repo_id="ACE-Step/acestep-v15-turbo-continuous",
        local_folder="acestep-v15-turbo-continuous",
        type="dit",
        description="Turbo DiT with continuous shift (1-5) for creative control.",
    ),
}


class ModelDownloadState:
    def __init__(self) -> None:
        self._statuses: dict[str, dict[str, str | None]] = {}
        self._lock = threading.Lock()

    def get(self, model_id: str) -> dict[str, str | None]:
        with self._lock:
            return self._statuses.get(model_id, {"state": "idle", "error": None}).copy()

    def set(self, model_id: str, state: str, error: str | None = None) -> None:
        with self._lock:
            self._statuses[model_id] = {"state": state, "error": error}


download_state = ModelDownloadState()


def _ensure_checkpoint_root() -> None:
    CHECKPOINTS_ROOT.mkdir(parents=True, exist_ok=True)


def _path_has_content(path: Path) -> bool:
    if not path.exists():
        return False
    try:
        return any(path.iterdir())
    except Exception:
        return False


def list_models() -> list[dict[str, str | bool | None]]:
    _ensure_checkpoint_root()
    models = []
    for spec in MODEL_SPECS.values():
        local_path = spec.local_path
        has_files = _path_has_content(local_path)
        download_info = download_state.get(spec.id)
        state = download_info.get("state", "idle")
        error = download_info.get("error")
        if state == "downloading":
            status = "downloading"
        elif has_files:
            status = "available"
        elif state == "error":
            status = "error"
        else:
            status = "missing"
        models.append(
            {
                "id": spec.id,
                "display_name": spec.display_name,
                "type": spec.type,
                "description": spec.description,
                "repo_id": spec.repo_id,
                "path": str(local_path),
                "status": status,
                "error": error,
            }
        )
    return models


def _download_worker(spec: ModelSpec) -> None:
    try:
        download_state.set(spec.id, "downloading", None)
        snapshot_download(
            repo_id=spec.repo_id,
            local_dir=str(spec.local_path),
            local_dir_use_symlinks=False,
            resume_download=True,
        )
        download_state.set(spec.id, "completed", None)
    except Exception as exc:  # noqa: BLE001
        download_state.set(spec.id, "error", str(exc))


def download_model(model_id: str) -> None:
    if model_id not in MODEL_SPECS:
        raise ValueError("Unknown model id")
    spec = MODEL_SPECS[model_id]
    if download_state.get(model_id).get("state") == "downloading":
        return
    if _path_has_content(spec.local_path):
        download_state.set(model_id, "completed", None)
        return
    _ensure_checkpoint_root()
    thread = threading.Thread(target=_download_worker, args=(spec,), daemon=True)
    thread.start()
