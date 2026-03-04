import asyncio
import logging
import os
import sys
import threading

from dotenv import load_dotenv

# Allow running as `python agent/main.py dev` from the project root
_agent_dir = os.path.dirname(os.path.abspath(__file__))
_project_dir = os.path.dirname(_agent_dir)

# Use absolute path so child processes spawned by LiveKit also pick up .env
load_dotenv(os.path.join(_project_dir, ".env"), override=True)
if _project_dir not in sys.path:
    sys.path.insert(0, _project_dir)

from livekit import agents
from livekit.agents import Agent, AgentSession, AgentServer
from livekit.plugins import anthropic, deepgram, elevenlabs, silero

from agent.prompts import SYSTEM_PROMPT
from agent.tools import (
    verify_insurance,
    lookup_benefits,
    check_doctor_availability,
    book_appointment,
    escalate_to_human,
    lookup_ehr_history,
)

logger = logging.getLogger("clearpath-agent")

ALL_TOOLS = [
    verify_insurance,
    lookup_benefits,
    check_doctor_availability,
    book_appointment,
    escalate_to_human,
    lookup_ehr_history,
]


class AriaAgent(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=SYSTEM_PROMPT,
            tools=ALL_TOOLS,
        )

    async def on_enter(self) -> None:
        await self.session.generate_reply(
            instructions=(
                "Greet the caller by saying: Thank you for calling ClearPath Health. "
                "My name is Aria, your AI health assistant. How can I help you today?"
            ),
        )


server = AgentServer()


@server.rtc_session(agent_name="clearpath-health-agent")
async def entrypoint(ctx: agents.JobContext):
    session = AgentSession(
        stt=deepgram.STT(model="nova-3", language="en"),
        llm=anthropic.LLM(
            model="claude-haiku-4-5-20251001",
            temperature=0.7,
        ),
        tts=elevenlabs.TTS(
            voice_id="21m00Tcm4TlvDq8ikWAM",  # Rachel
        ),
        vad=silero.VAD.load(),
    )

    await session.start(
        room=ctx.room,
        agent=AriaAgent(),
    )


def _run_telephony_server():
    """Start the FastAPI telephony webhook server in a background thread."""
    import uvicorn
    from agent.telephony import app as telephony_app

    logger.info("Starting telephony webhook server on port 8080")
    uvicorn.run(telephony_app, host="0.0.0.0", port=8080, log_level="info")


if __name__ == "__main__":
    # Start the telephony webhook server in a daemon thread so it
    # runs alongside the LiveKit agent worker without blocking it
    telephony_thread = threading.Thread(target=_run_telephony_server, daemon=True)
    telephony_thread.start()

    agents.cli.run_app(server)
