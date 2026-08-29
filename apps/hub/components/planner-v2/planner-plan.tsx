import type {
  EvidenceClaimV2,
  EveningPlanV2,
  PlaceEvidenceV2,
  PriceProvenanceV2,
  SwapPreferenceV2,
} from "@serendipity/contracts/planner-v2";

import type { SavedPlanRecordV2 } from "./planner-storage";

const time = (value: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));

const price = (minYen: number, maxYen: number): string => {
  if (maxYen === 0) return "¥0";
  if (minYen === maxYen) return `¥${maxYen.toLocaleString("en-US")}`;
  return `¥${minYen.toLocaleString("en-US")}–¥${maxYen.toLocaleString("en-US")}`;
};

const priceBasis = (provenance: PriceProvenanceV2): string =>
  provenance.kind === "PUBLISHED_AMOUNT"
    ? "Published amount verified in the cited source."
    : `${provenance.sourceSummary} ¥0 is a planner reference, not a price guarantee.`;

const duration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) return `${remaining} min`;
  if (remaining === 0) return `${hours} hr`;
  return `${hours} hr ${remaining} min`;
};

const category = (value: string): string =>
  value
    .toLowerCase()
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export function PlannerPlan({
  changeSummary,
  evidenceByPlace,
  evidenceLoadingPlaceId,
  inlineError,
  onDeleteSaved,
  onEvidence,
  onSave,
  onSwap,
  openEvidencePlaceId,
  plan,
  savedPlans,
  storageCorrupt,
  storagePending,
  swapping,
  warnings,
}: {
  readonly changeSummary: string | null;
  readonly evidenceByPlace: Readonly<Record<string, PlaceEvidenceV2>>;
  readonly evidenceLoadingPlaceId: string | null;
  readonly inlineError: null | {
    readonly code: string;
    readonly message: string;
  };
  readonly onDeleteSaved: (savedPlanId: string) => void;
  readonly onEvidence: (placeId: string) => void;
  readonly onSave: () => void;
  readonly onSwap: (placeId: string, preference: SwapPreferenceV2) => void;
  readonly openEvidencePlaceId: string | null;
  readonly plan: EveningPlanV2;
  readonly savedPlans: readonly SavedPlanRecordV2[];
  readonly storageCorrupt: boolean;
  readonly storagePending: boolean;
  readonly swapping: boolean;
  readonly warnings: readonly string[];
}) {
  const isSaved = savedPlans.some(
    ({ savedPlanId }) => savedPlanId === plan.planId,
  );
  const deadlineHeadroom = Math.max(
    0,
    Math.round(
      (Date.parse(plan.intent.endAt) - Date.parse(plan.totals.endsAt)) / 60_000,
    ),
  );

  return (
    <>
      <article className="v2-plan-card">
        <header className="v2-plan-summary" tabIndex={-1}>
          <p className="v2-eyebrow">Your source-backed Shibuya plan</p>
          {inlineError ? (
            <div className="v2-inline-error v2-plan-retained" role="alert">
              <strong>Previous verified plan kept.</strong>
              <span>{inlineError.message}</span>
            </div>
          ) : null}
          <h1>{plan.stops.length} sourced stops. One schedule-fit route.</h1>
          <ul className="v2-plan-summary__meta" aria-label="Plan totals">
            <li>
              Reference total{" "}
              {price(plan.totals.minPriceYen, plan.totals.maxPriceYen)} of ¥
              {plan.intent.totalBudgetYen.toLocaleString("en-US")} budget
            </li>
            <li>
              {time(plan.totals.startsAt)}–{time(plan.totals.endsAt)} JST
            </li>
            <li>{plan.totals.totalWalkMinutes} min estimated walking</li>
            <li>{plan.totals.stopCount} stops</li>
          </ul>
          <p className="v2-reference-definition">
            Reference prices cover only the listed admission or activity.
            Transport, food, and optional purchases are not included.
          </p>
          <p className="v2-plan-disclaimer">{plan.disclaimer}</p>
          {warnings.length > 0 ? (
            <div className="v2-source-warning" role="status">
              <strong>Recheck recommended</strong>
              <ul>
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {deadlineHeadroom > 0 ? (
            <p className="v2-plan-headroom">
              Finishes {duration(deadlineHeadroom)} before your deadline; no
              unrelated filler was added.
            </p>
          ) : null}
          {changeSummary ? (
            <p className="v2-swap-summary" role="status">
              {changeSummary}
            </p>
          ) : null}
        </header>

        <ol className="v2-timeline">
          {plan.stops.map((stop, index) => {
            const evidence = evidenceByPlace[stop.place.placeId];
            const evidenceOpen = openEvidencePlaceId === stop.place.placeId;
            const claims = evidence
              ? Object.values(evidence.claims).filter(
                  (claim): claim is EvidenceClaimV2 => claim !== null,
                )
              : [];
            const claimedSourceUrls = new Set(
              claims.map(({ sourceUrl }) => sourceUrl),
            );
            const supplementalScheduleSources =
              evidence?.sources.filter(
                ({ url }) => !claimedSourceUrls.has(url),
              ) ?? [];
            return (
              <li key={stop.place.placeId}>
                <p className="v2-travel-leg">
                  {stop.travelLabel} · from {stop.travelOriginLabel}
                </p>
                <article
                  className="v2-stop"
                  data-position={stop.position}
                  id={`place-${stop.place.placeId}`}
                  tabIndex={-1}
                >
                  <div className="v2-stop__topline">
                    <p>
                      {time(stop.startsAt)}–{time(stop.endsAt)} ·{" "}
                      {category(stop.place.category)}
                    </p>
                    <span>Stop {index + 1}</span>
                  </div>
                  <h2>{stop.place.name}</h2>
                  <p>{stop.place.summary}</p>
                  <div className="v2-stop__facts">
                    <span>{stop.place.address}</span>
                    <span>
                      {price(stop.price.minYen, stop.price.maxYen)} ·{" "}
                      {stop.price.label}. {priceBasis(stop.priceProvenance)}
                    </span>
                    <span>{stop.openingFit}</span>
                  </div>
                  <p className="v2-stop__reason">{stop.whyThisStop}</p>
                  <div className="v2-stop__actions">
                    <button
                      className="v2-secondary-action"
                      disabled={swapping}
                      onClick={() => onSwap(stop.place.placeId, "CHEAPER")}
                      type="button"
                    >
                      Cheaper
                    </button>
                    <button
                      className="v2-secondary-action"
                      disabled={swapping}
                      onClick={() => onSwap(stop.place.placeId, "LESS_WALKING")}
                      type="button"
                    >
                      Less walking
                    </button>
                    <button
                      className="v2-secondary-action"
                      disabled={swapping}
                      onClick={() =>
                        onSwap(stop.place.placeId, "DIFFERENT_INTEREST")
                      }
                      type="button"
                    >
                      Different interest
                    </button>
                    <a
                      href={stop.place.officialUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Check official site ↗
                    </a>
                  </div>

                  <details
                    className="v2-source-details"
                    onToggle={(event) => {
                      if (event.currentTarget.open && !evidence) {
                        onEvidence(stop.place.placeId);
                      }
                    }}
                    open={evidenceOpen}
                  >
                    <summary>
                      Schedule evidence · compared{" "}
                      {stop.sourceCheckedAt.slice(0, 10)}
                    </summary>
                    {evidenceLoadingPlaceId === stop.place.placeId ? (
                      <p role="status">Loading source evidence…</p>
                    ) : evidence ? (
                      <ul>
                        {claims.map((claim) => (
                          <li key={claim.kind}>
                            <strong>{category(claim.kind)}</strong>
                            <span>{claim.value}</span>
                            <span>
                              {claim.publisher} · compared{" "}
                              {claim.checkedAt.slice(0, 10)}
                            </span>
                            <a
                              href={claim.sourceUrl}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              Open source ↗
                            </a>
                          </li>
                        ))}
                        {supplementalScheduleSources.map((source) => (
                          <li key={`calendar-${source.sourceId}`}>
                            <strong>Schedule calendar</strong>
                            <span>{source.title}</span>
                            <span>
                              {source.publisher} · compared{" "}
                              {source.checkedAt.slice(0, 10)}
                            </span>
                            <a
                              href={source.url}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              Open calendar source ↗
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>
                        Identity source: {stop.sourcePublisher}. Open to inspect
                        the separate address, coordinate, hours, and price
                        sources.
                      </p>
                    )}
                  </details>
                </article>
              </li>
            );
          })}
        </ol>

        <div className="v2-plan-actions">
          <button
            className="v2-primary-action"
            disabled={storagePending || isSaved}
            onClick={onSave}
            type="button"
          >
            {storagePending
              ? "Saving…"
              : isSaved
                ? "Plan saved"
                : "Save this plan"}
          </button>
          <p aria-live="polite" className="v2-live-message">
            {isSaved
              ? "Saved in this browser with its source snapshot."
              : "Saving never opens or books an external site."}
          </p>
        </div>
      </article>

      <details className="v2-saved-plans">
        <summary>Saved plans ({savedPlans.length})</summary>
        {storageCorrupt ? (
          <p className="v2-inline-error" role="alert">
            Some saved data could not be read. It was left unchanged.
          </p>
        ) : null}
        {savedPlans.length === 0 ? (
          <p>No saved plans in this browser yet.</p>
        ) : (
          <ul className="v2-saved-list">
            {savedPlans.map((saved) => (
              <li key={saved.savedPlanId}>
                <div>
                  <strong>
                    {saved.itinerary.stops
                      .map(({ place }) => place.name)
                      .join(" → ")}
                  </strong>
                  <span>
                    Saved {new Date(saved.savedAt).toLocaleString("en-GB")} ·
                    verify sources before going
                  </span>
                </div>
                <button
                  className="v2-text-action"
                  onClick={() => onDeleteSaved(saved.savedPlanId)}
                  type="button"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>
    </>
  );
}
