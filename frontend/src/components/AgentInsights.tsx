"use client";

import { useState } from "react";
import LiveTrace, { ToolCall } from "./LiveTrace";
import TestSuite from "./TestSuite";
import EvalResults from "./EvalResults";

interface AgentInsightsProps {
  toolCalls: ToolCall[];
}

export default function AgentInsights({ toolCalls }: AgentInsightsProps) {
  const [activeTab, setActiveTab] = useState<"trace" | "tests" | "evals">("trace");

  const tabs = [
    { key: "trace" as const, label: "Live Trace" },
    { key: "tests" as const, label: "Test Suite" },
    { key: "evals" as const, label: "Eval Results" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">Agent Insights</h2>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.key
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "trace" ? (
          <LiveTrace toolCalls={toolCalls} />
        ) : activeTab === "tests" ? (
          <TestSuite />
        ) : (
          <EvalResults />
        )}
      </div>
    </div>
  );
}
