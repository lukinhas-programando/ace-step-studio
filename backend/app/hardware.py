from __future__ import annotations

from functools import lru_cache


@lru_cache(maxsize=1)
def mps_available() -> bool:
    try:
        import torch

        return bool(getattr(torch.backends, "mps", None) and torch.backends.mps.is_available())
    except Exception:
        return False
