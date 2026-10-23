"""Canonical JSON and hashing, so identical inputs always produce byte-identical output."""

from __future__ import annotations

import hashlib
import json
from datetime import date
from decimal import Decimal


def _default(o):
    if isinstance(o, Decimal):
        # Plain notation, no exponent, no trailing zeros: 1.50 and 1.5 hash the same.
        text = format(o.normalize(), "f")
        return text if text != "-0" else "0"
    if isinstance(o, date):
        return o.isoformat()
    if isinstance(o, (set, frozenset)):
        return sorted(o)
    if isinstance(o, tuple):
        return list(o)
    raise TypeError(f"cannot serialise {type(o).__name__}")


def canonical_json(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=_default)


def canonical_hash(obj) -> str:
    return hashlib.sha256(canonical_json(obj).encode("utf-8")).hexdigest()
