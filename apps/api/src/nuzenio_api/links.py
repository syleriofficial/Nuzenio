"""Public external links are HTTPS, uncredentialed, and unambiguous."""

from typing import Annotated
from urllib.parse import urlsplit

from pydantic import BeforeValidator, HttpUrl


def validate_external_link(value: object) -> str:
    text = str(value)
    if "\\" in text or any(ord(char) <= 32 or ord(char) == 127 for char in text):
        raise ValueError("External URL contains whitespace, controls, or a backslash")
    try:
        parsed = urlsplit(text)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or "%" in parsed.netloc
            or parsed.port == 0
        ):
            raise ValueError("External URLs require HTTPS and must not contain credentials")
    except ValueError as error:
        raise ValueError("Invalid external HTTPS URL") from error
    return text


ExternalURL = Annotated[HttpUrl, BeforeValidator(validate_external_link)]
