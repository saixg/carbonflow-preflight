from __future__ import annotations

import json
import httpx
import pytest

from carbonflow.extract import FieldSpec, ProviderError
from carbonflow.extract.openrouter_provider import OpenRouterProvider

FIELDS = [
    FieldSpec("net_export_mwh", "number", "MWh", "Net electricity exported"),
]


def test_openrouter_pinned_model_required():
    with pytest.raises(ValueError, match="pinned model id is required"):
        OpenRouterProvider(api_key="fake-key", model="")


def test_openrouter_extract_success():
    payload = {
        "id": "gen-123",
        "choices": [
            {
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": json.dumps({
                        "candidates": [
                            {
                                "parameter": "net_export_mwh",
                                "quote": "exported was 152,345 MWh",
                                "value_text": "152,345",
                                "unit_text": "MWh",
                            }
                        ]
                    }),
                },
            }
        ],
    }

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers.get("Authorization") == "Bearer test-key"
        assert "openrouter.ai/api/v1/chat/completions" in str(request.url)
        return httpx.Response(200, json=payload)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    p = OpenRouterProvider(api_key="test-key", model="nvidia/nemotron-3-ultra-550b-a55b", client=client)
    res = p.extract(FIELDS, "Total exported was 152,345 MWh.", "page-1")
    assert len(res.candidates) == 1
    assert res.candidates[0]["parameter"] == "net_export_mwh"
    assert res.info["provider"] == "openrouter"
    assert res.info["model"] == "nvidia/nemotron-3-ultra-550b-a55b"


def test_openrouter_verify_success():
    payload = {
        "choices": [
            {
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": json.dumps({"supports": True}),
                },
            }
        ]
    }

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    p = OpenRouterProvider(api_key="test-key", model="nvidia/nemotron-3-ultra-550b-a55b", client=client)
    supports = p.verify(FIELDS[0], "152,345 MWh exported", "152,345", "MWh")
    assert supports is True


def test_openrouter_retry_on_rate_limit():
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts < 2:
            return httpx.Response(429, json={"error": "rate limited"})
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {
                            "role": "assistant",
                            "content": json.dumps({"supports": False}),
                        },
                    }
                ]
            },
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    p = OpenRouterProvider(api_key="test-key", model="nvidia/nemotron-3-ultra-550b-a55b", client=client, sleep=lambda _: None)
    supports = p.verify(FIELDS[0], "passage", "100", "MW")
    assert attempts == 2
    assert supports is False


def test_openrouter_malformed_response_raises():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": "not json"}}]})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    p = OpenRouterProvider(api_key="test-key", model="nvidia/nemotron-3-ultra-550b-a55b", client=client)
    with pytest.raises(ProviderError, match="malformed JSON"):
        p.extract(FIELDS, "text", "page-1")
