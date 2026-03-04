import logging
import os
import sys

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
)

logger = logging.getLogger("clearpath-agent")

ALL_TOOLS = [
    verify_insurance,
    lookup_benefits,
    check_doctor_availability,
    book_appointment,
    escalate_to_human,
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


if __name__ == "__main__":
    agents.cli.run_app(server)
