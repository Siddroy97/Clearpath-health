"use client";

import { useState, useCallback } from "react";

interface TestCase {
  name: string;
  input: string;
  expected: string;
  status: "pending" | "running" | "pass" | "fail";
}

const INITIAL_TESTS: TestCase[] = [
  {
    name: "Insurance Check",
    input: 'Do you accept Blue Cross?',
    expected: "Confirms BCBS accepted",
    status: "pending",
  },
  {
    name: "Benefits Lookup",
    input: "What's my PT sessions remaining? (MBR001)",
    expected: "Returns 13 remaining",
    status: "pending",
  },
  {
    name: "Co-pay Query",
    input: "What's my primary care copay? (MBR001)",
    expected: "Returns $25",
    status: "pending",
  },
  {
    name: "Doctor Availability",
    input: "Is Dr. Patel available?",
    expected: "Returns available slots",
    status: "pending",
  },
  {
    name: "Appointment Booking",
    input: "Book Tuesday 2pm with Dr. Patel",
    expected: "Returns confirmation number",
    status: "pending",
  },
  {
    name: "Emergency Escalation",
    input: "I'm having chest pains",
    expected: "Immediately offers 911/escalation",
    status: "pending",
  },
];

const STATUS_STYLES = {
  pending: "bg-gray-100 text-gray-500",
  running: "bg-yellow-100 text-yellow-700 animate-pulse",
  pass: "bg-green-100 text-green-700",
  fail: "bg-red-100 text-red-700",
};

const STATUS_LABELS = {
  pending: "Pending",
  running: "Running...",
  pass: "Pass",
  fail: "Fail",
};

export default function TestSuite() {
  const [tests, setTests] = useState<TestCase[]>(INITIAL_TESTS);
  const [running, setRunning] = useState(false);

  const passCount = tests.filter((t) => t.status === "pass").length;
  const completedCount = tests.filter((t) => t.status === "pass" || t.status === "fail").length;

  const runTests = useCallback(async () => {
    setRunning(true);
    // Reset all tests
    setTests(INITIAL_TESTS.map((t) => ({ ...t, status: "pending" as const })));

    for (let i = 0; i < INITIAL_TESTS.length; i++) {
      // Set current test to running
      setTests((prev) =>
        prev.map((t, idx) => (idx === i ? { ...t, status: "running" as const } : t))
      );

      await new Promise((resolve) => setTimeout(resolve, 800));

      // Simulate pass/fail (test 6 - emergency - always passes, others ~85% pass rate)
      const passes = i === 5 ? true : Math.random() > 0.15;
      setTests((prev) =>
        prev.map((t, idx) =>
          idx === i ? { ...t, status: passes ? ("pass" as const) : ("fail" as const) } : t
        )
      );
    }

    setRunning(false);
  }, []);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={runTests}
          disabled={running}
          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {running ? "Running..." : "Run Tests"}
        </button>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600 font-medium">
              {passCount} / {INITIAL_TESTS.length} passing
            </span>
            {completedCount > 0 && (
              <span className="text-xs text-gray-400">
                {completedCount} / {INITIAL_TESTS.length} completed
              </span>
            )}
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500 progress-animate"
              style={{ width: `${(passCount / INITIAL_TESTS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Test cards */}
      <div className="space-y-2 custom-scrollbar overflow-y-auto max-h-[calc(100vh-320px)]">
        {tests.map((test, index) => (
          <div
            key={index}
            className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-800">{test.name}</h4>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[test.status]}`}
              >
                {STATUS_LABELS[test.status]}
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-600">Input:</span> {test.input}
              </p>
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-600">Expected:</span> {test.expected}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
