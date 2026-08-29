import type { ToolActivityItem } from "./types";

const friendlyName = (name: string): string =>
  name
    .replace(/^(hub|kiln|nori|loop)_/, "")
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());

const completedTime = (value: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));

export function ToolActivity({
  items,
}: {
  readonly items: readonly ToolActivityItem[];
}) {
  return (
    <section aria-labelledby="tool-activity-heading" className="tool-activity">
      <div className="proof-subheading">
        <div>
          <p className="section-kicker">Sanitized activity</p>
          <h3 id="tool-activity-heading">Tool activity</h3>
        </div>
        <span>{items.length} events</span>
      </div>
      {items.length === 0 ? (
        <p className="empty-activity">
          No tool calls yet. Safe names, outcomes, and correlation references
          will appear here—never tokens or raw payloads.
        </p>
      ) : (
        <ol className="activity-list">
          {items.map((item, index) => (
            <li key={`${item.correlationId}-${index}`}>
              <span
                aria-hidden="true"
                className="activity-stamp"
                data-status={item.status}
              >
                {item.status === "Complete"
                  ? "✓"
                  : item.status === "Failed"
                    ? "!"
                    : item.status === "Unknown"
                      ? "?"
                      : "…"}
              </span>
              <div>
                <strong>{friendlyName(item.toolName)}</strong>
                <p>
                  {item.transport === "site-tool"
                    ? "Site tool"
                    : "Manual fallback"}
                  {item.provider ? ` · ${item.provider}` : ""} · {item.status}
                  {item.errorCode ? ` · ${item.errorCode}` : ""}
                  {item.durationMs === undefined
                    ? ""
                    : ` · ${item.durationMs} ms`}
                </p>
                <p>
                  {item.origin ? `${item.origin} · ` : ""}
                  correlation {item.correlationId}
                </p>
              </div>
              <time dateTime={item.completedAt}>
                {completedTime(item.completedAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
