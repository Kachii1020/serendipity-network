"use client";

import type {
  EvidenceClaimV3,
  EveningPlanV3,
  GooglePlaceSignalV3,
  PlaceEvidenceV3,
  SwapPreferenceV3,
} from "@serendipity/contracts/planner-v3";
import { useEffect, useRef, useState } from "react";

import { areaLabel } from "./planner-options";

const yen = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    currency: "JPY",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);

const time = (value: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));

const stopPrice = (minimum: number, maximum: number): string => {
  if (minimum === 0 && maximum === 0) return "Free";
  if (minimum === maximum) return `${yen(maximum)} / person`;
  return `${yen(minimum)}–${yen(maximum)} / person`;
};

function ChangeStopDialog({
  onChoose,
  onClose,
  placeName,
}: {
  readonly onChoose: (preference: SwapPreferenceV3) => void;
  readonly onClose: () => void;
  readonly placeName: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    cancelRef.current?.focus();

    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      aria-labelledby="v3-change-title"
      className="v3-dialog"
      onClose={onClose}
      ref={dialogRef}
    >
      <div>
        <p>Change one stop</p>
        <h2 id="v3-change-title">Replace {placeName}</h2>
        <p>
          The other stops stay fixed while time, budget, and walking are
          rechecked.
        </p>
        <button onClick={() => onChoose("CHEAPER")} type="button">
          Cheaper
        </button>
        <button onClick={() => onChoose("LESS_WALKING")} type="button">
          Less walking
        </button>
        <button onClick={() => onChoose("DIFFERENT_INTEREST")} type="button">
          Different interest
        </button>
        <button
          onClick={() => dialogRef.current?.close()}
          ref={cancelRef}
          type="button"
        >
          Cancel
        </button>
      </div>
    </dialog>
  );
}

