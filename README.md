# ClearPath Health Agent

ClearPath Health Agent is a real-time voice AI assistant ("Aria") that helps health insurance members verify coverage, look up benefits, find doctors, schedule appointments, and escalate to human agents -- all through a natural phone conversation powered by LiveKit, Claude, and ElevenLabs.

## Stack

| Layer | Technology |
|-------|------------|
| **Orchestration** | LiveKit Agents SDK (Python) |
| **LLM** | Claude Haiku 4.5 via Anthropic |
| **STT** | Deepgram Nova-3 |
| **TTS** | ElevenLabs (Rachel voice) |
| **VAD** | Silero |
| **Frontend** | Next.js 14 + Tailwind CSS |
| **Appointment Storage** | Google Sheets API (gspread) |
| **SMS** | Twilio REST API |
| **Telephony** | Twilio SIP + LiveKit SIP trunk |
| **EHR** | Mock MediTrack EHR v2.3 integration |

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd clearpath-health-agent

# Backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
cd ..
```

### 2. Configure environment variables

Copy the example files and fill in your keys:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

#### Backend `.env`

| Variable | Where to get it |
|----------|----------------|
| `LIVEKIT_URL` | [LiveKit Cloud dashboard](https://cloud.livekit.io/) > Project Settings |
| `LIVEKIT_API_KEY` | LiveKit Cloud dashboard > Project Settings > Keys |
| `LIVEKIT_API_SECRET` | LiveKit Cloud dashboard > Project Settings > Keys |
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com/) > API Keys |
| `DEEPGRAM_API_KEY` | [Deepgram Console](https://console.deepgram.com/) > API Keys |
| `ELEVENLABS_API_KEY` | [ElevenLabs](https://elevenlabs.io/) > Profile > API Keys |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Path to your Google Cloud service account JSON file (for Sheets logging) |
| `GOOGLE_SHEET_ID` | ID from your Google Sheet URL: `docs.google.com/spreadsheets/d/<THIS_ID>/edit` |
| `TWILIO_ACCOUNT_SID` | [Twilio Console](https://console.twilio.com/) > Account Info |
| `TWILIO_AUTH_TOKEN` | Twilio Console > Account Info |
| `TWILIO_FROM_NUMBER` | A Twilio phone number you purchased (E.164 format, e.g. `+15551234567`) |
| `TWILIO_ENABLED` | `true` to enable SMS confirmations, `false` to skip |
| `PATIENT_PHONE_NUMBER` | The demo recipient phone number for SMS (E.164 format) |
| `LIVEKIT_SIP_TRUNK_ID` | LiveKit Cloud dashboard > SIP Trunks (only needed for inbound phone calls) |

#### Frontend `frontend/.env.local`

| Variable | Where to get it |
|----------|----------------|
| `NEXT_PUBLIC_LIVEKIT_URL` | Same `LIVEKIT_URL` from backend (e.g. `wss://your-project.livekit.cloud`) |
| `LIVEKIT_API_KEY` | Same key as backend |
| `LIVEKIT_API_SECRET` | Same secret as backend |

## Running Locally

Start both services in separate terminals:

```bash
# Terminal 1 - Agent (starts LiveKit worker + telephony webhook on port 8080)
python -m agent.main dev

# Terminal 2 - Frontend (starts Next.js on port 3000)
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click the green call button to start a conversation with Aria.

## Deployment

### Deploy the LiveKit Agent to LiveKit Cloud

1. Install the [LiveKit CLI](https://docs.livekit.io/home/cli/cli-setup/):
   ```bash
   # macOS
   brew install livekit-cli
   ```

2. Authenticate with LiveKit Cloud:
   ```bash
   lk cloud auth
   ```

3. Set your environment variables in the LiveKit Cloud dashboard under your project's agent settings, or pass them during deploy.

4. Deploy:
   ```bash
   lk cloud deploy --agent-name clearpath-health-agent
   ```

   This builds the Docker image from the `Dockerfile` and deploys it to LiveKit Cloud.

### Deploy the Frontend to Vercel

1. Install the [Vercel CLI](https://vercel.com/docs/cli):
   ```bash
   npm i -g vercel
   ```

2. From the `frontend/` directory:
   ```bash
   cd frontend
   vercel
   ```

3. Set environment variables in the Vercel dashboard (or via CLI):
   ```bash
   vercel env add NEXT_PUBLIC_LIVEKIT_URL
   vercel env add LIVEKIT_API_KEY
   vercel env add LIVEKIT_API_SECRET
   ```

4. Deploy to production:
   ```bash
   vercel --prod
   ```

The `/api/token` route runs as a Vercel serverless function automatically.

### Required Vercel Environment Variables

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_LIVEKIT_URL` | Your LiveKit Cloud WebSocket URL (e.g. `wss://your-project.livekit.cloud`) |
| `LIVEKIT_API_KEY` | Your LiveKit API key |
| `LIVEKIT_API_SECRET` | Your LiveKit API secret |

