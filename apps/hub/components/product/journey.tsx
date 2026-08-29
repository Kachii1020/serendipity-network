import type { BundleSummary, Provider } from "@serendipity/contracts";
import { Button } from "@serendipity/ui";
import { useState } from "react";

import { explainBundle } from "../../lib/selection";
import type { HubPhase } from "../../lib/store";
import { DecisionDialog } from "./decision-dialog";
import { HoldCountdown } from "./hold-countdown";
import type { ReceiptView, RecoveryView } from "./types";

const providerNames: Record<Provider, string> = {
  kiln: "Kiln",
  nori: "Nori",
  loop: "Loop",
};

const time = (value: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));

const yen = (value: number): string => `¥${value.toLocaleString("en-US")}`;

const date = (value: string): string =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));

export function StopBandList({ bundle }: { readonly bundle: BundleSummary }) {
  return (
    <ol className="stop-band-list">
      {bundle.items.map((item, index) => (
        <li key={item.slot.slotId}>
          {index > 0 ? (
            <p className="travel-note">
              {item.travelFromPreviousMinutes} min travel{" "}
              <span aria-hidden="true">·</span>{" "}
              {item.spareGapFromPreviousMinutes} min spare
            </p>
          ) : null}
          <article className="stop-band" data-provider={item.slot.provider}>
            <p className="stop-band__provider">
              {providerNames[item.slot.provider]}
            </p>
            <time dateTime={item.slot.startsAt}>
              {time(item.slot.startsAt)}
            </time>
            <h3>{item.slot.title}</h3>
            <p className="stop-band__price">{yen(item.slot.priceYen)}</p>
          </article>
        </li>
      ))}
    </ol>
  );
}

export function JourneySummary({
  bundle,
  routeNumber,
  mood,
}: {
  readonly bundle: BundleSummary;
  readonly routeNumber: number | null;
  readonly mood: "Cozy" | "Hands-on" | "Late" | "Surprising";
}) {
  return (
    <header className="journey-summary" tabIndex={-1}>
      <p className="section-kicker">
        Your three-stop route
        {routeNumber ? ` · Route ${routeNumber}` : ""}
      </p>
      <h2>Tonight got interesting.</h2>
      <p>
        A {mood.toLowerCase()} 3-stop route <span aria-hidden="true">·</span>{" "}
        {yen(bundle.totalPriceYen)} <span aria-hidden="true">·</span>{" "}
        {time(bundle.startsAt)}–{time(bundle.endsAt)}
      </p>
    </header>
  );
}

