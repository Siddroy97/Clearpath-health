# ClearPath Health Agent

A LiveKit-powered voice AI agent for ClearPath Health. The agent ("Aria") helps members with insurance verification, benefits lookup, appointment scheduling, and escalation to human agents.

## Stack

- **Orchestration**: LiveKit Agents SDK (Python)
- **LLM**: Claude Haiku 4.5 via Anthropic
- **STT**: Deepgram Nova-3
- **TTS**: ElevenLabs (Rachel voice)
- **VAD**: Silero

## Setup

1. Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Run the agent in development mode:

```bash
python -m agent.main dev
```

## Tools

| Tool | Description |
|------|-------------|
| `verify_insurance` | Check if an insurance provider is accepted |
| `lookup_benefits` | Look up deductible, copay, or visit benefits for a member |
| `check_doctor_availability` | Search for available appointment slots |
| `book_appointment` | Book an appointment and get a confirmation number |
| `escalate_to_human` | Transfer the call to a human agent |

## Testing with LiveKit

Connect to the agent using the [LiveKit Agents Playground](https://agents-playground.livekit.io/) or any LiveKit-compatible client.
