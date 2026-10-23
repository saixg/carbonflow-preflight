from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from .schema import FieldSpec


class ProviderError(Exception):
    """The model call failed or returned something unusable. The pass is dropped, never patched up."""


@dataclass
class RawResult:
    candidates: list  # untrusted: validated field by field later
    info: dict = field(default_factory=dict)  # provider, model, prompt_hash; never document text


class ExtractionProvider(Protocol):
    name: str

    def extract(self, fields: list[FieldSpec], text: str, unit_ref: str, variant: int) -> RawResult: ...

    def verify(self, spec: FieldSpec, passage: str, value_text: str, unit_text: str | None) -> bool:
        """An independent read of the passage. It sees the claim, not how it was reached."""
