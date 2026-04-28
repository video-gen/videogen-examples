"""
AI Image Editor — Gradio chat interface with OpenAI Agents SDK + VideoGen.

Run with: python main.py
"""

import os
import tempfile

from dotenv import load_dotenv

load_dotenv()

import gradio as gr
from agents import Runner

from agent import image_editor_agent
from tools import upload_image


async def respond(message: str, history: list, uploaded_file=None):
    """Handle a chat message, optionally with an uploaded image."""
    context = message

    if uploaded_file is not None:
        result = upload_image(uploaded_file)
        if result["status"] == "succeeded":
            context = (
                f"[User uploaded an image with file_id: {result['file_id']}]\n\n"
                f"{message}"
            )

    # Build conversation history for the agent
    input_messages = []
    for user_msg, assistant_msg in history:
        if user_msg:
            input_messages.append({"role": "user", "content": user_msg})
        if assistant_msg:
            input_messages.append({"role": "assistant", "content": assistant_msg})
    input_messages.append({"role": "user", "content": context})

    result = await Runner.run(
        image_editor_agent,
        input=input_messages,
    )

    return result.final_output


def build_ui():
    """Build the Gradio interface."""
    with gr.Blocks(
        title="AI Image Editor",
        theme=gr.themes.Soft(primary_hue="blue"),
    ) as demo:
        gr.Markdown(
            """
            # AI Image Editor
            Generate, transform, and manipulate images through conversation.
            Powered by [VideoGen API](https://videogen.docs.buildwithfern.com)
            + [OpenAI Agents SDK](https://github.com/openai/openai-agents-python).

            **Try:**
            - "Generate a logo for a coffee shop called Sunrise Beans"
            - "Remove the background from that image"
            - "Vectorize it to SVG"
            - "Upscale the original"
            - "Find the mountain image I made earlier"
            """
        )

        chatbot = gr.Chatbot(height=500)
        with gr.Row():
            msg = gr.Textbox(
                placeholder="Describe what you want to create or edit...",
                scale=4,
                show_label=False,
            )
            upload = gr.File(
                label="Upload image",
                file_types=["image"],
                scale=1,
            )

        async def user_message(message, file, chat_history):
            file_path = file if file else None
            chat_history = chat_history + [[message, None]]
            return "", None, chat_history

        async def bot_response(chat_history, file):
            user_msg = chat_history[-1][0]
            history = chat_history[:-1]
            response = await respond(user_msg, history, file)
            chat_history[-1][1] = response
            return chat_history

        msg.submit(
            user_message,
            [msg, upload, chatbot],
            [msg, upload, chatbot],
        ).then(
            bot_response,
            [chatbot, upload],
            [chatbot],
        )

    return demo


if __name__ == "__main__":
    demo = build_ui()
    demo.launch(server_name="0.0.0.0", server_port=7860)
