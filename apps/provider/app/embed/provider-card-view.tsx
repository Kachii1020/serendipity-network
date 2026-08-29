import type { ProviderConfig } from "@serendipity/provider-config";
import * as React from "react";

import type { ProviderToolEvent } from "../../lib/tools/provider-tools";

export type ProviderConnectionLabel =
  "Connecting" | "Live site" | "Manual connection" | "Unavailable";

export type ProviderOperationLabel =
  | "Ready"
  | "Checking"
  | "Found"
  | "Checked — no match"
  | "Holding"
  | "Held"
  | "Confirming"
  | "Confirmed"
  | "Releasing"
  | "Released"
  | "Needs attention"
  | "Unknown";

export type ProviderPresentation = {
  readonly connectionLabel: ProviderConnectionLabel;
  readonly latestAction: string;
  readonly operationLabel: ProviderOperationLabel;
};

export const initialProviderPresentation: ProviderPresentation = {
  connectionLabel: "Connecting",
  latestAction: "Waiting for WebMCP registration",
  operationLabel: "Ready",
};

const pluralizeActivities = (count: number): string =>
  `${count} ${count === 1 ? "activity" : "activities"}`;

export const reduceProviderPresentation = (
  state: ProviderPresentation,
  event: ProviderToolEvent,
): ProviderPresentation => {
  if (event.phase === "UNKNOWN") {
    return {
      ...state,
      latestAction: "Checking the last Provider result",
      operationLabel: "Unknown",
    };
  }
  if (event.phase === "FAILED") {
    return {
      ...state,
      latestAction: event.errorCode
        ? `Request needs attention · ${event.errorCode}`
        : "Request needs attention",
      operationLabel: "Needs attention",
    };
  }
  if (event.phase === "STARTED") {
    const started: Record<
      ProviderToolEvent["operation"],
      ProviderPresentation
    > = {
      CONFIRM: {
        ...state,
        latestAction: "Confirming the demo reservation",
        operationLabel: "Confirming",
      },
      HOLD: {
        ...state,
        latestAction: "Holding the selected activity",
        operationLabel: "Holding",
      },
      RELEASE: {
        ...state,
        latestAction: "Releasing the selected activity",
        operationLabel: "Releasing",
      },
      SEARCH: {
        ...state,
        latestAction: "Checking available activities",
        operationLabel: "Checking",
      },
      STATUS: {
        ...state,
        latestAction: "Checking the latest hold status",
        operationLabel: "Checking",
      },
    };
    return started[event.operation];
  }

  switch (event.operation) {
    case "SEARCH": {
      const count = event.resultCount ?? 0;
      return {
        ...state,
        latestAction:
          count === 0
            ? "Checked — no matching activities"
            : `Found ${pluralizeActivities(count)}`,
        operationLabel: count === 0 ? "Checked — no match" : "Found",
      };
    }
    case "HOLD":
      return {
        ...state,
        latestAction: "Activity held for the current session",
        operationLabel: "Held",
      };
    case "CONFIRM":
      return {
        ...state,
        latestAction: "Demo reservation confirmed",
        operationLabel: "Confirmed",
      };
    case "RELEASE":
      return {
        ...state,
        latestAction: "Hold released",
        operationLabel: "Released",
      };
    case "STATUS": {
      const status = event.terminalStatus;
      const statusCopy = {
        CONFIRMED: ["Confirmed", "Demo reservation confirmed"],
        EXPIRED: ["Released", "Hold expired and capacity was restored"],
        HELD: ["Held", "Activity is still held"],
        RELEASED: ["Released", "Hold released"],
      } as const;
      const resolved = status ? statusCopy[status] : undefined;
      return resolved
        ? {
            ...state,
            latestAction: resolved[1],
            operationLabel: resolved[0],
          }
        : state;
    }
  }
};

const Mark = ({ mark }: { readonly mark: ProviderConfig["mark"] }) => (
  <span aria-hidden="true" className={`provider-mark provider-mark--${mark}`}>
    {mark === "vessel" ? "◡" : mark === "bowl" ? "⌣" : "♪"}
  </span>
);

export function ProviderCardView({
  config,
  originLabel,
  presentation,
}: {
  readonly config: ProviderConfig;
  readonly originLabel: string;
  readonly presentation: ProviderPresentation;
}) {
  const isWaitingForConnection =
    presentation.connectionLabel === "Connecting" &&
    presentation.operationLabel === "Ready";

  return (
    <main
      className="provider-embed"
      data-connection={presentation.connectionLabel}
      data-operation={
        isWaitingForConnection ? undefined : presentation.operationLabel
      }
      data-provider={config.slug}
      style={{ "--accent": config.accent } as React.CSSProperties}
    >
      <div className="provider-embed__paper">
        <header className="provider-embed__header">
          <div>
            <p className="provider-embed__network">Serendipity Provider</p>
            <h1>{config.displayName}</h1>
            <p className="provider-embed__category">{config.category}</p>
          </div>
          <Mark mark={config.mark} />
        </header>

        <div className="provider-embed__states" aria-label="Provider status">
          <p>
            <span aria-hidden="true" className="provider-state-icon">
              ●
            </span>
            <span>{presentation.connectionLabel}</span>
            <span aria-hidden="true" className="provider-state-end">
              ◎
            </span>
          </p>
          {!isWaitingForConnection ? (
            <p>
              <span aria-hidden="true" className="provider-state-icon">
                ✓
              </span>
              <span>{presentation.operationLabel}</span>
              <span aria-hidden="true" className="provider-state-end">
                ↗
              </span>
            </p>
          ) : null}
        </div>

        <div
          aria-atomic="true"
          aria-live="polite"
          className="provider-embed__latest"
        >
          <span aria-hidden="true">✦</span>
          <span>{presentation.latestAction}</span>
        </div>

        <p className="provider-embed__origin">
          <span aria-hidden="true">◆</span> {originLabel}
        </p>
      </div>
    </main>
  );
}
