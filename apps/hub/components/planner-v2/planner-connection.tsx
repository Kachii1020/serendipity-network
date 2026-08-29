export type PlannerConnectionMode =
  "checking" | "connected" | "connecting" | "failed" | "manual";

export function PlannerConnectionStatus({
  mode,
}: {
  readonly mode: PlannerConnectionMode;
}) {
  const label =
    mode === "connected"
      ? "Agent tools connected"
      : mode === "manual"
        ? "Manual controls"
        : mode === "failed"
          ? "Manual controls"
          : mode === "connecting"
            ? "Connecting agent tools"
            : "Checking agent tools";

  return (
    <details className="v2-mode-details" data-mode={mode}>
      <summary>{label}</summary>
      <div>
        {mode === "connected" ? (
          <p>
            An AI assistant can use this page&apos;s five validated planner
            actions. Changes appear on this same page.
          </p>
        ) : mode === "failed" ? (
          <p>
            This browser exposed planner tools, but all five could not be
            registered safely. Manual controls remain available.
          </p>
        ) : mode === "connecting" || mode === "checking" ? (
          <p>The page is verifying all five planner actions.</p>
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