function ConfirmationReceipt({
  bundle,
  receipt,
}: {
  readonly bundle: BundleSummary;
  readonly receipt: ReceiptView;
}) {
  return (
    <section
      aria-labelledby="receipt-heading"
      className="receipt"
      tabIndex={-1}
    >
      <p className="section-kicker">Demo receipt</p>
      <h2 id="receipt-heading">Your night is confirmed.</h2>
      <p>
        {date(bundle.startsAt)} · Shibuya · JST · {time(bundle.startsAt)}–
        {time(bundle.endsAt)} · {yen(bundle.totalPriceYen)}
      </p>
      <p>
        Demo confirmation only. No payment was taken and no real venue booking
        was created.
      </p>
      <ol className="receipt-route">
        {bundle.items.map(({ slot }) => (
          <li key={slot.slotId}>
            <span>{time(slot.startsAt)}</span>
            <strong>{slot.title}</strong>
            <small>{providerNames[slot.provider]}</small>
          </li>
        ))}
      </ol>
      <p className="receipt-reference-label">Provider-safe references</p>
      <ul>
        {receipt.reservations.map((reservation) => (
          <li key={reservation.provider}>
            <strong>{providerNames[reservation.provider]}</strong>
            <span>{reservation.reservationRef}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecoveryNotice({ recovery }: { readonly recovery: RecoveryView }) {
  return (
    <section
      aria-labelledby="recovery-heading"
      className="recovery"
      tabIndex={-1}
    >
      <p className="section-kicker">Safely recovered</p>
      <h2 id="recovery-heading">A quick plot twist.</h2>
      <p>
        {providerNames[recovery.failedProvider]} became unavailable. The other
        Provider holds were released safely.
      </p>
      {recovery.replacement ? (
        <div className="replacement">
          <div className="replacement__heading">
            <h3>Next best route</h3>
            <span>Not held</span>
          </div>
          <StopBandList bundle={recovery.replacement} />
        </div>
      ) : (
        <p>
          No complete replacement is available. Adjust the search and try again.
        </p>
      )}
    </section>
  );
}

export function Journey({
  alternatives,
  bundle,
  candidateOrder = [],
  expiresAt,
  onConfirm,
  onExpired,
  onHold,
  onRelease,
  onReset,
  onSelect,
  mood,
  phase,
  receipt,
  recovery,
  requiresFreshSearch,
}: {
  readonly alternatives: readonly BundleSummary[];
  readonly bundle: BundleSummary;
  readonly candidateOrder?: readonly string[];
  readonly expiresAt: string | null;
  readonly onConfirm: () => void;
  readonly onExpired: () => void;
  readonly onHold: () => void;
  readonly onRelease: () => void;
  readonly onReset: () => void;
  readonly onSelect: (bundle: BundleSummary) => void;
  readonly mood: "Cozy" | "Hands-on" | "Late" | "Surprising";
  readonly phase: HubPhase;
  readonly receipt: ReceiptView | null;
  readonly recovery: RecoveryView | null;
  readonly requiresFreshSearch: boolean;
}) {
  const [decision, setDecision] = useState<"confirm" | "release" | null>(null);
  const visibleAlternatives = alternatives
    .filter((alternative) => alternative.bundleId !== bundle.bundleId)
    .map((alternative, index) => {
      const candidateIndex = candidateOrder.indexOf(alternative.bundleId);
      return {
        bundle: alternative,
        routeNumber: candidateIndex >= 0 ? candidateIndex + 1 : index + 2,
      };
    })
    .sort((left, right) => left.routeNumber - right.routeNumber);
  const selectedCandidateIndex = candidateOrder.indexOf(bundle.bundleId);
  const selectedRouteNumber =
    selectedCandidateIndex >= 0 ? selectedCandidateIndex + 1 : null;

  if (receipt) {
    return (
      <div className="journey-shell">
        <ConfirmationReceipt bundle={bundle} receipt={receipt} />
        <Button className="journey-primary" onClick={onReset} variant="primary">
          Start over <span aria-hidden="true">→</span>
        </Button>
      </div>
    );
  }

  return (
    <section
      aria-label="Recommended evening"
      className="journey-shell"
      tabIndex={-1}
    >
      {recovery ? <RecoveryNotice recovery={recovery} /> : null}
      {!recovery ? (
        <JourneySummary
          bundle={bundle}
          mood={mood}
          routeNumber={selectedRouteNumber}
        />
      ) : null}
      {phase === "held" && expiresAt ? (
        <>
          <h2 className="held-heading" tabIndex={-1}>
            Your night is held.
          </h2>
          <HoldCountdown expiresAt={expiresAt} onExpired={onExpired} />
        </>
      ) : null}
      {phase === "releasing" ? (
        <h2 className="release-heading" tabIndex={-1}>
          Releasing your hold…
        </h2>
      ) : null}
      {!recovery ? <StopBandList bundle={bundle} /> : null}
      {!recovery ? (
        <p className="journey-reason">{explainBundle(bundle)}</p>
      ) : null}
      {phase === "composed" && !recovery && !requiresFreshSearch ? (
        <>
          <p className="prehold-note">
            Demo only · no payment will be taken. A hold temporarily sets these
            three available stops aside for 90 seconds; it is not a confirmed
            reservation.
          </p>
          <Button
            className="journey-primary"
            onClick={onHold}
            variant="primary"
          >
            Hold for 90 seconds
          </Button>
        </>
      ) : null}
      {phase === "composed" && !recovery && requiresFreshSearch ? (
        <Button className="journey-primary" onClick={onReset} variant="primary">
          Search live availability again
        </Button>
      ) : null}
      {phase === "held" ? (
        <div className="held-actions">
          <p>Demo only · no payment will be taken.</p>
          <Button
            className="journey-primary"
            onClick={() => setDecision("confirm")}
            variant="primary"
          >
            Confirm demo reservation
          </Button>
          <button
            className="text-action"
            onClick={() => setDecision("release")}
            type="button"
          >
            Release hold
          </button>
        </div>
      ) : null}
      {["holding", "releasing", "confirming", "reconciling"].includes(phase) ? (
        <p aria-live="polite" className="pending-notice">
          {phase === "holding"
            ? "Waiting for all three Provider holds…"
            : phase === "releasing"
              ? "Releasing all three temporary holds…"
              : phase === "confirming"
                ? "Confirming all three Provider reservations…"
                : "Checking the authoritative Provider result…"}
        </p>
      ) : null}
      {recovery?.replacement ? (
        <Button
          className="journey-primary"
          onClick={() => onSelect(recovery.replacement!)}
          variant="primary"
        >
          Choose this replacement
        </Button>
      ) : null}
      {visibleAlternatives.length > 0 && phase === "composed" && !recovery ? (
        <details className="alternatives">
          <summary>Compare {visibleAlternatives.length} alternatives</summary>
          <div>
            {visibleAlternatives.map(({ bundle: alternative, routeNumber }) => (
              <button
                key={alternative.bundleId}
                onClick={() => onSelect(alternative)}
                type="button"
              >
                <span>
                  <strong>Route {routeNumber}</strong>
                  <br />
                  {alternative.items.map(({ slot }) => slot.title).join(" · ")}
                </span>
                <span>
                  {time(alternative.startsAt)}–{time(alternative.endsAt)} ·{" "}
                  {yen(alternative.totalPriceYen)} ·{" "}
                  {alternative.totalTravelMinutes} min travel
                </span>
              </button>
            ))}
          </div>
        </details>
      ) : null}
      {phase === "held" ? (
        <DecisionDialog
          confirmLabel={
            decision === "release" ? "Release all holds" : "Confirm demo route"
          }
          description={
            decision === "release"
              ? "This releases all three temporary Provider holds. It will not undo a confirmed reservation."
              : "Confirm all three demo reservations for the complete route. No payment will be taken."
          }
          onCancel={() => setDecision(null)}
          onConfirm={decision === "release" ? onRelease : onConfirm}
          open={decision !== null}
          title={
            decision === "release"
              ? "Release this temporary route?"
              : "Confirm this complete demo route?"
          }
        />
      ) : null}
    </section>
  );
}
