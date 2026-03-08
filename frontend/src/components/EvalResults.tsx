"use client";

import { useState, useCallback } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

interface EvalScores {
  accuracy: number;
  safety: number;
  containment: number;
  conciseness: number;
  flow: number;
}

interface EvalFailure {
  id: string;
  name: string;
  category: string;
  prompt: string;
  response_snippet: string;
  reasoning: string;
  scores: EvalScores;
}

interface CategoryBreakdown {
  passed: number;
  total: number;
  pass_rate: number;
}

interface EvalResult {
  id: string;
  name: string;
  category: string;
  prompt: string;
  response: string;
  tools_called: { name: string; input: Record<string, unknown>; output: string }[];
  latency_ms: number;
  keyword_pass: boolean;
  judge: {
    passed: boolean;
    scores: EvalScores;
    reasoning: string;
  };
}

interface TokenUsage {
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
}

interface EvalReport {
  timestamp: string;
  model: string;
  judge_model: string;
  total_tests: number;
  passed: number;
  failed: number;
  pass_rate: number;
  token_usage?: TokenUsage;
  category_breakdown: Record<string, CategoryBreakdown>;
  dimension_averages: EvalScores;
  failures: EvalFailure[];
  recommendations: string[];
  results: EvalResult[];
}

const CATEGORY_LABELS: Record<string, string> = {
  happy_path: "Happy Path",
  edge_case: "Edge Cases",
  adversarial: "Adversarial",
  safety_critical: "Safety Critical",
};

const CATEGORY_COLORS: Record<string, string> = {
  happy_path: "bg-green-100 text-green-700 border-green-200",
  edge_case: "bg-amber-100 text-amber-700 border-amber-200",
  adversarial: "bg-purple-100 text-purple-700 border-purple-200",
  safety_critical: "bg-red-100 text-red-700 border-red-200",
};

const TOOL_BADGE_COLORS: Record<string, string> = {
  verify_insurance: "bg-blue-100 text-blue-700",
  lookup_benefits: "bg-purple-100 text-purple-700",
  check_doctor_availability: "bg-amber-100 text-amber-700",
  book_appointment: "bg-green-100 text-green-700",
  escalate_to_human: "bg-red-100 text-red-700",
  lookup_ehr_history: "bg-pink-100 text-pink-700",
};

function PassRateRing({ rate, size = 80 }: { rate: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (rate / 100) * circumference;
  const color = rate >= 90 ? "#10b981" : rate >= 70 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>
          {rate}%
        </span>
      </div>
    </div>
  );
}

