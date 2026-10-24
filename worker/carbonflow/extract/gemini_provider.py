"""Gemini extraction provider using structured JSON output over plain httpx.

Requirements met here: pinned model id supplied by the caller, bounded retries, a hard timeout,
schema-validated output, and no document text or secrets in logs or exceptions.
"""

from __future__ import annotations

import json
import time
from typing import Any

import httpx

from . import prompts
from .provider import ProviderError, RawResult
from .schema import FieldSpec


class GeminiProvider:
    name = "gemini"

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-2.5-flash",
        *,
        base_url: str = "https://generativelanguage.googleapis.com/v1beta",
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
        self._api_key = api_key
        # Strip models/ prefix if present
        clean_model = model.replace("models/", "")
        self._url = f"{base_url.rstrip('/')}/models/{clean_model}:generateContent"
        self._headers = {
            "x-goog-api-key": api_key,
            "Content-Type": "application/json",
        }
        self._http = client or httpx.Client(timeout=httpx.Timeout(timeout, connect=10.0))

    def _generate(self, system: str, user: str, schema: dict[str, Any]) -> dict:
        body = {
            "system_instruction": {
                "parts": [{"text": system}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user}]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "response_schema": schema,
            },
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
            res_json = r.json()
            candidates = res_json.get("candidates", [])
            if not candidates:
                raise ProviderError("model returned no candidates")
            first = candidates[0]
            finish_reason = first.get("finishReason")
            if finish_reason not in ("STOP", "stop", None):
                raise ProviderError(f"model did not finish normally ({finish_reason})")
            parts = first.get("content", {}).get("parts", [])
            if not parts or "text" not in parts[0]:
                raise ProviderError("model response content is empty")
            raw_text = parts[0]["text"]
            return json.loads(raw_text)
        except ProviderError:
            raise
        except (KeyError, IndexError, TypeError, ValueError) as e:
            raise ProviderError("model returned malformed JSON") from e

    def extract(self, fields: list[FieldSpec], text: str, unit_ref: str, variant: int = 0) -> RawResult:
        if not fields:
            return RawResult([], self._info())
        user_prompt = prompts.extract_user_prompt(fields, text, unit_ref, variant)
        data = self._generate(prompts.SYSTEM, user_prompt, prompts.CANDIDATES_SCHEMA)
        candidates = data.get("candidates")
        if not isinstance(candidates, list):
            raise ProviderError("model output does not match candidates schema")
        return RawResult(candidates, self._info())

    def verify(self, spec: FieldSpec, passage: str, value_text: str, unit_text: str | None) -> bool:
        user_prompt = prompts.verify_user_prompt(spec, passage, value_text, unit_text)
        data = self._generate(prompts.VERIFY_SYSTEM, user_prompt, prompts.VERIFY_SCHEMA)
        supports = data.get("supports")
        if not isinstance(supports, bool):
            raise ProviderError("model verify output does not match schema")
        return supports

    def _info(self) -> dict:
        return {"provider": self.name, "model": self.model, "prompt_hash": prompts.prompt_hash()}
