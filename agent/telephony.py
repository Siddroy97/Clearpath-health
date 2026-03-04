"""Twilio SIP telephony webhook server.

Runs a lightweight FastAPI app on port 8080 that handles inbound calls
from a Twilio phone number and routes them into a LiveKit room via SIP.
"""

import logging
import os

from fastapi import FastAPI, Form, Response

logger = logging.getLogger("clearpath-telephony")

app = FastAPI(title="ClearPath Telephony Webhook")


@app.post("/incoming-call")
async def incoming_call(
    CallSid: str = Form(""),
    From: str = Form(""),
    To: str = Form(""),
):
    """Handle inbound Twilio calls by returning TwiML that bridges to LiveKit via SIP."""
    logger.info(f"Incoming call — SID: {CallSid}, From: {From}, To: {To}")

    livekit_url = os.environ.get("LIVEKIT_URL", "")
    sip_trunk_id = os.environ.get("LIVEKIT_SIP_TRUNK_ID", "")

    # Build the SIP URI for LiveKit
    # The LiveKit SIP trunk will route this into the "clearpath-demo" room
    livekit_host = livekit_url.replace("wss://", "").replace("ws://", "")
    sip_uri = f"sip:{sip_trunk_id}@{livekit_host}"

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Please wait while we connect you to your ClearPath Health assistant.</Say>
    <Dial>
        <Sip>{sip_uri}</Sip>
    </Dial>
</Response>"""

    return Response(content=twiml, media_type="application/xml")


@app.post("/call-status")
async def call_status(
    CallSid: str = Form(""),
    CallStatus: str = Form(""),
    From: str = Form(""),
    To: str = Form(""),
):
    """Log Twilio call status updates."""
    logger.info(f"Call status update — SID: {CallSid}, Status: {CallStatus}, From: {From}, To: {To}")
    return {"status": "ok"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "service": "clearpath-telephony"}
