"use client";

import { useState, useCallback } from "react";
import CallInterface from "@/components/CallInterface";
import AgentInsights from "@/components/AgentInsights";
import { ToolCall } from "@/components/LiveTrace";

export default function Home() {
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);

  const handleToolCall = useCallback((toolCall: ToolCall) => {
    setToolCalls((prev) => [...prev, { ...toolCall, timestamp: Date.now() }]);
  }, []);

  const handleReset = useCallback(() => {
    setToolCalls([]);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col md:flex-row h-screen">
        {/* Left Panel - Call Interface */}
        <div className="w-full md:w-1/2 p-6 md:border-r border-gray-200 flex flex-col min-h-0 overflow-hidden">
          <CallInterface onToolCall={handleToolCall} toolCalls={toolCalls} onReset={handleReset} />
        </div>

        {/* Right Panel - Agent Insights */}
        <div className="w-full md:w-1/2 p-6 bg-gray-50 flex flex-col min-h-0 overflow-hidden">
          <AgentInsights toolCalls={toolCalls} />
        </div>
      </div>
    </div>
  );
}
