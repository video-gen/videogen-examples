"""
AI Image Editor agent — uses the OpenAI Agents SDK with VideoGen tools.
"""

from agents import Agent, function_tool

from tools import (
    generate_image,
    transform_image,
    vectorize_image,
    remove_background,
    upscale_image,
    search_files,
    upload_image,
)


@function_tool
def tool_generate_image(prompt: str) -> dict:
    """Generate an image from a detailed text prompt. Use for creating new images from scratch."""
    return generate_image(prompt)


@function_tool
def tool_transform_image(file_id: str, prompt: str) -> dict:
    """Transform an existing image using a text prompt. Provide the file_id of the source image and a description of how to change it."""
    return transform_image(file_id, prompt)


@function_tool
def tool_vectorize_image(file_id: str) -> dict:
    """Convert a raster image (PNG/JPG) into SVG vector format. Provide the file_id of the image."""
    return vectorize_image(file_id)


@function_tool
def tool_remove_background(file_id: str) -> dict:
    """Remove the background from an image, leaving only the subject on a transparent background. Provide the file_id."""
    return remove_background(file_id)


@function_tool
def tool_upscale_image(file_id: str) -> dict:
    """Upscale an image to higher resolution. Provide the file_id of the image to upscale."""
    return upscale_image(file_id)


@function_tool
def tool_search_files(query: str) -> dict:
    """Search for previously generated images by description. Use to find images created earlier in the conversation or in past sessions."""
    return search_files(query)


image_editor_agent = Agent(
    name="AI Image Editor",
    instructions="""You are an AI image editor powered by VideoGen. You can:

1. **Generate** new images from text descriptions
2. **Transform** existing images with text prompts (style transfer, edits, variations)
3. **Vectorize** raster images to SVG format
4. **Remove backgrounds** from images
5. **Upscale** images to higher resolution
6. **Search** for previously generated images

When the user asks you to do something with an image:
- If they reference a previous image, use the file_id from that result
- If they upload an image, it will be provided as a file_id
- Always show the resulting image URL in your response
- You can chain operations: generate → remove background → vectorize
- Remember file_ids from this conversation for follow-up requests

Keep responses concise. Show the image URL so the user can see the result.""",
    tools=[
        tool_generate_image,
        tool_transform_image,
        tool_vectorize_image,
        tool_remove_background,
        tool_upscale_image,
        tool_search_files,
    ],
)
