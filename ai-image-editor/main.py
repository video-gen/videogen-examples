"""
AI Image Editor — Gradio chat interface with OpenAI Agents SDK + VideoGen.

Run with: python main.py
"""

from dotenv import load_dotenv

load_dotenv()

import gradio as gr
from agents import Runner

from agent import image_editor_agent
from tools import upload_image


def _plain_text_from_gradio_content(value: object) -> str:
    """Gradio Chatbot normalizes text to ``[{"type": "text", "text": "..."}]``.
    OpenAI Responses rejects ``type: "text"`` for API input; agents expect plain strings.
    """
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text_val = item.get("text")
                if isinstance(text_val, str):
                    parts.append(text_val)
        return "".join(parts)
    if isinstance(value, dict):
        text_val = value.get("text")
        if isinstance(text_val, str):
            return text_val
    return str(value)


async def respond(message: str, history: list, uploaded_file=None):
    """Handle a chat message, optionally with an uploaded image.

    ``history`` is Gradio 6 chat history: a list of ``{"role","content"}`` dicts
    (prior turns only; the current user turn is passed as ``message``).
    """
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
    for msg in history:
        if not isinstance(msg, dict):
            continue
        role = msg.get("role")
        raw_content = msg.get("content")
        if role not in ("user", "assistant"):
            continue
        if raw_content is None:
            continue
        plain = _plain_text_from_gradio_content(raw_content)
        if plain == "":
            continue
        input_messages.append({"role": role, "content": plain})

    input_messages.append({"role": "user", "content": context})

    result = await Runner.run(
        image_editor_agent,
        input=input_messages,
    )

    return result.final_output


def build_ui():
    """Build the Gradio interface."""
    with gr.Blocks(title="AI Image Editor") as demo:
        gr.Markdown(
            """
            # AI Image Editor
            Generate, transform, and manipulate images through conversation.
            Powered by [VideoGen API](https://docs.videogen.io)
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

        pending_upload = gr.State(None)

        async def user_message(message, file, chat_history):
            chat_history = chat_history + [
                {"role": "user", "content": message},
            ]
            return "", None, chat_history, file

        async def bot_response(chat_history, file):
            last_turn = chat_history[-1]
            raw_user = (
                last_turn.get("content")
                if isinstance(last_turn, dict) and last_turn.get("role") == "user"
                else ""
            )
            user_msg = _plain_text_from_gradio_content(raw_user)
            history = chat_history[:-1]
            response = await respond(user_msg, history, file)
            response_str = (
                response if isinstance(response, str) else str(response)
            )
            out_history = chat_history + [
                {"role": "assistant", "content": response_str},
            ]
            return out_history, None

        msg.submit(
            user_message,
            [msg, upload, chatbot],
            [msg, upload, chatbot, pending_upload],
        ).then(
            bot_response,
            [chatbot, pending_upload],
            [chatbot, pending_upload],
        )

    return demo


if __name__ == "__main__":
    demo = build_ui()
    demo.queue()
    demo.launch(
        server_name="0.0.0.0",
        server_port=7860,
        theme=gr.themes.Soft(primary_hue="blue"),
    )
