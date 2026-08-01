from typing import Any

from core.sanitize import sanitize_text


def sanitize_optional_text(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, str):
        return sanitize_text(value)
    return value
