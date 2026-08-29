"use client";

import {
  PLANNER_SCHEMA_VERSION,
  validateEveningPlanV2,
  validatePlannerEnvelopeV2,
  type PlaceEvidenceDataV2,
  type PlaceEvidenceV2,
  type PlannerErrorCodeV2,
  type PlannerEnvelopeV2,
  type PlannerIntentV2,
  type SearchPlansDataV2,
  type SwapPlanDataV2,
  type SwapPlanInputV2,
} from "@serendipity/contracts/planner-v2";
import { isWebMcpAvailable } from "@serendipity/webmcp";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import {
  PLANNER_V2_TOOL_NAMES,
  registerPlannerV2Tools,
  type DeleteSavedPlanToolInputV2,
  type PlannerV2ToolInput,
  type PlannerV2ToolName,
  type SavePlanToolInputV2,
  type ShowPlaceEvidenceToolInputV2,
  type SwapPlanStopToolInputV2,
} from "../../lib/tools/planner-v2-tools";
import { DecisionDialog } from "../product/decision-dialog";
import { PlannerConnectionStatus } from "./planner-connection";
import { PlannerForm, type PlannerFormDefaults } from "./planner-form";
import {
  initialPlannerState,
  plannerBusy,
  plannerReducer,
  type PlannerState,
  type PlannerUiError,
} from "./planner-machine";
import { PlannerPlan } from "./planner-plan";
import {
  deletePlanSnapshot,
  loadSavedPlans,
  savePlanSnapshot,
  type SavedPlanRecordV2,
} from "./planner-storage";

type PlannerTransport = "manual" | "site-tool";

type PlannerActivity = {
  readonly completedAt: string;
  readonly correlationId: string;
  readonly name: PlannerV2ToolName;
  readonly outcome: "error" | "success";
  readonly transport: PlannerTransport;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const searchData = (value: unknown): value is SearchPlansDataV2 =>
  isRecord(value) &&
  typeof value.candidateSetId === "string" &&
  validateEveningPlanV2(value.plan).ok &&
  Array.isArray(value.warnings);

const swapData = (value: unknown): value is SwapPlanDataV2 =>
  isRecord(value) &&
  typeof value.candidateSetId === "string" &&
  validateEveningPlanV2(value.plan).ok &&
  typeof value.replacedStopIndex === "number" &&
  typeof value.preference === "string";

const evidenceData = (value: unknown): value is PlaceEvidenceDataV2 =>
  isRecord(value) &&
  isRecord(value.evidence) &&
  value.evidence.schemaVersion === PLANNER_SCHEMA_VERSION &&
  typeof value.evidence.placeId === "string" &&
  Array.isArray(value.evidence.sources);

const publicError = (
  code: PlannerErrorCodeV2,
  message: string,
  retryable = false,
): PlannerUiError => ({ code, message, retryable });

const responseEnvelope = async <T,>(
  response: Response,
  dataValidator: (value: unknown) => value is T,
): Promise<PlannerEnvelopeV2<T> | undefined> => {
  try {
    const value: unknown = await response.json();
    const validated = validatePlannerEnvelopeV2(value, dataValidator);
    return validated.ok ? validated.value : undefined;
  } catch {
    return undefined;
  }
};

const focusTarget = (selector: string): void => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(selector);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  });
};

