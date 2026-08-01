import re

SCRIPT_TAG_PATTERN = re.compile(
    r"<script\b[^>]*>.*?</script>",
    re.IGNORECASE | re.DOTALL,
)
STYLE_TAG_PATTERN = re.compile(
    r"<style\b[^>]*>.*?</style>",
    re.IGNORECASE | re.DOTALL,
)
HTML_TAG_PATTERN = re.compile(r"<[^>]+>")


def sanitize_text(value: str | None) -> str | None:
    """Strip HTML and script tags from user-provided plain text."""
    if value is None:
        return None

    cleaned = SCRIPT_TAG_PATTERN.sub("", value)
    cleaned = STYLE_TAG_PATTERN.sub("", cleaned)
    cleaned = HTML_TAG_PATTERN.sub("", cleaned)
    return cleaned.strip()
#This function sanitizes user-submitted text to protect against XSS (cross-site scripting) attacks