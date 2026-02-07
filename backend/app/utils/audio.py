from __future__ import annotations

from pathlib import Path
from typing import BinaryIO

from ..config import settings


def save_uploaded_audio(filename: str, file_data: BinaryIO, destination: str = "uploads") -> Path:
    dest_dir = settings.resolve_path(getattr(settings, f"{destination}_dir"))
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / filename
    with open(dest_path, "wb") as dest:
        dest.write(file_data.read())
    return dest_path