## Agent Capabilities

Aria has six tools available during conversation:

| Tool | Description |
|------|-------------|
| **`verify_insurance`** | Checks whether a caller's insurance provider (e.g. Blue Cross, Aetna, Cigna) is accepted by the network. Uses fuzzy matching to handle variations in how callers say their plan name. |
| **`lookup_benefits`** | Retrieves a member's benefit details -- deductible remaining, copay amounts, physical therapy sessions, and mental health visit limits. Requires a valid member ID. |
| **`check_doctor_availability`** | Searches for available appointment slots by doctor name or specialty (Primary Care, Cardiology, Physical Therapy). Returns doctor info, locations, and open time slots. |
| **`book_appointment`** | Books an appointment for a member with a specific doctor and time slot. Generates a confirmation number, logs the appointment to Google Sheets, and sends an SMS confirmation via Twilio. |
| **`escalate_to_human`** | Transfers the call to a human agent when the caller is frustrated, confused, or has a request outside Aria's scope. Also triggered by emergency keywords (chest pain, stroke, etc.). |
| **`lookup_ehr_history`** | Queries the mock MediTrack EHR system for a patient's visit history, conditions, medications, and allergies. Simulates real-world EHR reliability issues (25% timeout, 15% malformed data) to test graceful degradation. |

## Eval Dashboard

The right-hand "Agent Insights" panel has three tabs:

### Live Trace
Real-time tool call log streamed from the agent via LiveKit data messages. Shows tool name, inputs, outputs, and latency for every call in the active conversation.

### Test Suite
12 quick eval scenarios that run against the `/api/eval` endpoint (Claude Haiku + mock tools). Covers happy path, edge cases, and safety/compliance. Click **Run Tests** to execute all scenarios.

### Eval Results (LLM-as-Judge)
A comprehensive 20-test evaluation suite scored by Claude Sonnet across 5 dimensions. Click **Re-run Evals** to execute. The `POST /api/eval/run` route runs all tests and saves the report to `eval/latest_report.json`; subsequent page loads fetch the cached report via `GET /api/eval/run`.

#### Running Evals Locally (Python CLI)

```bash
# Run all 20 tests
python -m agent.eval run

# Run a specific category
python -m agent.eval run --category safety_critical

# Run a single test
python -m agent.eval run --id SC001

# Save a named run for comparison
python -m agent.eval run --save-as run_001.json

# Compare two runs
python -m agent.eval compare eval/run_001.json eval/run_002.json
```

#### Eval Results — Before and After Prompt Fix

**Run 001** (baseline — `run_001.json`): 17/20 passing (85%)

| Category | Pass Rate |
|---|---|
| Happy Path | 5/5 (100%) |
| Edge Cases | 5/5 (100%) |
| Adversarial | 3/5 (60%) |
| Safety Critical | 4/5 (80%) |

Failures:
- **AD002** — Agent responded in Spanish when caller spoke Spanish (no English-only rule)
- **AD003** — Test criteria matched a natural refusal phrase incorrectly (criteria too strict)
- **SC005** — Test expected `null` tool but escalation is the correct behavior

**Run 002** (after fixes — `run_002.json`): 20/20 passing (100%)

| Category | Pass Rate |
|---|---|
| Happy Path | 5/5 (100%) |
| Edge Cases | 5/5 (100%) |
| Adversarial | 5/5 (100%) |
| Safety Critical | 5/5 (100%) |

Changes made:
- Added "Always respond in English" rule to `agent/prompts.py`
- Relaxed keyword criteria for AD003 (refusal phrasing is flexible)
- Fixed SC005 `expected_tool` to `escalate_to_human` (the correct behavior)

Dimension averages after fix: Accuracy 5.0 · Safety 5.0 · Containment 5.0 · Conciseness 4.2 · Flow 4.85

## Setting Up Inbound Phone Calls

1. Buy a Twilio phone number from the [Twilio Console](https://console.twilio.com/)
2. Set the voice webhook URL to `https://[your-deployed-url]/incoming-call` (HTTP POST)
3. Set the status callback URL to `https://[your-deployed-url]/call-status` (HTTP POST)
4. Set `TWILIO_FROM_NUMBER` to that number in `.env`
5. Create a SIP trunk in the [LiveKit Cloud dashboard](https://cloud.livekit.io/) and set `LIVEKIT_SIP_TRUNK_ID` in `.env`
6. When someone calls the number, Aria answers

## Integrations

In production, these mock integrations would connect to:

- **Google Sheets** -> a live EHR/PMS like Epic, Athena, or Tebra
- **Twilio SMS** -> the health plan's patient communication platform
- **Twilio SIP** -> the clinic's existing phone/IVR system
- **MediTrack mock** -> Epic FHIR R4 API or Availity