export function PlannerPlanV3({
  evidenceByPlace,
  enrichmentByPlace,
  interactionReady,
  onEvidence,
  onSave,
  onSwap,
  openEvidencePlaceId,
  plan,
  saveAnnouncement,
  saving,
  swapping,
  warnings,
}: {
  readonly evidenceByPlace: Readonly<Record<string, PlaceEvidenceV3>>;
  readonly enrichmentByPlace: Readonly<Record<string, GooglePlaceSignalV3>>;
  readonly interactionReady: boolean;
  readonly onEvidence: (placeId: string, open: boolean) => void;
  readonly onSave: () => void;
  readonly onSwap: (placeId: string, preference: SwapPreferenceV3) => void;
  readonly openEvidencePlaceId: string | null;
  readonly plan: EveningPlanV3;
  readonly saveAnnouncement: string;
  readonly saving: boolean;
  readonly swapping: boolean;
  readonly warnings: readonly string[];
}) {
  const [changePlaceId, setChangePlaceId] = useState<string | null>(null);
  const changeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeChangeDialog = () => {
    setChangePlaceId(null);
    requestAnimationFrame(() => changeTriggerRef.current?.focus());
  };
  const area = areaLabel(plan.intent.area);
  const changing = plan.stops.find(
    ({ place }) => place.placeId === changePlaceId,
  );
  return (
    <>
      <section className="v3-result-title" tabIndex={-1}>
        <h1>Your {area} night</h1>
      </section>
      <ul aria-label="Plan summary" className="v3-stat-grid">
        <li className="v3-stat">{plan.totals.stopCount} stops</li>
        <li className="v3-stat">
          {plan.intent.partySize}{" "}
          {plan.intent.partySize === 1 ? "adult" : "adults"}
        </li>
        <li className="v3-stat">
          {yen(plan.totals.perPersonMaxYen)} / person ·{" "}
          {yen(plan.totals.estimatedGroupMaxYen)} group estimate
        </li>
        <li className="v3-stat">
          {plan.totals.totalWalkMinutes} min walking ·{" "}
          {time(plan.totals.startsAt)}–{time(plan.totals.endsAt)}
        </li>
      </ul>
      <div className="v3-trust-block">
        <p className="v3-trust-note">{plan.disclaimer}</p>
        {plan.totals.stopCount === 2 ? (
          <p className="v3-fallback-note">
            Two-stop fallback: no third published-hours stop fit the selected
            constraints.
          </p>
        ) : null}
        <details className="v3-trust-details">
          <summary>Estimate details</summary>
          <p>
            Walking is coordinate-estimated. Totals exclude transport and
            unlisted extras, taxes, or service charges.
          </p>
        </details>
      </div>
      {warnings.length > 0 ? (
        <p className="v3-warning" role="status">
          {warnings.join(" ")}
        </p>
      ) : null}
      <ol className="v3-route" data-count={plan.stops.length}>
        {plan.stops.map((stop, index) => {
          const evidence = evidenceByPlace[stop.place.placeId];
          const google = enrichmentByPlace[stop.place.placeId];
          const claims = evidence
            ? Object.values(evidence.claims).filter(
                (claim): claim is EvidenceClaimV3 => claim !== null,
              )
            : [];
          return (
            <li key={stop.place.placeId}>
              <article
                className="v3-stop"
                id={`v3-place-${stop.place.placeId}`}
                tabIndex={-1}
              >
                <p className="v3-stop__kicker">
                  {String(index + 1).padStart(2, "0")} · {stop.place.role}
                </p>
                <p className="v3-stop__walk">
                  {stop.travelFromPreviousMinutes} min walk from{" "}
                  {index === 0 ? stop.travelOriginLabel : "previous stop"}
                </p>
                <h2>{stop.place.name}</h2>
                <p className="v3-stop__summary">{stop.place.summary}</p>
                <div className="v3-stop__facts">
                  <span>
                    {time(stop.startsAt)}–{time(stop.endsAt)}
                  </span>
                  <span>
                    {stopPrice(
                      stop.cost.perPersonMinYen,
                      stop.cost.perPersonMaxYen,
                    )}
                  </span>
                  <span>{stop.place.address}</span>
                </div>
                <p className="v3-stop__reason">{stop.whyThisStop}</p>
                <div className="v3-stop__actions">
                  <button
                    disabled={!interactionReady || swapping}
                    onClick={(event) => {
                      changeTriggerRef.current = event.currentTarget;
                      setChangePlaceId(stop.place.placeId);
                    }}
                    type="button"
                  >
                    Change this stop
                  </button>
                  <a
                    href={stop.place.officialUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Check official site ↗
                  </a>
                  <details
                    className="v3-evidence"
                    data-evidence-place-id={stop.place.placeId}
                    id={`v3-evidence-${stop.place.placeId}`}
                    open={openEvidencePlaceId === stop.place.placeId}
                    tabIndex={-1}
                  >
                    <summary
                      onClick={(event) => {
                        event.preventDefault();
                        onEvidence(
                          stop.place.placeId,
                          openEvidencePlaceId !== stop.place.placeId,
                        );
                      }}
                    >
                      Sources & hours
                    </summary>
                    <div>
                      <h3>Sources for {stop.place.name}</h3>
                      <p>{stop.openingFit}</p>
                      <p>{stop.price.label}</p>
                      {evidence ? (
                        <ul className="v3-evidence-list">
                          {claims.map((claim) => (
                            <li key={claim.kind}>
                              <strong>{claim.kind.replaceAll("_", " ")}</strong>
                              <span>{claim.value}</span>
                              <span>{claim.sourceTitle}</span>
                              <span>
                                {claim.publisher} · checked{" "}
                                {claim.checkedAt.slice(0, 10)}
                              </span>
                              <a
                                href={claim.sourceUrl}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                {claim.kind === "MENU"
                                  ? "Open official menu ↗"
                                  : `Open ${claim.publisher} source ↗`}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>Open to load official evidence.</p>
                      )}
                      {google ? (
                        <div
                          aria-label="Google Maps attribution"
                          className="v3-google-attribution"
                        >
                          <strong className="v3-google-brand" translate="no">
                            Google Maps
                          </strong>
                          <span>
                            {google.openNow === false
                              ? "Google lists this place as closed for your planned time."
                              : "Transient place context—check again before you go."}
                          </span>
                          {google.googleMapsUri ? (
                            <a
                              href={google.googleMapsUri}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              View on Google Maps ↗
                            </a>
                          ) : null}
                          {google.attributions.map((attribution) =>
                            attribution.uri ? (
                              <a
                                href={attribution.uri}
                                key={attribution.provider}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                Data: {attribution.provider}
                              </a>
                            ) : (
                              <span key={attribution.provider}>
                                Data: {attribution.provider}
                              </span>
                            ),
                          )}
                        </div>
                      ) : null}
                    </div>
                  </details>
                </div>
              </article>
            </li>
          );
        })}
      </ol>
      <div className="v3-save">
        <button
          className="v3-primary"
          disabled={!interactionReady || saving}
          onClick={onSave}
          type="button"
        >
          {saving ? "Saving…" : "Save this plan"}
        </button>
        <p aria-live="polite" className="v3-save-status" role="status">
          {saveAnnouncement}
        </p>
      </div>
      {changing ? (
        <ChangeStopDialog
          onChoose={(preference) => {
            setChangePlaceId(null);
            onSwap(changing.place.placeId, preference);
          }}
          onClose={closeChangeDialog}
          placeName={changing.place.name}
        />
      ) : null}
    </>
  );
}
