"use client";

import { useState } from "react";
import LiveTrace, { ToolCall } from "./LiveTrace";
import TestSuite from "./TestSuite";

interface AgentInsightsProps {
  toolCalls: ToolCall[];
}

export default function AgentInsights({ toolCalls }: AgentInsightsProps) {
  const [activeTab, setActiveTab] = useState<"trace" | "tests">("trace");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">Agent Insights</h2>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab("trace")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === "trace"
                ? "bg-white text-teal-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Live Trace
          </button>
          <button
            onClick={() => setActiveTab("tests")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === "tests"
                ? "bg-white text-teal-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Test Suite
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "trace" ? <LiveTrace toolCalls={toolCalls} /> : <TestSuite />}
      </div>
    </div>
  );
}
