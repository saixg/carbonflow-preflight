"""Errors the pipeline distinguishes. `retryable` decides whether the job queue tries again."""


class WorkerError(Exception):
    retryable = False


class UnsupportedFile(WorkerError):
    """Wrong or disallowed file type, or a declared type that does not match the bytes."""


class LimitExceeded(WorkerError):
    """File exceeds a configured size, page, cell or time limit."""


class ParseFailed(WorkerError):
    """File is corrupted, encrypted or otherwise cannot be read."""


class NeedsOcr(WorkerError):
    """Document has images but no extractable text. Not a failure; it needs an OCR step or a person."""


class IntegrityError(WorkerError):
    """Stored bytes do not match the recorded SHA-256. Never retried; someone should look."""


class NotFound(WorkerError):
    """A referenced object or record does not exist (for this tenant)."""


class TransientError(WorkerError):
    """Storage or database hiccup. Safe to retry."""

    retryable = True
