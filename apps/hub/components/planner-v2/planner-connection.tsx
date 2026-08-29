"use client";

import { useEffect, useState } from "react";

import { isWebMcpAvailable } from "@serendipity/webmcp";

export function PlannerConnectionStatus() {
  const [mode, setMode] = useState<"checking" | "manual" | "webmcp">(
    "checking",
  );

  useEffect(() => {
    setMode(isWebMcpAvailable(document) ? "webmcp" : "manual");
  }, []);

  const label =
    mode === "webmcp"
      ? "Agent tools connected"
      : mode === "manual"
        ? "Manual controls"
        : "Checking agent tools";

  return (
    <details className="v2-mode-details" data-mode={mode}>
      <summary>{label}</summary>
      <div>
        {mode === "webmcp" ? (
          <p>
            An AI assistant can use this page&apos;s five validated planner
            actions. Changes appear on this same page.
          </p>
        ) : (
          <p>
            Your browser cannot offer this page&apos;s planner tools to an AI
            assistant. Every planner control still works here.
          </p>
        )}
      </div>
    </details>
  );
}
