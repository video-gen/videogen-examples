"""
VideoGen image tools for the OpenAI Agents SDK.

Each tool wraps a VideoGen SDK call and returns the hydrated file URL.
"""

import os

from videogen import VideoGen, VideoGenError, upload_file

_videogen_api_url = os.environ.get("VIDEOGEN_API_URL")
client = VideoGen(
    api_key=os.environ["VIDEOGEN_API_KEY"],
    **({"base_url": _videogen_api_url} if _videogen_api_url not in (None, "") else {}),
)

EXAMPLE_IMAGE_QUALITY = "LOW"


def _succeeded_tool_result(execution: dict, failure_message: str) -> dict:
    results = execution.get("results") or []
    if not results:
        return {"status": "failed", "error": failure_message}

    first = results[0]
    file_id = first.get("file_id")
    if file_id is None:
        return {"status": "failed", "error": failure_message}

    return {
        "status": "succeeded",
        "file_id": file_id,
        "url": first.get("download_url"),
    }


def generate_image(prompt: str) -> dict:
    """Generate an image from a text prompt.

    Args:
        prompt: A detailed description of the image to generate.

    Returns:
        Dictionary with file_id and download URL.
    """
    try:
        execution = client.tools.generate_image_and_wait(
            prompt=prompt,
            quality=EXAMPLE_IMAGE_QUALITY,
        )
    except VideoGenError:
        return {"status": "failed", "error": "Image generation failed"}
    return _succeeded_tool_result(execution, "Image generation failed")


def transform_image(file_id: str, prompt: str) -> dict:
    """Transform an existing image using a text prompt (image-to-image).

    Uses ``POST /v1/tools/generate-image`` with reference file ids (see API docs).

    Args:
        file_id: The VideoGen file ID of the source image.
        prompt: Description of how to transform the image.

    Returns:
        Dictionary with the new file_id and download URL.
    """
    try:
        execution = client.tools.generate_image_and_wait(
            prompt=prompt,
            image_file_ids=[file_id],
            quality=EXAMPLE_IMAGE_QUALITY,
        )
    except VideoGenError:
        return {"status": "failed", "error": "Image transformation failed"}
    return _succeeded_tool_result(execution, "Image transformation failed")


def vectorize_image(file_id: str) -> dict:
    """Convert a raster image to SVG vector format.

    Args:
        file_id: The VideoGen file ID of the image to vectorize.

    Returns:
        Dictionary with the new file_id and download URL for the SVG.
    """
    try:
        execution = client.tools.vectorize_image_and_wait(
            image_file_id=file_id,
        )
    except VideoGenError:
        return {"status": "failed", "error": "Vectorization failed"}
    return _succeeded_tool_result(execution, "Vectorization failed")


def remove_background(file_id: str) -> dict:
    """Remove the background from an image.

    Args:
        file_id: The VideoGen file ID of the image.

    Returns:
        Dictionary with the new file_id and download URL (transparent PNG).
    """
    try:
        execution = client.tools.remove_image_background_and_wait(
            image_file_id=file_id,
        )
    except VideoGenError:
        return {"status": "failed", "error": "Background removal failed"}
    return _succeeded_tool_result(execution, "Background removal failed")


def upscale_image(file_id: str) -> dict:
    """Upscale an image to higher resolution.

    Args:
        file_id: The VideoGen file ID of the image to upscale.

    Returns:
        Dictionary with the new file_id and download URL.
    """
    try:
        execution = client.tools.upscale_image_and_wait(
            image_file_id=file_id,
        )
    except VideoGenError:
        return {"status": "failed", "error": "Upscaling failed"}
    return _succeeded_tool_result(execution, "Upscaling failed")


def search_files(query: str) -> dict:
    """Search previously generated files by description.

    Args:
        query: Natural language search query.

    Returns:
        Dictionary with a list of matching files.
    """
    response = client.files.search_files(query=query)
    files = []
    for result in (response.get("results") or [])[:5]:
        f = result.get("file") or {}
        files.append(
            {
                "file_id": f.get("file_id"),
                "display_name": f.get("display_name"),
                "type": f.get("type"),
            }
        )
    return {"status": "succeeded", "files": files}


def upload_image(file_path: str) -> dict:
    """Upload a local image file to VideoGen.

    Args:
        file_path: Path to the local image file.

    Returns:
        Dictionary with the uploaded file_id.
    """
    display_name = os.path.basename(file_path)
    with open(file_path, "rb") as f:
        uploaded = upload_file(
            client,
            f,
            display_name=display_name,
            type="IMAGE",
        )

    return {"status": "succeeded", "file_id": uploaded.get("file_id")}
