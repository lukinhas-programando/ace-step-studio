from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Any
from uuid import uuid4
import time
import base64

import httpx

from ..config import settings
from ..runtime_config import get_runtime_config

logger = logging.getLogger(__name__)


class ImageGenerator:
    def __init__(self) -> None:
        self.queue_endpoint = "https://queue.fal.run/fal-ai/flux-2/klein/9b/base"
        self.cover_size = 1152

    async def generate_cover(self, generation_id: str, prompt: str) -> str | None:
        config = get_runtime_config()
        provider = (config.image_generation_provider or "none").lower()
        if provider == "none":
            return None
        if not prompt:
            return None
        try:
            if provider == "fal":
                return await self._generate_with_fal(config.fal_api_key, prompt, generation_id)
            if provider == "comfy":
                return await self._generate_with_comfy(
                    config.comfy_base_url,
                    config.comfy_workflow_json,
                    prompt,
                    generation_id,
                )
            if provider == "a1111":
                return await self._generate_with_a1111(config.a1111_base_url, prompt, generation_id)
        except Exception as exc:  # noqa: BLE001
            logger.error("Image generation failed: %s", exc)
        return None

    async def _generate_with_fal(self, api_key: str | None, prompt: str, generation_id: str) -> str | None:
        if not api_key:
            logger.warning("FAL provider selected but API key is missing")
            return None
        headers = {"Authorization": f"Key {api_key}"}
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                self.queue_endpoint,
                headers=headers,
                json={
                    "prompt": prompt,
                    "image_size": {"width": self.cover_size, "height": self.cover_size},
                    "output_format": "png",
                    "num_images": 1,
                    "guidance_scale": 5,
                    "num_inference_steps": 28,
                },
            )
            response.raise_for_status()
            data = response.json()
            status_url = data.get("status_url")
            response_url = data.get("response_url")
            if not status_url or not response_url:
                raise RuntimeError("Invalid response from FAL queue")
            start_time = asyncio.get_event_loop().time()
            while True:
                await asyncio.sleep(2)
                status_resp = await client.get(status_url, headers=headers)
                status_resp.raise_for_status()
                status_body = status_resp.json()
                status = status_body.get("status")
                if status == "COMPLETED":
                    break
                if status not in {"IN_PROGRESS", "IN_QUEUE"}:
                    raise RuntimeError(f"FAL generation failed: {status_body}")
                if asyncio.get_event_loop().time() - start_time > 180:
                    raise RuntimeError("FAL generation timed out")

            result_resp = await client.get(response_url, headers=headers)
            result_resp.raise_for_status()
            result = result_resp.json()
            images = result.get("images") or []
            if not images:
                raise RuntimeError("FAL returned no images")
            image_url = images[0].get("url")
            if not image_url:
                raise RuntimeError("FAL image missing url")
            image_content = await client.get(image_url)
            image_content.raise_for_status()
            return self._persist_image(generation_id, image_content.content, "fal")

    async def _generate_with_comfy(
        self,
        base_url: str | None,
        workflow_json: str,
        prompt: str,
        generation_id: str,
    ) -> str | None:
        if not base_url or not workflow_json.strip():
            logger.warning("ComfyUI provider selected but URL or workflow JSON missing")
            return None
        try:
            workflow_template = json.loads(workflow_json)
            workflow = self._inject_prompt(workflow_template, prompt)
            workflow = self._force_square_latents(workflow)
        except json.JSONDecodeError as exc:
            logger.error("Invalid ComfyUI workflow JSON: %s", exc)
            return None
        timeout = httpx.Timeout(120.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            client_id = str(uuid4())
            prompt_resp = await client.post(
                f"{base_url.rstrip('/')}/prompt",
                json={"prompt": workflow, "client_id": client_id},
            )
            prompt_resp.raise_for_status()
            prompt_id = prompt_resp.json().get("prompt_id")
            if not prompt_id:
                raise RuntimeError("ComfyUI did not return prompt_id")
            history_url = f"{base_url.rstrip('/')}/history/{prompt_id}"
            image_meta: dict[str, Any] | None = None
            for _ in range(90):
                await asyncio.sleep(2)
                history_resp = await client.get(history_url)
                history_resp.raise_for_status()
                history = history_resp.json() or {}
                candidates: list[dict[str, Any]] = []
                if isinstance(history, dict):
                    if prompt_id in history and isinstance(history[prompt_id], dict):
                        candidates.append(history[prompt_id])
                    nested = history.get("history")
                    if isinstance(nested, dict):
                        if prompt_id in nested and isinstance(nested[prompt_id], dict):
                            candidates.append(nested[prompt_id])
                        else:
                            candidates.append(nested)
                    candidates.append(history)
                for candidate in candidates:
                    outputs = candidate.get("outputs") or {}
                    if not isinstance(outputs, dict):
                        continue
                    for node in outputs.values():
                        images = node.get("images")
                        if images:
                            image_meta = images[0]
                            break
                    if image_meta:
                        break
                if image_meta:
                    break
            if not image_meta:
                raise RuntimeError("ComfyUI generation timed out")
            view_params = {
                "filename": image_meta.get("filename"),
                "subfolder": image_meta.get("subfolder", ""),
                "type": image_meta.get("type", "output"),
            }
            if not view_params["filename"]:
                raise RuntimeError("ComfyUI image missing filename")
            view_resp = await client.get(f"{base_url.rstrip('/')}/view", params=view_params)
            view_resp.raise_for_status()
            return self._persist_image(generation_id, view_resp.content, "comfy")

    async def _generate_with_a1111(
        self,
        base_url: str | None,
        prompt: str,
        generation_id: str,
    ) -> str | None:
        if not base_url:
            logger.warning("Automatic1111 provider selected but URL missing")
            return None
        payload = {
            "prompt": prompt,
            "negative_prompt": "",
            "width": self.cover_size,
            "height": self.cover_size,
            "steps": 28,
            "cfg_scale": 5,
            "sampler_index": "Euler a",
            "batch_size": 1,
        }
        timeout = httpx.Timeout(180.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(f"{base_url.rstrip('/')}/sdapi/v1/txt2img", json=payload)
            response.raise_for_status()
            data = response.json()
            images = data.get("images") or []
            if not images:
                raise RuntimeError("Automatic1111 response missing images")
            image_b64 = images[0]
            try:
                content = base64.b64decode(image_b64)
            except Exception as exc:  # noqa: BLE001
                raise RuntimeError("Failed to decode Automatic1111 image") from exc
            return self._persist_image(generation_id, content, "a1111")

    def _persist_image(self, generation_id: str, content: bytes, suffix: str) -> str:
        dest_dir = settings.resolve_path(settings.generations_dir) / generation_id
        dest_dir.mkdir(parents=True, exist_ok=True)
        pattern = f"cover_{suffix}_*.png"
        for existing in dest_dir.glob(pattern):
            try:
                existing.unlink()
            except Exception:
                pass
        timestamp = int(time.time())
        dest_path = dest_dir / f"cover_{suffix}_{timestamp}.png"
        dest_path.write_bytes(content)
        return str(dest_path)

    def _inject_prompt(self, data: Any, prompt: str) -> Any:
        if isinstance(data, str):
            return data.replace("%prompt%", prompt)
        if isinstance(data, list):
            return [self._inject_prompt(item, prompt) for item in data]
        if isinstance(data, dict):
            return {key: self._inject_prompt(value, prompt) for key, value in data.items()}
        return data

    def _force_square_latents(self, data: Any) -> Any:
        if isinstance(data, list):
            return [self._force_square_latents(item) for item in data]
        if isinstance(data, dict):
            new_dict = {}
            for key, value in data.items():
                new_dict[key] = self._force_square_latents(value)
            if "width" in new_dict and "height" in new_dict:
                try:
                    new_dict["width"] = self.cover_size
                    new_dict["height"] = self.cover_size
                except Exception:
                    pass
            return new_dict
        return data


image_generator = ImageGenerator()
