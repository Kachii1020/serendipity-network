"use client";

import type {
  BundleSummary,
  ErrorCode,
  Provider,
} from "@serendipity/contracts";
import { useState } from "react";

import type { HubPhase } from "../../lib/store";
import { DecisionDialog } from "./decision-dialog";
import { Journey } from "./journey";
import { MoodPrompt } from "./mood-prompt";
import { LiveProviderStrip } from "./provider-strip";
import type {
  Mood,
  PlanConstraints,
  ProviderProjection,
  ReceiptView,
  RecoveryView,
  ToolActivityItem,
} from "./types";
import { WebMcpProof } from "./webmcp-proof";

const errorCopy: Partial<Record<ErrorCode, string>> = {
  ALREADY_CONFIRMED:
    "At least one Provider may already be confirmed. Check the latest status before continuing.",
  COMPENSATION_INCOMPLETE:
    "One Provider release still needs attention. Do not start another hold yet.",
  CONFIRMATION_INCONSISTENT:
    "The three Provider states disagree. Check again before taking another action.",
  HOLD_EXPIRED:
    "The earliest hold expired. Search again for live availability.",
  NO_VALID_BUNDLE:
    "No complete three-stop route fits those exact constraints right now.",
  PROVIDER_OFFLINE: "One of the three sites could not be reached safely.",
  PROVIDER_TIMEOUT: "One Provider took too long to answer.",
  RECONCILIATION_REQUIRED:
    "A confirmation result is uncertain. The authoritative status must be checked.",
};

