from __future__ import annotations

import asyncio
import logging
import os
import sys
from pathlib import Path
from typing import Optional

from ..config import settings
from ..runtime_config import get_runtime_config

logger = logging.getLogger(__name__)


class ACEPromptEngine:
    def __init__(self) -> None:
        self.repo_path = settings.resolve_path(settings.ace_repo_path)
        self.checkpoints_path = settings.resolve_path(settings.checkpoints_path)
        self._imports_ready = False
        self.llm_handler = None
        self.ready = False
        self._cache_root = settings.resolve_path(Path("data/.acestep_cache"))

    def _prepare_environment(self) -> None:
        self._cache_root.mkdir(parents=True, exist_ok=True)
        tmp_dir = self._cache_root / "tmp"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        os.environ.setdefault("ACESTEP_TMPDIR", str(tmp_dir))
        os.environ.setdefault("TMPDIR", str(tmp_dir))
        os.environ.setdefault("TEMP", str(tmp_dir))
        os.environ.setdefault("TMP", str(tmp_dir))

    def _import_modules(self) -> None:
        if self._imports_ready:
            return
        repo_str = str(self.repo_path)
        if repo_str not in sys.path:
            sys.path.insert(0, repo_str)
        try:
            from acestep.llm_inference import LLMHandler  # type: ignore
            from acestep.inference import create_sample as ace_create_sample  # type: ignore
            from acestep.inference import format_sample as ace_format_sample  # type: ignore

            self.LLMHandler = LLMHandler
            self._create_sample_fn = ace_create_sample
            self._format_sample_fn = ace_format_sample
        except Exception as exc:  # pragma: no cover
            raise RuntimeError(f"Failed to import ACE-Step LLM modules: {exc}") from exc
        self._imports_ready = True

    def _initialize_handler(self) -> None:
        if self.ready and self.llm_handler:
            return
        self._prepare_environment()
        self._import_modules()
        runtime_config = get_runtime_config()
        self.llm_handler = self.LLMHandler()
        status, ok = self.llm_handler.initialize(
            checkpoint_dir=str(self.checkpoints_path),
            lm_model_path=runtime_config.lm_checkpoint,
            backend=runtime_config.lm_backend,
            device=runtime_config.lm_device,
            offload_to_cpu=runtime_config.lm_offload_to_cpu,
        )
        if not ok:
            raise RuntimeError(status)
        self.ready = True
        logger.info("ACE-Step prompt engine ready")

    async def ensure_ready(self) -> None:
        if self.ready and self.llm_handler:
            return
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._initialize_handler)

    async def create_sample(self, query: str, instrumental: bool = False, vocal_language: Optional[str] = None) -> dict:
        await self.ensure_ready()
        loop = asyncio.get_running_loop()

        def _run():
            result = self._create_sample_fn(
                llm_handler=self.llm_handler,
                query=query,
                instrumental=instrumental,
                vocal_language=vocal_language,
            )
            if not result.success:
                raise RuntimeError(result.error or result.status_message)
            return result

        return await loop.run_in_executor(None, _run)

    async def format_inputs(
        self,
        caption: str,
        lyrics: str,
        user_metadata: Optional[dict] = None,
        temperature: float = 0.85,
    ) -> dict:
        await self.ensure_ready()
        loop = asyncio.get_running_loop()

        def _run():
            result = self._format_sample_fn(
                llm_handler=self.llm_handler,
                caption=caption,
                lyrics=lyrics,
                user_metadata=user_metadata,
                temperature=temperature,
                use_constrained_decoding=True,
            )
            if not result.success:
                raise RuntimeError(result.error or result.status_message)
            return result

        return await loop.run_in_executor(None, _run)

    def handle_runtime_config_change(self) -> None:
        runtime_config = get_runtime_config()
        if not runtime_config.lm_enabled:
            self.ready = False
            self.llm_handler = None
        else:
            self.ready = False
            self.llm_handler = None


ace_prompt_engine = ACEPromptEngine()