export default function EvalResults() {
  const [report, setReport] = useState<EvalReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());

  const runEvals = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/eval/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Eval run failed");
        return;
      }
      setReport(data);
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setRunning(false);
    }
  }, []);

  const loadLatest = useCallback(async () => {
    try {
      const res = await fetch("/api/eval/run");
      if (res.ok) {
        const data = await res.json();
        if (data && data.total_tests) {
          setReport(data);
        }
      }
    } catch {
      // No cached report
    }
  }, []);

  // Load cached report on first render
  useState(() => {
    loadLatest();
  });

  const toggleExpand = (id: string) => {
    setExpandedTests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!report && !running && !error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-teal-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">LLM-as-Judge Evaluations</h3>
        <p className="text-xs text-gray-500 mb-4 max-w-xs">
          Run 20 test cases scored by Claude Sonnet across 5 dimensions: accuracy, safety,
          containment, conciseness, and flow.
        </p>
        <button
          onClick={runEvals}
          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
        >
          Run Evals
        </button>
      </div>
    );
  }

  const radarData = report
    ? [
        { dimension: "Accuracy", value: report.dimension_averages.accuracy, fullMark: 5 },
        { dimension: "Safety", value: report.dimension_averages.safety, fullMark: 5 },
        { dimension: "Containment", value: report.dimension_averages.containment, fullMark: 5 },
        { dimension: "Conciseness", value: report.dimension_averages.conciseness, fullMark: 5 },
        { dimension: "Flow", value: report.dimension_averages.flow, fullMark: 5 },
      ]
    : [];

  return (
    <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar">
      {/* Header + Run button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={runEvals}
            disabled={running}
            className="px-3 py-1.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {running ? "Running..." : "Re-run Evals"}
          </button>
          {report && (
            <span className="text-[10px] text-gray-400">
              {new Date(report.timestamp).toLocaleString()}
            </span>
          )}
        </div>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>

      {running && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-700 animate-pulse">
            Running 21 evaluations in parallel with LLM judge... This takes ~15 seconds.
          </p>
        </div>
      )}

      {report && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
                Overall
              </p>
              <div className="flex justify-center">
                <PassRateRing rate={report.pass_rate} />
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                {report.passed}/{report.total_tests} passing
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
                Safety Critical
              </p>
              <div className="flex justify-center">
                <PassRateRing
                  rate={report.category_breakdown.safety_critical?.pass_rate ?? 0}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                {report.category_breakdown.safety_critical?.passed ?? 0}/
                {report.category_breakdown.safety_critical?.total ?? 0}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
                Avg Latency
              </p>
              <p className="text-2xl font-bold text-gray-800 mt-2">
                {Math.round(
                  report.results.reduce((s, r) => s + r.latency_ms, 0) / report.results.length
                )}
                <span className="text-xs font-normal text-gray-400">ms</span>
              </p>
            </div>
          </div>

          {/* Token Usage */}
          {report.token_usage && (
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">
                Token Usage &amp; Cost
              </p>
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-800">
                    {(report.token_usage.total_input_tokens / 1000).toFixed(1)}
                    <span className="text-[10px] font-normal text-gray-400">k</span>
                  </p>
                  <p className="text-[10px] text-gray-500">Input</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-800">
                    {(report.token_usage.total_output_tokens / 1000).toFixed(1)}
                    <span className="text-[10px] font-normal text-gray-400">k</span>
                  </p>
                  <p className="text-[10px] text-gray-500">Output</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-800">
                    {(report.token_usage.total_tokens / 1000).toFixed(1)}
                    <span className="text-[10px] font-normal text-gray-400">k</span>
                  </p>
                  <p className="text-[10px] text-gray-500">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-teal-600">
                    ${report.token_usage.estimated_cost_usd.toFixed(4)}
                  </p>
                  <p className="text-[10px] text-gray-500">Est. Cost</p>
                </div>
              </div>
              <p className="text-[9px] text-gray-400 mt-2 text-right">
                Haiku pricing · $0.80/M input · $4.00/M output
              </p>
            </div>
          )}

          {/* Radar chart */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">
              Dimension Scores (1-5)
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis
                  dataKey="dimension"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 5]}
                  tick={{ fontSize: 9, fill: "#9ca3af" }}
                  tickCount={6}
                />
                <Radar
                  name="Score"
                  dataKey="value"
                  stroke="#0d9488"
                  fill="#0d9488"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Category breakdown */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">
              Category Breakdown
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(report.category_breakdown).map(([cat, info]) => (
                <div
                  key={cat}
                  className={`rounded-lg border px-3 py-2 ${CATEGORY_COLORS[cat] || "bg-gray-50 text-gray-700 border-gray-200"}`}
                >
                  <p className="text-xs font-semibold">{CATEGORY_LABELS[cat] || cat}</p>
                  <p className="text-lg font-bold">
                    {info.passed}/{info.total}
                  </p>
                  <p className="text-[10px] opacity-70">{info.pass_rate}% pass rate</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold mb-1">
                Recommendations
              </p>
              <ul className="space-y-1">
                {report.recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-amber-800">
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Test results table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                All Test Results ({report.total_tests})
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {report.results.map((r) => (
                <div key={r.id}>
                  <div
                    className="px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleExpand(r.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${r.judge.passed ? "bg-green-500" : "bg-red-500"}`}
                        />
                        <span className="text-xs font-mono text-gray-400 shrink-0">
                          {r.id}
                        </span>
                        <span className="text-xs font-medium text-gray-700 truncate">
                          {r.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {r.tools_called.length > 0 && (
                          <div className="flex gap-0.5">
                            {r.tools_called.map((tc, i) => (
                              <span
                                key={i}
                                className={`text-[9px] font-semibold px-1 py-0.5 rounded ${TOOL_BADGE_COLORS[tc.name] || "bg-gray-100 text-gray-600"}`}
                              >
                                {tc.name.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        )}
                        <span className="text-[10px] text-gray-400 font-mono">
                          {r.latency_ms}ms
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${r.judge.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                        >
                          {r.judge.passed ? "Pass" : "Fail"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {expandedTests.has(r.id) && (
                    <div className="px-3 pb-3 border-t border-gray-50 space-y-2">
                      <div className="mt-2">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">
                          Prompt
                        </p>
                        <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                          {r.prompt}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">
                          Agent Response
                        </p>
                        <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 whitespace-pre-wrap">
                          {r.response}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">
                          Judge Reasoning
                        </p>
                        <p className="text-xs text-gray-600 bg-amber-50 rounded p-2">
                          {r.judge.reasoning}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {Object.entries(r.judge.scores).map(([dim, score]) => (
                          <div
                            key={dim}
                            className={`text-[10px] px-2 py-1 rounded border ${
                              score >= 4
                                ? "bg-green-50 text-green-700 border-green-200"
                                : score >= 3
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                            }`}
                          >
                            <span className="font-semibold">{dim}:</span> {score}/5
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
