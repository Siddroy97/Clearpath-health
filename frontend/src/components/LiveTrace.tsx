"use client";

export interface ToolCall {
  type: string;
  tool: string;
  input: Record<string, unknown>;
  output: string;
  latency_ms: number;
  timestamp?: number;
}

const TOOL_COLORS: Record<string, string> = {
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

function getToolColor(tool: string): string {
  return TOOL_COLORS[tool] || "bg-gray-100 text-gray-700";
}

function isToolCallSuccessful(call: ToolCall): boolean {
  const output = (typeof call.output === "string" ? call.output : JSON.stringify(call.output)).toLowerCase();
  return (
    output.length > 0 &&
    !output.includes("error") &&
    !output.includes("timed out") &&
    !output.includes("failed") &&
    !output.includes("exception")
  );
}

interface LiveTraceProps {
  toolCalls: ToolCall[];
}

export default function LiveTrace({ toolCalls }: LiveTraceProps) {
  if (toolCalls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p className="text-sm">Tool calls will appear here during the conversation</p>
      </div>
    );
  }

  const completedCount = toolCalls.filter(isToolCallSuccessful).length;
  const totalCount = toolCalls.length;
  const allCompleted = completedCount === totalCount;

  return (
    <div className="space-y-3 custom-scrollbar overflow-y-auto max-h-[calc(100vh-280px)]">
      {/* Task Completion Metric */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
          allCompleted ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"
        }`}
      >
        {allCompleted ? (
          <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-yellow-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        )}
        <span className={`text-sm font-medium ${allCompleted ? "text-green-700" : "text-yellow-700"}`}>
          {completedCount} / {totalCount} tasks completed
        </span>
      </div>

      {/* Tool call cards */}
      {[...toolCalls].reverse().map((call, index) => (
        <div key={index} className="tool-card-enter border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getToolColor(call.tool)}`}>
              {call.tool}
            </span>
            <span className="text-xs text-gray-400 font-mono">{call.latency_ms}ms</span>
          </div>
          <div className="space-y-1.5">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Input</p>
              <pre className="text-xs text-gray-600 bg-gray-50 rounded p-2 overflow-x-auto font-[family-name:var(--font-geist-mono)]">
                {JSON.stringify(call.input, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Output</p>
              <pre className="text-xs text-gray-600 bg-gray-50 rounded p-2 overflow-x-auto font-[family-name:var(--font-geist-mono)]">
                {typeof call.output === "string" ? call.output : JSON.stringify(call.output, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
