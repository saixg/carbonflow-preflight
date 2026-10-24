"""OpenRouter provider for extraction and verification using OpenAI-compatible Chat Completions API.

Supports NVIDIA Nemotron (nvidia/nemotron-3-ultra-550b-a55b) and other models available on OpenRouter.
Meets CarbonFlow requirements: pinned model id, bounded retries, hard timeout, schema validation,
and strict secrecy protection (no keys or document text in error logs).
"""

from __future__ import annotations

import json
import time
from typing import Any

import httpx

from . import prompts
from .provider import ProviderError, RawResult
from .schema import FieldSpec

DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class OpenRouterProvider:
    name = "openrouter"

    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_MODEL,
        *,
        base_url: str = OPENROUTER_BASE_URL,
        timeout: float = 60.0,
        max_attempts: int = 3,
        client: httpx.Client | None = None,
        sleep=time.sleep,
    ):
        if not model:
            raise ValueError("a pinned model id is required")
        self.model = model
        self.max_attempts = max_attempts
        self._sleep = sleep
        self._url = f"{base_url.rstrip('/')}/chat/completions"
        self._headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://carbonflow.app",
            "X-Title": "CarbonFlow Preflight",
        }
        self._http = client or httpx.Client(timeout=httpx.Timeout(timeout, connect=10.0))

    def _chat(self, system: str, user: str, schema: dict[str, Any]) -> dict:
        schema_instruction = f"\nYou must output valid JSON matching this schema:\n{json.dumps(schema, ensure_ascii=False)}"
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system + schema_instruction},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
        }

        last = "unknown error"
        for attempt in range(self.max_attempts):
            try:
                r = self._http.post(self._url, headers=self._headers, json=body)
            except httpx.TimeoutException:
                last = "request timed out"
            except httpx.TransportError:
                last = "network error"
            else:
                if r.status_code == 200:
                    return self._parse(r)
                if r.status_code in (429, 500, 502, 503, 504):
                    last = f"service returned {r.status_code}"
                else:
                    raise ProviderError(f"request rejected ({r.status_code})")
            if attempt + 1 < self.max_attempts:
                self._sleep(min(2.0 * (2**attempt), 20.0))
        raise ProviderError(f"model call failed after {self.max_attempts} attempts: {last}")

    @staticmethod
    def _parse(r: httpx.Response) -> dict:
        try:
            choice = r.json()["choices"][0]
            if choice.get("finish_reason") not in ("stop", None):
                raise ProviderError(f"model did not finish ({choice.get('finish_reason')})")
            msg = choice.get("message", {})
            if msg.get("refusal"):
                raise ProviderError("model refused the request")
            content = msg.get("content", "")
            return json.loads(content)
        except ProviderError:
            raise
        except (KeyError, IndexError, TypeError, ValueError) as e:
            raise ProviderError("model returned malformed JSON") from e

    def extract(self, fields: list[FieldSpec], text: str, unit_ref: str, variant: int = 0) -> RawResult:
        if not fields:
            return RawResult([], self._info())
        user_prompt = prompts.extract_user_prompt(fields, text, unit_ref, variant)
        data = self._chat(prompts.SYSTEM, user_prompt, prompts.CANDIDATES_SCHEMA)
        candidates = data.get("candidates")
        if not isinstance(candidates, list):
            raise ProviderError("model output missing 'candidates' array")
        return RawResult(candidates, self._info())

    def verify(self, spec: FieldSpec, passage: str, value_text: str, unit_text: str | None) -> bool:
        user_prompt = prompts.verify_user_prompt(spec, passage, value_text, unit_text)
        data = self._chat(prompts.VERIFY_SYSTEM, user_prompt, prompts.VERIFY_SCHEMA)
        supports = data.get("supports")
        if not isinstance(supports, bool):
            raise ProviderError("model verify output missing 'supports' boolean")
        return supports

    def _info(self) -> dict:
        return {"provider": self.name, "model": self.model, "prompt_hash": prompts.prompt_hash()}
