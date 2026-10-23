"""OpenAI provider (chat completions with strict JSON-schema output), over plain httpx.

Requirements met here: pinned model id supplied by the caller, bounded retries, a hard timeout,
schema-validated output, and no document text or keys in logs or exceptions.
Not exercised against the live API yet; covered by mock-transport tests. Before real documents are
sent, check OpenAI's current data-retention terms and privacy controls for the account in use.
"""

from __future__ import annotations

import json
import time

import httpx

from . import prompts
from .provider import ProviderError, RawResult
from .schema import FieldSpec


class OpenAIProvider:
    name = "openai"

    def __init__(
        self,
        api_key: str,
        model: str,
        *,
        base_url: str = "https://api.openai.com/v1",
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
        self._headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        self._http = client or httpx.Client(timeout=httpx.Timeout(timeout, connect=10.0))

    def _chat(self, system: str, user: str, schema_name: str, schema: dict) -> dict:
        body = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": {"type": "json_schema", "json_schema": {"name": schema_name, "strict": True, "schema": schema}},
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
            if choice["message"].get("refusal"):
                raise ProviderError("model refused the request")
            data = json.loads(choice["message"]["content"])
        except ProviderError:
            raise
        except (KeyError, IndexError, TypeError, ValueError) as e:
            raise ProviderError("model returned malformed output") from e
        if not isinstance(data, dict):
            raise ProviderError("model returned malformed output")
        return data

    def extract(self, fields: list[FieldSpec], text: str, unit_ref: str, variant: int) -> RawResult:
        data = self._chat(
            prompts.SYSTEM, prompts.extract_user_prompt(fields, text, unit_ref, variant),
            "candidates", prompts.CANDIDATES_SCHEMA,
        )
        cands = data.get("candidates")
        if not isinstance(cands, list):
            raise ProviderError("model returned malformed output")
        return RawResult(cands, {"provider": self.name, "model": self.model, "prompt_hash": prompts.prompt_hash()})

    def verify(self, spec: FieldSpec, passage: str, value_text: str, unit_text: str | None) -> bool:
        data = self._chat(
            prompts.VERIFY_SYSTEM, prompts.verify_user_prompt(spec, passage, value_text, unit_text),
            "verification", prompts.VERIFY_SCHEMA,
        )
        supports = data.get("supports")
        if not isinstance(supports, bool):
            raise ProviderError("model returned malformed output")
        return supports
