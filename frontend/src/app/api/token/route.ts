import { AccessToken, AgentDispatchClient } from "livekit-server-sdk";
import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json(
      { error: "LiveKit credentials not configured" },
      { status: 500 }
    );
  }

  const roomName = "clearpath-demo";
  const participantIdentity = `patient-${Math.random().toString(36).substring(2, 8)}`;

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  // Explicitly dispatch the agent to the room
  try {
    const httpUrl = livekitUrl.replace("wss://", "https://");
    const dispatch = new AgentDispatchClient(httpUrl, apiKey, apiSecret);
    await dispatch.createDispatch(roomName, "clearpath-health-agent");
  } catch (err) {
    console.error("Agent dispatch failed (agent may not be running):", err);
    // Don't block the token response — the agent may join via auto-dispatch
  }

  return NextResponse.json({
    token,
    url: livekitUrl,
    room: roomName,
    identity: participantIdentity,
  });
}