export function ProductView({
  activities,
  browserSessionId,
  boundProviderCount = 0,
  candidateOrder = [],
  clientReady = false,
  connectionMode,
  compensationBlockedUntil = null,
  compensationSeconds = 0,
  constraints = { startTime: "18:00", totalBudgetYen: 5000 },
  errorCode,
  expiresAt,
  mood,
  onBudget,
  onCheckStatus,
  onConfirm,
  onExpired,
  onHold,
  onMood,
  onPlan,
  onRelease,
  onReleaseAndLeave,
  onReset,
  onRetryRelease,
  onSelect,
  onStartTime,
  origins,
  phase,
  projections,
  receipt,
  recovery,
  recoveryAction = null,
  requiresFreshSearch,
  selected,
  alternatives,
}: {
  readonly activities: readonly ToolActivityItem[];
  readonly alternatives: readonly BundleSummary[];
  readonly browserSessionId: string;
  readonly boundProviderCount?: number;
  readonly candidateOrder?: readonly string[];
  readonly clientReady?: boolean;
  readonly connectionMode: "manual" | "webmcp";
  readonly compensationBlockedUntil?: string | null;
  readonly compensationSeconds?: number;
  readonly constraints?: PlanConstraints;
  readonly errorCode: ErrorCode | null;
  readonly expiresAt: string | null;
  readonly mood: Mood;
  readonly onBudget?: (budgetYen: number) => void;
  readonly onCheckStatus?: () => void;
  readonly onConfirm: () => void;
  readonly onExpired: () => void;
  readonly onHold: () => void;
  readonly onMood: (mood: Mood) => void;
  readonly onPlan: () => void;
  readonly onRelease: () => void;
  readonly onReleaseAndLeave: () => void;
  readonly onReset: () => void;
  readonly onRetryRelease?: () => void;
  readonly onSelect: (bundle: BundleSummary) => void;
  readonly onStartTime?: (startTime: string) => void;
  readonly origins: Record<Provider, string>;
  readonly phase: HubPhase;
  readonly projections: Record<Provider, ProviderProjection>;
  readonly receipt: ReceiptView | null;
  readonly recovery: RecoveryView | null;
  readonly recoveryAction?: "check-status" | "retry-release" | null;
  readonly requiresFreshSearch: boolean;
  readonly selected: BundleSummary | null;
}) {
  const [leaveOpen, setLeaveOpen] = useState(false);
  const busy = [
    "discovering",
    "holding",
    "releasing",
    "confirming",
    "reconciling",
  ].includes(phase);
  const compensationWaiting =
    errorCode === "COMPENSATION_INCOMPLETE" &&
    compensationBlockedUntil !== null;
  const compensationClock = `${Math.floor(compensationSeconds / 60)
    .toString()
    .padStart(2, "0")}:${(compensationSeconds % 60)
    .toString()
    .padStart(2, "0")}`;
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to the invitation
      </a>
      <main
        className="product-shell"
        data-bound-provider-count={boundProviderCount}
        data-client-ready={clientReady}
        id="main-content"
      >
        <h1 className="sr-only">Plan a Shibuya night</h1>
        <header className="site-header">
          {phase === "held" ? (
            <button
              aria-label="Leave planner"
              className="wordmark wordmark-button"
              onClick={() => setLeaveOpen(true)}
              translate="no"
              type="button"
            >
              SERENDIPITY<span aria-hidden="true">✦</span>
            </button>
          ) : busy ? (
            <button
              aria-label="Planner navigation unavailable during this operation"
              className="wordmark wordmark-button"
              disabled
              translate="no"
              type="button"
            >
              SERENDIPITY<span aria-hidden="true">✦</span>
            </button>
          ) : (
            <a
              aria-label="Serendipity home"
              className="wordmark"
              href="/"
              translate="no"
            >
              SERENDIPITY<span aria-hidden="true">✦</span>
            </a>
          )}
          <div className="network-pill" data-mode={connectionMode}>
            <span aria-hidden="true">●</span>
            {connectionMode === "webmcp"
              ? "WebMCP · 5 Site Tools · 3 Provider APIs"
              : "3 Provider APIs · manual mode"}
          </div>
        </header>

        {connectionMode === "manual" ? (
          <aside className="manual-notice" role="status">
            <strong>Manual fallback</strong>
            <span>
              This browser does not expose Site Tools. The planner uses the same
              three Provider APIs and makes no Site Tool claim.
            </span>
          </aside>
        ) : null}

        {phase === "idle" || phase === "discovering" ? (
          <MoodPrompt
            constraints={constraints}
            disabled={phase === "discovering"}
            onBudget={onBudget ?? (() => undefined)}
            onPlan={onPlan}
            onSelect={onMood}
            onStartTime={onStartTime ?? (() => undefined)}
            selected={mood}
          />
        ) : null}

        <LiveProviderStrip projections={projections} />

        {selected || phase === "no_results" ? (
          <p
            aria-label="Selected plan constraints"
            className="active-constraints"
          >
            Shibuya <span aria-hidden="true">·</span> solo{" "}
            <span aria-hidden="true">·</span> {constraints.startTime}–22:30{" "}
            <span aria-hidden="true">·</span> up to ¥
            {constraints.totalBudgetYen.toLocaleString("en-US")}
          </p>
        ) : null}

        {selected ? (
          <>
            <Journey
              alternatives={alternatives}
              bundle={selected}
              candidateOrder={candidateOrder}
              expiresAt={expiresAt}
              mood={mood}
              onConfirm={onConfirm}
              onExpired={onExpired}
              onHold={onHold}
              onRelease={onRelease}
              onReset={onReset}
              onSelect={onSelect}
              phase={phase}
              receipt={receipt}
              recovery={recovery}
              requiresFreshSearch={requiresFreshSearch}
            />
          </>
        ) : null}

        {phase === "no_results" ? (
          <section
            aria-labelledby="no-results-heading"
            className="empty-state"
            tabIndex={-1}
          >
            <p className="section-kicker">All three sites checked</p>
            <h2 id="no-results-heading">Nothing fits exactly—yet.</h2>
            <p>
              Adjust time, budget, or mood. We will never fill a route with
              invented or partial availability.
            </p>
            <button className="outline-action" onClick={onReset} type="button">
              Adjust search
            </button>
          </section>
        ) : null}

        {phase === "error" ? (
          <section
            aria-labelledby="error-heading"
            className="error-state"
            tabIndex={-1}
          >
            <p className="section-kicker">Safe stop</p>
            <h2 id="error-heading">The route paused.</h2>
            <p>
              {compensationWaiting
                ? "We could not verify every temporary release. Confirm, Hold, and new searches stay blocked during the 90-second safety window."
                : ((errorCode && errorCopy[errorCode]) ??
                  "The last step could not be completed safely. Try a fresh search.")}
            </p>
            {compensationWaiting ? (
              <>
                <p className="hold-countdown">
                  <strong>{compensationClock}</strong> remaining before a fresh
                  search
                </p>
                <button className="outline-action" disabled type="button">
                  Wait before searching again
                </button>
              </>
            ) : recoveryAction === "retry-release" ? (
              <button
                className="outline-action"
                disabled={busy}
                onClick={onRetryRelease}
                type="button"
              >
                Retry release safely
              </button>
            ) : recoveryAction === "check-status" ? (
              <button
                className="outline-action"
                disabled={busy}
                onClick={onCheckStatus}
                type="button"
              >
                Check latest Provider status
              </button>
            ) : (
              <button
                className="outline-action"
                disabled={busy}
                onClick={onReset}
                type="button"
              >
                Start a fresh search
              </button>
            )}
          </section>
        ) : null}

        <WebMcpProof
          activities={activities}
          browserSessionId={browserSessionId}
          bundle={selected}
          connectionMode={connectionMode}
          origins={origins}
        />

        <footer className="product-footer">
          <p>Demo only · no payment · Provider-safe references</p>
          <a href="/#safety">How this demo stays safe</a>
        </footer>
        {phase === "held" ? (
          <DecisionDialog
            cancelLabel="Stay in planner"
            confirmLabel="Release holds & leave"
            description="Serendipity will release all three temporary Provider holds before returning home. Navigation continues only after a safe release."
            onCancel={() => setLeaveOpen(false)}
            onConfirm={onReleaseAndLeave}
            open={leaveOpen}
            title="Leave this held route?"
          />
        ) : null}
      </main>
    </>
  );
}
