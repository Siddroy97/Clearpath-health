"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useParticipants,
  useTracks,
} from "@livekit/components-react";
import { RoomEvent, Track } from "livekit-client";
import WaveformVisualizer from "./WaveformVisualizer";
import { ToolCall } from "./LiveTrace";

interface TranscriptEntry {
  role: "agent" | "user";
  text: string;
  timestamp: Date;
}

type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected";

interface CallInterfaceProps {
  onToolCall: (toolCall: ToolCall) => void;
  toolCalls: ToolCall[];
  onReset: () => void;
}

/* ─── Controls rendered INSIDE LiveKitRoom ─── */
function RoomControls({
  onToolCall,
  onDisconnect,
  setTranscript,
}: {
  onToolCall: (toolCall: ToolCall) => void;
  onDisconnect: () => void;
  setTranscript: React.Dispatch<React.SetStateAction<TranscriptEntry[]>>;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const agentTracks = useTracks([Track.Source.Microphone], {
    onlySubscribed: true,
  });
  // Track seen segment IDs to prevent duplicate transcript entries
  const seenSegmentIds = useRef<Set<string>>(new Set());

  const agentConnected = participants.some((p) => p.identity.startsWith("agent"));
  const agentSpeaking = agentTracks.some(
    (t) => t.participant.isSpeaking && t.participant.identity.startsWith("agent")
  );

  const status = !agentConnected
    ? "Connecting..."
    : agentSpeaking
    ? "Aria is speaking..."
    : "Listening...";

  // Listen for data messages (tool calls from agent)
  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);
        if (data.type === "tool_call") {
          onToolCall(data as ToolCall);
        }
      } catch {
        // ignore non-JSON data
      }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, onToolCall]);

  // Listen for transcription events — deduplicate by segment ID
  useEffect(() => {
    const handleTranscription = (
      segments: Array<{ id?: string; text: string; final: boolean }>,
      participant: { identity: string } | undefined,
    ) => {
      for (const segment of segments) {
        if (!segment.final || !segment.text.trim()) continue;
        // Each segment has a unique ID — skip if we've already rendered it
        const segId = segment.id ?? segment.text;
        if (seenSegmentIds.current.has(segId)) continue;
        seenSegmentIds.current.add(segId);
        const role = participant?.identity.startsWith("agent") ? "agent" : "user";
        setTranscript((prev) => [
          ...prev,
          { role: role as "agent" | "user", text: segment.text, timestamp: new Date() },
        ]);
      }
    };
    room.on(RoomEvent.TranscriptionReceived, handleTranscription);
    return () => { room.off(RoomEvent.TranscriptionReceived, handleTranscription); };
  }, [room, setTranscript]);

  return (
    <>
      <RoomAudioRenderer />

      {/* Call controls */}
      <div className="flex flex-col items-center py-6 space-y-4">
        <button
          onClick={onDisconnect}
          className="relative w-24 h-24 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-red-500 hover:bg-red-600 active:scale-95 transition-all duration-300 shadow-lg"
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
          </svg>
        </button>

        <WaveformVisualizer active={agentSpeaking} />

        {/* Status */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-gray-500">{status}</span>
        </div>
      </div>
    </>
  );
}

/* ─── Tool color map for summary badges ─── */
const TOOL_BADGE_COLORS: Record<string, string> = {
  verify_insurance: "bg-blue-100 text-blue-700",
  lookup_benefits: "bg-purple-100 text-purple-700",
  check_availability: "bg-amber-100 text-amber-700",
  check_doctor_availability: "bg-amber-100 text-amber-700",
  book_appointment: "bg-green-100 text-green-700",
  get_member_info: "bg-pink-100 text-pink-700",
  escalate_emergency: "bg-red-100 text-red-700",
  escalate_to_human: "bg-red-100 text-red-700",
  lookup_ehr_history: "bg-indigo-100 text-indigo-700",
};

