"""
VideoGen image tools for the OpenAI Agents SDK.

Each tool wraps a VideoGen SDK call and returns the hydrated file URL.
"""

import os

from videogen import VideoGenApi, poll_executed_tool

client = VideoGenApi(token=os.environ["VIDEOGEN_API_KEY"])


def generate_image(prompt: str) -> dict:
    """Generate an image from a text prompt.

    Args:
        prompt: A detailed description of the image to generate.

    Returns:
        Dictionary with file_id and download URL.
    """
    response = client.tools.prompt_to_image(prompt=prompt)
    execution = poll_executed_tool(client, response.tool_execution_id)

    if execution.status != "succeeded" or not execution.results:
        return {"status": "failed", "error": "Image generation failed"}

    file_id = execution.results[0].file_id
    hydrated = client.files.hydrate_file(file_id=file_id)
    url = hydrated.file.download_source.url if hydrated.file.download_source else None

    return {"status": "succeeded", "file_id": file_id, "url": url}


def transform_image(file_id: str, prompt: str) -> dict:
    """Transform an existing image using a text prompt (image-to-image).

    Args:
        file_id: The VideoGen file ID of the source image.
        prompt: Description of how to transform the image.

    Returns:
        Dictionary with the new file_id and download URL.
    """
    response = client.tools.image_to_image(
        image_file_id=file_id,
        prompt=prompt,
    )
    execution = poll_executed_tool(client, response.tool_execution_id)

    if execution.status != "succeeded" or not execution.results:
        return {"status": "failed", "error": "Image transformation failed"}

    new_file_id = execution.results[0].file_id
    hydrated = client.files.hydrate_file(file_id=new_file_id)
    url = hydrated.file.download_source.url if hydrated.file.download_source else None

    return {"status": "succeeded", "file_id": new_file_id, "url": url}


def vectorize_image(file_id: str) -> dict:
    """Convert a raster image to SVG vector format.

    Args:
        file_id: The VideoGen file ID of the image to vectorize.

    Returns:
        Dictionary with the new file_id and download URL for the SVG.
    """
    response = client.tools.vectorize_image(image_file_id=file_id)
    execution = poll_executed_tool(client, response.tool_execution_id)

    if execution.status != "succeeded" or not execution.results:
        return {"status": "failed", "error": "Vectorization failed"}

    new_file_id = execution.results[0].file_id
    hydrated = client.files.hydrate_file(file_id=new_file_id)
    url = hydrated.file.download_source.url if hydrated.file.download_source else None

    return {"status": "succeeded", "file_id": new_file_id, "url": url}


def remove_background(file_id: str) -> dict:
    """Remove the background from an image.

    Args:
        file_id: The VideoGen file ID of the image.

    Returns:
        Dictionary with the new file_id and download URL (transparent PNG).
    """
    response = client.tools.remove_image_background(image_file_id=file_id)
    execution = poll_executed_tool(client, response.tool_execution_id)

    if execution.status != "succeeded" or not execution.results:
        return {"status": "failed", "error": "Background removal failed"}

    new_file_id = execution.results[0].file_id
    hydrated = client.files.hydrate_file(file_id=new_file_id)
    url = hydrated.file.download_source.url if hydrated.file.download_source else None

    return {"status": "succeeded", "file_id": new_file_id, "url": url}


def upscale_image(file_id: str) -> dict:
    """Upscale an image to higher resolution.

    Args:
        file_id: The VideoGen file ID of the image to upscale.

    Returns:
        Dictionary with the new file_id and download URL.
    """
    response = client.tools.upscale_image(image_file_id=file_id)
    execution = poll_executed_tool(client, response.tool_execution_id)

    if execution.status != "succeeded" or not execution.results:
        return {"status": "failed", "error": "Upscaling failed"}

    new_file_id = execution.results[0].file_id
    hydrated = client.files.hydrate_file(file_id=new_file_id)
    url = hydrated.file.download_source.url if hydrated.file.download_source else None

    return {"status": "succeeded", "file_id": new_file_id, "url": url}


def search_files(query: str) -> dict:
    """Search previously generated files by description.

    Args:
        query: Natural language search query.

    Returns:
        Dictionary with a list of matching files.
    """
    response = client.files.search_files(query=query)
    files = [
        {
            "file_id": f.file_id,
            "display_name": f.display_name,
            "type": f.type,
        }
        for f in response.files[:5]
    ]
    return {"status": "succeeded", "files": files}


def upload_image(file_path: str) -> dict:
    """Upload a local image file to VideoGen.

    Args:
        file_path: Path to the local image file.

    Returns:
        Dictionary with the uploaded file_id.
    """
    with open(file_path, "rb") as f:
        response = client.files.upload_file(file=f)

    return {"status": "succeeded", "file_id": response.file_id}
