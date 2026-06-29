"""Minimal happy-path check for the AI Image Editor example (VideoGen tools module)."""

from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()

from tools import generate_image


def main() -> None:
    result = generate_image("A solid blue square on a white background for examples e2e.")
    if result.get("status") != "succeeded":
        raise RuntimeError(f"generate_image failed: {result}")
    if not result.get("url"):
        raise RuntimeError(f"generate_image missing url: {result}")
    print("ai-image-editor happy path passed")


if __name__ == "__main__":
    main()