/* ─── Main exported component ─── */
export default function CallInterface({ onToolCall, toolCalls, onReset }: CallInterfaceProps) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string>("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [callEndTime, setCallEndTime] = useState<number | null>(null);
  const [browserWarning, setBrowserWarning] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const isConnected = connectionStatus === "connected";

  // Browser compatibility check
  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent;
      const isChrome = /Chrome/.test(ua) && !/Edg/.test(ua);
      const isFirefox = /Firefox/.test(ua);
      if (!isChrome && !isFirefox) {
        setBrowserWarning("For the best experience, please use Chrome or Firefox.");
      }
    }
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const handleConnect = useCallback(async () => {
    setMicError(null);
    setConnectionStatus("connecting");

    // Request mic permission explicitly
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch {
      setMicError(
        "Microphone access is required for voice calls. Please allow microphone access in your browser settings and try again."
      );
      setConnectionStatus("idle");
      return;
    }

    try {
      const res = await fetch("/api/token");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get token");
      setToken(data.token);
      setLivekitUrl(data.url);
      setTranscript([]);
      setCallStartTime(Date.now());
      setCallEndTime(null);
      setConnectionStatus("connected");
    } catch (err) {
      console.error("Failed to connect:", err);
      setConnectionStatus("idle");
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setToken(null);
    setLivekitUrl("");
    setCallEndTime(Date.now());
    setConnectionStatus("disconnected");
  }, []);

  const handleNewCall = useCallback(() => {
    setConnectionStatus("idle");
    setTranscript([]);
    setCallStartTime(null);
    setCallEndTime(null);
    setMicError(null);
    onReset();
  }, [onReset]);

  // Summary calculations
  const callDurationSecs =
    callEndTime && callStartTime ? Math.floor((callEndTime - callStartTime) / 1000) : 0;
  const durationMin = Math.floor(callDurationSecs / 60);
  const durationSec = callDurationSecs % 60;
  const durationStr = durationMin > 0 ? `${durationMin}m ${durationSec}s` : `${durationSec}s`;
  const uniqueTools = Array.from(new Set(toolCalls.map((tc) => tc.tool)));

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-teal-700 tracking-tight">ClearPath Health</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your AI Health Assistant</p>
      </div>

      {/* Browser compatibility warning */}
      {browserWarning && (
        <div className="mb-4 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
          <svg className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-yellow-800">{browserWarning}</p>
        </div>
      )}

      {/* Microphone permission error */}
      {micError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <svg className="w-5 h-5 text-red-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <p className="text-sm text-red-800">{micError}</p>
        </div>
      )}

      {isConnected && token && livekitUrl ? (
        /* Connected → render inside LiveKitRoom */
        <LiveKitRoom
          serverUrl={livekitUrl}
          token={token}
          connect={true}
          audio={true}
          video={false}
          onDisconnected={handleDisconnect}
          className="flex flex-col"
        >
          <RoomControls
            onToolCall={onToolCall}
            onDisconnect={handleDisconnect}
            setTranscript={setTranscript}
          />
        </LiveKitRoom>
      ) : connectionStatus === "disconnected" ? (
        /* Call ended → show summary */
        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Call Summary
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Duration</p>
              <p className="text-sm font-medium text-gray-800">{durationStr}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Turns</p>
              <p className="text-sm font-medium text-gray-800">{transcript.length}</p>
            </div>
          </div>
          {uniqueTools.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5">
                Tools Used
              </p>
              <div className="flex flex-wrap gap-1.5">
                {uniqueTools.map((tool) => (
                  <span
                    key={tool}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      TOOL_BADGE_COLORS[tool] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={handleNewCall}
            className="w-full mt-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
          >
            Start New Call
          </button>
        </div>
      ) : (
        /* Idle / Connecting */
        <div className="flex flex-col items-center py-6 space-y-4">
          <button
            onClick={handleConnect}
            disabled={connectionStatus === "connecting"}
            className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white font-semibold text-sm transition-all duration-300 shadow-lg ${
              connectionStatus === "connecting"
                ? "bg-yellow-500 cursor-wait"
                : "bg-green-500 hover:bg-green-600 active:scale-95 call-button-pulse"
            }`}
          >
            {connectionStatus === "connecting" ? (
              <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C8.716 21 3 15.284 3 7V5z" />
              </svg>
            )}
          </button>

          <WaveformVisualizer active={false} />

          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connectionStatus === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-gray-300"
              }`}
            />
            <span className="text-sm text-gray-500">
              {connectionStatus === "connecting" ? "Connecting..." : "Ready to connect"}
            </span>
          </div>
        </div>
      )}

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto custom-scrollbar border border-gray-200 rounded-lg bg-white p-3 space-y-2 min-h-[200px]">
        {transcript.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            {connectionStatus === "connected"
              ? "Conversation will appear here..."
              : "Start a call to begin"}
          </p>
        ) : (
          transcript.map((entry, index) => (
            <div key={index} className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  entry.role === "agent" ? "bg-teal-50 text-gray-800" : "bg-gray-100 text-gray-800"
                }`}
              >
                <p className="text-sm">{entry.text}</p>
                <p className="text-[10px] text-gray-400 mt-1">{formatTime(entry.timestamp)}</p>
              </div>
            </div>
          ))
        )}
        <div ref={transcriptEndRef} />
      </div>

      {/* HIPAA Notice */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-[11px] text-gray-400 text-center">
          This is a demo. Do not share real PHI.
        </p>
      </div>
    </div>
  );
}