export function PlannerClient({
  autoSearch,
  defaults,
  hubOrigin,
  initialIntent,
  maxDate,
  minDate,
  packVersion,
}: {
  readonly autoSearch: boolean;
  readonly defaults: PlannerFormDefaults;
  readonly hubOrigin: string;
  readonly initialIntent: PlannerIntentV2;
  readonly maxDate: string;
  readonly minDate: string;
  readonly packVersion: string;
}) {
  const [state, dispatch] = useReducer(plannerReducer, initialPlannerState);
  const stateRef = useRef<PlannerState>(state);
  const operationLock = useRef(false);
  const autoSearchStarted = useRef(false);
  const [activities, setActivities] = useState<readonly PlannerActivity[]>([]);
  const [openEvidencePlaceId, setOpenEvidencePlaceId] = useState<string | null>(
    null,
  );
  const [changeSummary, setChangeSummary] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  stateRef.current = state;

  useEffect(() => {
    const loaded = loadSavedPlans(localStorage);
    dispatch({
      corrupt: loaded.corrupt,
      records: loaded.records,
      type: "SAVED_PLANS_LOADED",
    });
  }, []);

  const envelopeContext = useCallback(
    () => ({
      completedAt: new Date().toISOString(),
      correlationId: crypto.randomUUID(),
      origin: globalThis.location?.origin ?? new URL(hubOrigin).origin,
      packVersion,
    }),
    [hubOrigin, packVersion],
  );

  const failureEnvelope = useCallback(
    (error: PlannerUiError): PlannerEnvelopeV2<never> => ({
      schemaVersion: PLANNER_SCHEMA_VERSION,
      ok: false,
      error,
      meta: envelopeContext(),
    }),
    [envelopeContext],
  );

  const successEnvelope = useCallback(
    <T,>(data: T): PlannerEnvelopeV2<T> => ({
      schemaVersion: PLANNER_SCHEMA_VERSION,
      ok: true,
      data,
      meta: envelopeContext(),
    }),
    [envelopeContext],
  );

  const recordActivity = useCallback(
    (
      name: PlannerV2ToolName,
      transport: PlannerTransport,
      envelope: PlannerEnvelopeV2<unknown>,
    ) => {
      setActivities((current) => {
        const activity: PlannerActivity = {
          completedAt: envelope.meta.completedAt,
          correlationId: envelope.meta.correlationId,
          name,
          outcome: envelope.ok ? "success" : "error",
          transport,
        };
        return [activity, ...current].slice(0, 10);
      });
    },
    [],
  );

  const find = useCallback(
    async (
      intent: PlannerIntentV2,
      transport: PlannerTransport,
      signal?: AbortSignal,
    ): Promise<PlannerEnvelopeV2<SearchPlansDataV2>> => {
      if (operationLock.current || plannerBusy(stateRef.current)) {
        const envelope = failureEnvelope(
          publicError(
            "CANCELLED",
            "Another planner operation is already active.",
            true,
          ),
        );
        recordActivity("find_evening_plan", transport, envelope);
        return envelope;
      }
      operationLock.current = true;
      setChangeSummary(null);
      dispatch({ intent, type: "SEARCH_STARTED" });
      let envelope: PlannerEnvelopeV2<SearchPlansDataV2>;
      try {
        const response = await fetch("/api/v2/plans/search", {
          body: JSON.stringify(intent),
          headers: { "content-type": "application/json" },
          method: "POST",
          ...(signal ? { signal } : {}),
        });
        envelope =
          (await responseEnvelope(response, searchData)) ??
          failureEnvelope(
            publicError(
              "INTERNAL_ERROR",
              "The planner returned an invalid response.",
              true,
            ),
          );
      } catch {
        envelope = failureEnvelope(
          publicError(
            signal?.aborted ? "CANCELLED" : "INTERNAL_ERROR",
            signal?.aborted
              ? "The planner request was cancelled."
              : "The planner could not be reached.",
            true,
          ),
        );
      } finally {
        operationLock.current = false;
      }

      if (envelope.ok) {
        dispatch({
          candidateSetId: envelope.data.candidateSetId,
          plan: envelope.data.plan,
          type: "SEARCH_SUCCEEDED",
        });
        focusTarget(".v2-plan-summary");
      } else {
        dispatch({
          error: envelope.error,
          type:
            envelope.error.code === "NO_VALID_PLAN"
              ? "SEARCH_EMPTY"
              : "SEARCH_FAILED",
        });
        focusTarget(".v2-empty-state");
      }
      recordActivity("find_evening_plan", transport, envelope);
      return envelope;
    },
    [failureEnvelope, recordActivity],
  );

  const loadEvidence = useCallback(
    async (
      placeId: string,
      signal?: AbortSignal,
    ): Promise<PlannerEnvelopeV2<PlaceEvidenceDataV2>> => {
      try {
        const response = await fetch(
          `/api/v2/places/${encodeURIComponent(placeId)}/evidence`,
          signal ? { signal } : {},
        );
        return (
          (await responseEnvelope(response, evidenceData)) ??
          failureEnvelope(
            publicError(
              "INTERNAL_ERROR",
              "The source evidence response was invalid.",
              true,
            ),
          )
        );
      } catch {
        return failureEnvelope(
          publicError(
            signal?.aborted ? "CANCELLED" : "INTERNAL_ERROR",
            signal?.aborted
              ? "The evidence request was cancelled."
              : "Source evidence could not be loaded.",
            true,
          ),
        );
      }
    },
    [failureEnvelope],
  );

  const showEvidence = useCallback(
    async (
      input: ShowPlaceEvidenceToolInputV2,
      transport: PlannerTransport,
      signal?: AbortSignal,
    ): Promise<PlannerEnvelopeV2<PlaceEvidenceDataV2>> => {
      const current = stateRef.current;
      const matching =
        current.phase === "planned" &&
        current.candidateSetId === input.candidateSetId &&
        current.plan?.planId === input.planId &&
        current.plan.stops.some(({ place }) => place.placeId === input.placeId);
      if (!matching) {
        const envelope = failureEnvelope(
          publicError("STALE_PLAN", "That place is not in the current plan."),
        );
        recordActivity("show_place_evidence", transport, envelope);
        return envelope;
      }
      setOpenEvidencePlaceId(input.placeId);
      const cached = current.evidenceByPlace[input.placeId];
      if (cached) {
        const envelope = successEnvelope({ evidence: cached });
        focusTarget(`#place-${input.placeId} .v2-source-details`);
        recordActivity("show_place_evidence", transport, envelope);
        return envelope;
      }
      dispatch({ placeId: input.placeId, type: "EVIDENCE_STARTED" });
      const envelope = await loadEvidence(input.placeId, signal);
      if (envelope.ok) {
        dispatch({
          evidence: envelope.data.evidence,
          placeId: input.placeId,
          type: "EVIDENCE_SUCCEEDED",
        });
        focusTarget(`#place-${input.placeId} .v2-source-details`);
      } else {
        dispatch({ error: envelope.error, type: "EVIDENCE_FAILED" });
      }
      recordActivity("show_place_evidence", transport, envelope);
      return envelope;
    },
    [failureEnvelope, loadEvidence, recordActivity, successEnvelope],
  );

  const swap = useCallback(
    async (
      input: SwapPlanStopToolInputV2,
      transport: PlannerTransport,
      signal?: AbortSignal,
    ): Promise<PlannerEnvelopeV2<SwapPlanDataV2>> => {
      const current = stateRef.current;
      const stopIndex = current.plan?.stops.findIndex(
        ({ place }) => place.placeId === input.targetPlaceId,
      );
      if (
        operationLock.current ||
        current.phase !== "planned" ||
        current.candidateSetId !== input.candidateSetId ||
        current.plan?.planId !== input.planId ||
        current.intent === null ||
        stopIndex === undefined ||
        stopIndex < 0
      ) {
        const envelope = failureEnvelope(
          publicError(
            operationLock.current ? "CANCELLED" : "STALE_PLAN",
            operationLock.current
              ? "Another planner operation is already active."
              : "That stop is not in the current plan.",
            operationLock.current,
          ),
        );
        recordActivity("swap_plan_stop", transport, envelope);
        return envelope;
      }
      operationLock.current = true;
      dispatch({ type: "SWAP_STARTED" });
      const request: SwapPlanInputV2 = {
        schemaVersion: PLANNER_SCHEMA_VERSION,
        candidateSetId: current.candidateSetId,
        intent: current.intent,
        plan: current.plan,
        planId: current.plan.planId,
        preference: input.preference,
        stopIndex,
      };
      let envelope: PlannerEnvelopeV2<SwapPlanDataV2>;
      try {
        const response = await fetch("/api/v2/plans/swap", {
          body: JSON.stringify(request),
          headers: { "content-type": "application/json" },
          method: "POST",
          ...(signal ? { signal } : {}),
        });
        envelope =
          (await responseEnvelope(response, swapData)) ??
          failureEnvelope(
            publicError(
              "INTERNAL_ERROR",
              "The replacement response was invalid.",
              true,
            ),
          );
      } catch {
        envelope = failureEnvelope(
          publicError(
            signal?.aborted ? "CANCELLED" : "INTERNAL_ERROR",
            signal?.aborted
              ? "The replacement was cancelled."
              : "The replacement could not be loaded.",
            true,
          ),
        );
      } finally {
        operationLock.current = false;
      }
      if (envelope.ok) {
        const previousStop = current.plan.stops[stopIndex];
        const nextStop =
          envelope.data.plan.stops[envelope.data.replacedStopIndex];
        if (previousStop && nextStop) {
          const oldTotal = current.plan.totals.maxPriceYen;
          const nextTotal = envelope.data.plan.totals.maxPriceYen;
          setChangeSummary(
            `Replaced ${previousStop.place.name} with ${nextStop.place.name}. Reference total ¥${oldTotal.toLocaleString("en-US")} → ¥${nextTotal.toLocaleString("en-US")}; walking ${current.plan.totals.totalWalkMinutes} → ${envelope.data.plan.totals.totalWalkMinutes} min. Later times were recalculated.`,
          );
        }
        dispatch({ plan: envelope.data.plan, type: "SWAP_SUCCEEDED" });
        const changed =
          envelope.data.plan.stops[envelope.data.replacedStopIndex];
        if (changed) focusTarget(`#place-${changed.place.placeId}`);
      } else {
        dispatch({ error: envelope.error, type: "SWAP_FAILED" });
      }
      recordActivity("swap_plan_stop", transport, envelope);
      return envelope;
    },
    [failureEnvelope, recordActivity],
  );

  const save = useCallback(
    async (
      input: SavePlanToolInputV2,
      transport: PlannerTransport,
      signal?: AbortSignal,
    ): Promise<
      PlannerEnvelopeV2<{
        savedAt: string;
        savedPlanId: string;
        status: string;
      }>
    > => {
      const current = stateRef.current;
      if (
        current.phase !== "planned" ||
        current.candidateSetId !== input.candidateSetId ||
        current.plan?.planId !== input.planId ||
        current.intent === null ||
        current.storagePending
      ) {
        const envelope = failureEnvelope(
          publicError("STALE_PLAN", "Only the current plan can be saved."),
        );
        recordActivity("save_plan", transport, envelope);
        return envelope;
      }
      dispatch({ type: "SAVE_STARTED" });
      const evidence: Record<string, PlaceEvidenceV2> = {
        ...current.evidenceByPlace,
      };
      for (const stop of current.plan.stops) {
        if (evidence[stop.place.placeId]) continue;
        const loaded = await loadEvidence(stop.place.placeId, signal);
        if (!loaded.ok) {
          dispatch({ error: loaded.error, type: "SAVE_FAILED" });
          recordActivity("save_plan", transport, loaded);
          return loaded;
        }
        evidence[stop.place.placeId] = loaded.data.evidence;
      }
      const savedAt = new Date().toISOString();
      const record: SavedPlanRecordV2 = {
        evidence,
        intent: current.intent,
        itinerary: current.plan,
        savedAt,
        savedPlanId: current.plan.planId,
      };
      const result = savePlanSnapshot(localStorage, record);
      const envelope = result.ok
        ? successEnvelope({
            savedAt,
            savedPlanId: result.savedPlanId,
            status: result.status,
          })
        : failureEnvelope(publicError(result.code, result.message));
      if (result.ok) {
        dispatch({ records: result.records, type: "SAVE_SUCCEEDED" });
      } else {
        dispatch({
          error: publicError(result.code, result.message),
          type: "SAVE_FAILED",
        });
      }
      recordActivity("save_plan", transport, envelope);
      return envelope;
    },
    [failureEnvelope, loadEvidence, recordActivity, successEnvelope],
  );

  const deleteSaved = useCallback(
    (
      input: DeleteSavedPlanToolInputV2,
      transport: PlannerTransport,
    ): PlannerEnvelopeV2<{ deleted: boolean; savedPlanId: string }> => {
      const result = deletePlanSnapshot(localStorage, input.planId);
      const envelope = result.ok
        ? successEnvelope({
            deleted: result.status === "DELETED",
            savedPlanId: result.savedPlanId,
          })
        : failureEnvelope(publicError(result.code, result.message));
      if (result.ok) {
        dispatch({ records: result.records, type: "DELETE_SUCCEEDED" });
      } else {
        dispatch({
          error: publicError(result.code, result.message),
          type: "DELETE_FAILED",
        });
      }
      recordActivity("delete_saved_plan", transport, envelope);
      return envelope;
    },
    [failureEnvelope, recordActivity, successEnvelope],
  );

  const checkState = useCallback(
    (name: PlannerV2ToolName, input: PlannerV2ToolInput) => {
      const current = stateRef.current;
      if (plannerBusy(current)) {
        return {
          ok: false as const,
          error: publicError(
            "CANCELLED",
            "Another planner operation is already active.",
            true,
          ),
        };
      }
      if (name === "find_evening_plan") return { ok: true as const };
      if (name === "delete_saved_plan") {
        const savedPlanId = (input as DeleteSavedPlanToolInputV2).planId;
        return current.savedPlans.some(
          (record) => record.savedPlanId === savedPlanId,
        )
          ? { ok: true as const }
          : {
              ok: false as const,
              error: publicError(
                "STALE_PLAN",
                "That saved plan is not in this browser.",
              ),
            };
      }
      const reference = input as SavePlanToolInputV2;
      return current.phase === "planned" &&
        current.candidateSetId === reference.candidateSetId &&
        current.plan?.planId === reference.planId
        ? { ok: true as const }
        : {
            ok: false as const,
            error: publicError(
              "STALE_PLAN",
              "That reference does not match the current plan.",
            ),
          };
    },
    [],
  );

  const controllerRef = useRef({
    checkState,
    deleteSaved,
    find,
    save,
    showEvidence,
    swap,
  });
  controllerRef.current = {
    checkState,
    deleteSaved,
    find,
    save,
    showEvidence,
    swap,
  };

  useEffect(() => {
    if (!isWebMcpAvailable(document)) return;
    const registration = registerPlannerV2Tools(
      {
        checkState: (name, input) =>
          controllerRef.current.checkState(name, input),
        deleteSaved: (input) =>
          controllerRef.current.deleteSaved(input, "site-tool"),
        find: (input, _transport, signal) =>
          controllerRef.current.find(input, "site-tool", signal),
        hubOrigin: globalThis.location.origin,
        packVersion,
        save: (input, _transport, signal) =>
          controllerRef.current.save(input, "site-tool", signal),
        showEvidence: (input, _transport, signal) =>
          controllerRef.current.showEvidence(input, "site-tool", signal),
        swap: (input, _transport, signal) =>
          controllerRef.current.swap(input, "site-tool", signal),
      },
      document,
    );
    void registration.ready.catch(() => undefined);
    return () => registration.dispose();
  }, [hubOrigin, packVersion]);

  useEffect(() => {
    if (!autoSearch || autoSearchStarted.current) return;
    autoSearchStarted.current = true;
    void find(initialIntent, "manual");
  }, [autoSearch, find, initialIntent]);

  const plannerReference = useMemo(() => {
    if (!state.plan || !state.candidateSetId) return null;
    return {
      candidateSetId: state.candidateSetId,
      planId: state.plan.planId,
      schemaVersion: PLANNER_SCHEMA_VERSION,
    } as const;
  }, [state.candidateSetId, state.plan]);

  return (
    <div className="v2-planner-shell">
      <a className="skip-link" href="#planner-content">
        Skip to plan
      </a>
      <header className="v2-header">
        <Link className="wordmark" href="/" translate="no">
          SERENDIPITY<span aria-hidden="true">✦</span>
        </Link>
        <PlannerConnectionStatus />
      </header>
      <main className="v2-planner-main" id="planner-content">
        <div className="v2-planner-layout">
          <aside className="v2-planner-sidebar">
            <div className="v2-form-card">
              <div className="v2-form-card__heading">
                <span>Start at Shibuya Station</span>
                <strong>Adjust the plan</strong>
              </div>
              <PlannerForm
                defaults={defaults}
                maxDate={maxDate}
                minDate={minDate}
              />
            </div>
          </aside>
          <section className="v2-planner-content">
            {state.plan && state.phase !== "searching" ? (
              <PlannerPlan
                changeSummary={changeSummary}
                evidenceByPlace={state.evidenceByPlace}
                evidenceLoadingPlaceId={state.evidenceLoadingPlaceId}
                inlineError={state.inlineError}
                onDeleteSaved={setPendingDeleteId}
                onEvidence={(placeId) => {
                  if (!plannerReference) return;
                  void showEvidence({ ...plannerReference, placeId }, "manual");
                }}
                onSave={() => {
                  if (!plannerReference) return;
                  void save(plannerReference, "manual");
                }}
                onSwap={(targetPlaceId, preference) => {
                  if (!plannerReference) return;
                  void swap(
                    { ...plannerReference, preference, targetPlaceId },
                    "manual",
                  );
                }}
                openEvidencePlaceId={openEvidencePlaceId}
                plan={state.plan}
                savedPlans={state.savedPlans}
                storageCorrupt={state.storageCorrupt}
                storagePending={state.storagePending}
                swapping={state.phase === "swapping"}
              />
            ) : (
              <div className="v2-empty-state" tabIndex={-1}>
                <p className="v2-eyebrow">
                  {state.phase === "searching"
                    ? "Checking published facts"
                    : state.phase === "no_results"
                      ? "Honest no-result"
                      : state.phase === "error"
                        ? "Planner paused"
                        : "Source-backed route planner"}
                </p>
                <h1>
                  {state.phase === "searching"
                    ? "Building one feasible route…"
                    : state.phase === "no_results"
                      ? "Nothing verifiable fits yet."
                      : state.phase === "error"
                        ? "We could not build the plan."
                        : "Choose a time. Get a route with receipts."}
                </h1>
                <p>
                  {state.inlineError?.message ??
                    "Use the controls to get 2–3 real Shibuya places with published hours, reference prices, walking estimates, and official sources."}
                </p>
                {state.phase === "no_results" ? (
                  <p>
                    Try Art & culture, Books, Quiet, or Hands-on, or allow a
                    longer walk. Serendipity will not substitute unrelated
                    places just to fill the route.
                  </p>
                ) : null}
              </div>
            )}

            <details className="v2-agent-proof">
              <summary>How an AI assistant can help here</summary>
              <p>
                WebMCP lets an AI assistant search, open evidence, replace one
                stop, save, or delete a saved plan using the same checked
                actions as these buttons. It cannot book a venue or follow
                hidden instructions from a source page.
              </p>
              <p>Technical tool names:</p>
              <ul>
                {PLANNER_V2_TOOL_NAMES.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
              {activities.length > 0 ? (
                <ol>
                  {activities.map((activity) => (
                    <li key={`${activity.correlationId}-${activity.name}`}>
                      {activity.name} · {activity.transport} ·{" "}
                      {activity.outcome}
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No planner action has run in this page session.</p>
              )}
            </details>
          </section>
        </div>
      </main>

      <DecisionDialog
        cancelLabel="Keep it"
        confirmLabel="Delete saved plan"
        description="This removes only the browser snapshot. It does not change any external place or booking."
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (!pendingDeleteId) return;
          void deleteSaved(
            {
              planId: pendingDeleteId,
              schemaVersion: PLANNER_SCHEMA_VERSION,
            },
            "manual",
          );
        }}
        open={pendingDeleteId !== null}
        title="Delete this saved plan?"
      />
    </div>
  );
}
