"use client";

import type {
  PlaceEvidenceDataV2,
  PlaceEvidenceV2,
  PlannerErrorCodeV2,
  PlannerEnvelopeV2,
  PlannerIntentV2,
  SearchPlansDataV2,
  SwapPlanDataV2,
  SwapPlanInputV2,
} from "@serendipity/contracts/planner-v2";
import {
  PLANNER_SCHEMA_VERSION,
  validatePlannerEnvelopeV2Client,
} from "@serendipity/contracts/planner-v2-shared";
import { isWebMcpAvailable } from "@serendipity/webmcp";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type FormEvent,
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
  validatePlannerV2EvidenceData,
  validatePlannerV2SearchData,
  validatePlannerV2SwapData,
} from "../../lib/tools/planner-v2-tools";
import { DecisionDialog } from "../product/decision-dialog";
import {
  PlannerConnectionStatus,
  type PlannerConnectionMode,
} from "./planner-connection";
import { PlannerForm } from "./planner-form";
import {
  initialPlannerState,
  plannerBusy,
  plannerReducer,
  type PlannerState,
  type PlannerUiError,
} from "./planner-machine";
import type { PlannerFormDefaults } from "./planner-options";
import { PlannerPlan } from "./planner-plan";
import {
  normalizePlannerQuery,
  plannerFormDefaultsFromIntent,
  plannerIntentFromDefaults,
  plannerSearchParamsFromDefaults,
  type PlannerQuery,
} from "./planner-query";
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

const queryFromFormData = (form: HTMLFormElement): PlannerQuery => {
  const params = new URLSearchParams();
  for (const [key, value] of new FormData(form)) {
    if (typeof value === "string") params.append(key, value);
  }
  const query: PlannerQuery = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    query[key] = values.length === 1 ? values[0] : values;
  }
  return query;
};

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
    return validatePlannerEnvelopeV2Client(value) &&
      isRecord(value) &&
      (!value.ok || dataValidator(value.data))
      ? (value as PlannerEnvelopeV2<T>)
      : undefined;
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
  earliestStartToday,
  hubOrigin,
  initialIntent,
  maxDate,
  minDate,
  packVersion,
  plannerPath = "/plan",
}: {
  readonly autoSearch: boolean;
  readonly defaults: PlannerFormDefaults;
  readonly earliestStartToday: string | null;
  readonly hubOrigin: string;
  readonly initialIntent: PlannerIntentV2;
  readonly maxDate: string;
  readonly minDate: string;
  readonly packVersion: string;
  readonly plannerPath?: string;
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
  const [formDefaults, setFormDefaults] = useState(defaults);
  const [formError, setFormError] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] =
    useState<PlannerConnectionMode>("checking");

  stateRef.current = state;

  useEffect(() => {
    const loaded = loadSavedPlans(localStorage);
    dispatch({
      corrupt: loaded.corrupt,
      records: loaded.records,
      type: "SAVED_PLANS_LOADED",
    });
  }, []);

  useEffect(() => {
    const reconcileHistory = () => globalThis.location.reload();
    globalThis.addEventListener("popstate", reconcileHistory);
    return () => globalThis.removeEventListener("popstate", reconcileHistory);
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

  const cancelledAction = useCallback(
    (
      name: PlannerV2ToolName,
      transport: PlannerTransport,
      message: string,
    ): PlannerEnvelopeV2<never> => {
      const envelope = failureEnvelope(publicError("CANCELLED", message, true));
      recordActivity(name, transport, envelope);
      return envelope;
    },
    [failureEnvelope, recordActivity],
  );

  const projectIntent = useCallback(
    (intent: PlannerIntentV2) => {
      const nextDefaults = plannerFormDefaultsFromIntent(intent);
      setFormDefaults(nextDefaults);
      setFormError(null);
      const nextUrl = `${plannerPath}?${plannerSearchParamsFromDefaults(nextDefaults)}`;
      if (
        `${globalThis.location.pathname}${globalThis.location.search}` !==
        nextUrl
      ) {
        globalThis.history.pushState(null, "", nextUrl);
      }
    },
    [plannerPath],
  );

  const find = useCallback(
    async (
      intent: PlannerIntentV2,
      transport: PlannerTransport,
      signal?: AbortSignal,
    ): Promise<PlannerEnvelopeV2<SearchPlansDataV2>> => {
      if (signal?.aborted) {
        return cancelledAction(
          "find_evening_plan",
          transport,
          "The planner request was cancelled.",
        );
      }
      const previous = stateRef.current;
      if (operationLock.current || plannerBusy(previous)) {
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
      projectIntent(intent);
      setChangeSummary(null);
      setOpenEvidencePlaceId(null);
      dispatch({ intent, type: "SEARCH_STARTED" });
      const validationClock = new Date();
      let envelope: PlannerEnvelopeV2<SearchPlansDataV2>;
      try {
        const response = await fetch("/api/v2/plans/search", {
          body: JSON.stringify(intent),
          headers: { "content-type": "application/json" },
          method: "POST",
          ...(signal ? { signal } : {}),
        });
        envelope =
          (await responseEnvelope(
            response,
            (value): value is SearchPlansDataV2 =>
              validatePlannerV2SearchData(
                value,
                intent,
                packVersion,
                validationClock,
              ),
          )) ??
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

      if (signal?.aborted && envelope.ok) {
        envelope = failureEnvelope(
          publicError("CANCELLED", "The planner request was cancelled.", true),
        );
      }

      if (envelope.ok) {
        dispatch({
          candidateSetId: envelope.data.candidateSetId,
          plan: envelope.data.plan,
          type: "SEARCH_SUCCEEDED",
          warnings: envelope.data.warnings,
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
        focusTarget(
          previous.phase === "planned" && previous.plan
            ? ".v2-plan-summary"
            : ".v2-empty-state",
        );
      }
      recordActivity("find_evening_plan", transport, envelope);
      return envelope;
    },
    [
      cancelledAction,
      failureEnvelope,
      packVersion,
      projectIntent,
      recordActivity,
    ],
  );

  const submitPlannerForm = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const normalized = normalizePlannerQuery(
        queryFromFormData(event.currentTarget),
        new Date(),
        maxDate,
      );
      if (normalized.invalid) {
        setFormError(
          "Choose a future 2–10 hour window, up to 5 non-conflicting interests, and a walking limit from 5 to 30 minutes.",
        );
        return;
      }
      setFormError(null);
      void find(plannerIntentFromDefaults(normalized.defaults), "manual");
    },
    [find, maxDate],
  );

  const loadEvidence = useCallback(
    async (
      placeId: string,
      signal?: AbortSignal,
    ): Promise<PlannerEnvelopeV2<PlaceEvidenceDataV2>> => {
      if (signal?.aborted) {
        return failureEnvelope(
          publicError("CANCELLED", "The evidence request was cancelled.", true),
        );
      }
      try {
        const response = await fetch(
          `/api/v2/places/${encodeURIComponent(placeId)}/evidence`,
          signal ? { signal } : {},
        );
        return (
          (await responseEnvelope(
            response,
            (value): value is PlaceEvidenceDataV2 =>
              validatePlannerV2EvidenceData(value, placeId, packVersion),
          )) ??
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
    [failureEnvelope, packVersion],
  );

  const showEvidence = useCallback(
    async (
      input: ShowPlaceEvidenceToolInputV2,
      transport: PlannerTransport,
      signal?: AbortSignal,
    ): Promise<PlannerEnvelopeV2<PlaceEvidenceDataV2>> => {
      if (signal?.aborted) {
        return cancelledAction(
          "show_place_evidence",
          transport,
          "The evidence request was cancelled.",
        );
      }
      const current = stateRef.current;
      const sourcePlanId = current.plan?.planId;
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
      if (!sourcePlanId) {
        const envelope = failureEnvelope(
          publicError("STALE_PLAN", "That place is not in the current plan."),
        );
        recordActivity("show_place_evidence", transport, envelope);
        return envelope;
      }
      dispatch({
        placeId: input.placeId,
        planId: sourcePlanId,
        type: "EVIDENCE_STARTED",
      });
      let envelope = await loadEvidence(input.placeId, signal);
      if (signal?.aborted && envelope.ok) {
        envelope = failureEnvelope(
          publicError("CANCELLED", "The evidence request was cancelled.", true),
        );
      }
      const latest = stateRef.current;
      const stillCurrent =
        latest.phase === "planned" &&
        latest.plan?.planId === sourcePlanId &&
        latest.plan.stops.some(({ place }) => place.placeId === input.placeId);
      if (!stillCurrent && envelope.ok) {
        envelope = failureEnvelope(
          publicError(
            "CANCELLED",
            "The plan changed before evidence finished loading.",
            true,
          ),
        );
      }
      if (envelope.ok) {
        dispatch({
          evidence: envelope.data.evidence,
          placeId: input.placeId,
          planId: sourcePlanId,
          type: "EVIDENCE_SUCCEEDED",
        });
        focusTarget(`#place-${input.placeId} .v2-source-details`);
      } else {
        dispatch({
          error: envelope.error,
          planId: sourcePlanId,
          type: "EVIDENCE_FAILED",
        });
      }
      recordActivity("show_place_evidence", transport, envelope);
      return envelope;
    },
    [
      cancelledAction,
      failureEnvelope,
      loadEvidence,
      recordActivity,
      successEnvelope,
    ],
  );

  const swap = useCallback(
    async (
      input: SwapPlanStopToolInputV2,
      transport: PlannerTransport,
      signal?: AbortSignal,
    ): Promise<PlannerEnvelopeV2<SwapPlanDataV2>> => {
      if (signal?.aborted) {
        return cancelledAction(
          "swap_plan_stop",
          transport,
          "The replacement was cancelled.",
        );
      }
      const current = stateRef.current;
      const stopIndex = current.plan?.stops.findIndex(
        ({ place }) => place.placeId === input.targetPlaceId,
      );
      const busy = operationLock.current || plannerBusy(current);
      if (
        busy ||
        current.phase !== "planned" ||
        current.candidateSetId !== input.candidateSetId ||
        current.plan?.planId !== input.planId ||
        current.intent === null ||
        stopIndex === undefined ||
        stopIndex < 0
      ) {
        const envelope = failureEnvelope(
          publicError(
            busy ? "CANCELLED" : "STALE_PLAN",
            busy
              ? "Another planner operation is already active."
              : "That stop is not in the current plan.",
            busy,
          ),
        );
        recordActivity("swap_plan_stop", transport, envelope);
        return envelope;
      }
      operationLock.current = true;
      setOpenEvidencePlaceId(null);
      dispatch({ type: "SWAP_STARTED" });
      const validationClock = new Date();
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
          (await responseEnvelope(response, (value): value is SwapPlanDataV2 =>
            validatePlannerV2SwapData(
              value,
              input,
              packVersion,
              validationClock,
            ),
          )) ??
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
      if (signal?.aborted && envelope.ok) {
        envelope = failureEnvelope(
          publicError("CANCELLED", "The replacement was cancelled.", true),
        );
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
        dispatch({
          plan: envelope.data.plan,
          type: "SWAP_SUCCEEDED",
          warnings: envelope.data.warnings,
        });
        setOpenEvidencePlaceId(null);
        const changed =
          envelope.data.plan.stops[envelope.data.replacedStopIndex];
        if (changed) focusTarget(`#place-${changed.place.placeId}`);
      } else {
        dispatch({ error: envelope.error, type: "SWAP_FAILED" });
      }
      recordActivity("swap_plan_stop", transport, envelope);
      return envelope;
    },
    [cancelledAction, failureEnvelope, packVersion, recordActivity],
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
      if (signal?.aborted) {
        return cancelledAction(
          "save_plan",
          transport,
          "The save request was cancelled.",
        );
      }
      const current = stateRef.current;
      const busy = operationLock.current || plannerBusy(current);
      if (
        busy ||
        current.phase !== "planned" ||
        current.candidateSetId !== input.candidateSetId ||
        current.plan?.planId !== input.planId ||
        current.intent === null ||
        current.storagePending
      ) {
        const envelope = failureEnvelope(
          publicError(
            busy ? "CANCELLED" : "STALE_PLAN",
            busy
              ? "Another planner operation is already active."
              : "Only the current plan can be saved.",
            busy,
          ),
        );
        recordActivity("save_plan", transport, envelope);
        return envelope;
      }
      operationLock.current = true;
      dispatch({ type: "SAVE_STARTED" });
      const evidence: Record<string, PlaceEvidenceV2> = {
        ...current.evidenceByPlace,
      };
      for (const stop of current.plan.stops) {
        if (evidence[stop.place.placeId]) continue;
        const loaded = await loadEvidence(stop.place.placeId, signal);
        if (!loaded.ok) {
          operationLock.current = false;
          dispatch({ error: loaded.error, type: "SAVE_FAILED" });
          recordActivity("save_plan", transport, loaded);
          return loaded;
        }
        evidence[stop.place.placeId] = loaded.data.evidence;
      }
      if (signal?.aborted) {
        operationLock.current = false;
        const error = publicError(
          "CANCELLED",
          "The save request was cancelled.",
          true,
        );
        const envelope = failureEnvelope(error);
        dispatch({ error, type: "SAVE_FAILED" });
        recordActivity("save_plan", transport, envelope);
        return envelope;
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
      operationLock.current = false;
      recordActivity("save_plan", transport, envelope);
      return envelope;
    },
    [
      cancelledAction,
      failureEnvelope,
      loadEvidence,
      recordActivity,
      successEnvelope,
    ],
  );

  const deleteSaved = useCallback(
    (
      input: DeleteSavedPlanToolInputV2,
      transport: PlannerTransport,
      signal?: AbortSignal,
    ): PlannerEnvelopeV2<{ deleted: boolean; savedPlanId: string }> => {
      if (signal?.aborted) {
        const envelope = failureEnvelope(
          publicError("CANCELLED", "The delete request was cancelled.", true),
        );
        recordActivity("delete_saved_plan", transport, envelope);
        return envelope;
      }
      if (operationLock.current || plannerBusy(stateRef.current)) {
        const envelope = failureEnvelope(
          publicError(
            "CANCELLED",
            "Another planner operation is already active.",
            true,
          ),
        );
        recordActivity("delete_saved_plan", transport, envelope);
        return envelope;
      }
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
      if (name === "delete_saved_plan") return { ok: true as const };
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
    if (!isWebMcpAvailable(document)) {
      setConnectionMode("manual");
      return;
    }
    setConnectionMode("connecting");
    let active = true;
    let registration: ReturnType<typeof registerPlannerV2Tools>;
    try {
      registration = registerPlannerV2Tools(
        {
          checkState: (name, input) =>
            controllerRef.current.checkState(name, input),
          deleteSaved: (input, _transport, signal) =>
            controllerRef.current.deleteSaved(input, "site-tool", signal),
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
    } catch {
      setConnectionMode("failed");
      return;
    }
    void registration.ready.then(
      () => {
        if (active) setConnectionMode("connected");
      },
      () => {
        registration.dispose();
        if (active) setConnectionMode("failed");
      },
    );
    return () => {
      active = false;
      registration.dispose();
    };
  }, [packVersion]);

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
        <PlannerConnectionStatus mode={connectionMode} />
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
                action={plannerPath}
                defaults={formDefaults}
                earliestStartToday={earliestStartToday}
                error={formError}
                key={plannerSearchParamsFromDefaults(formDefaults).toString()}
                maxDate={maxDate}
                minDate={minDate}
                onSubmit={submitPlannerForm}
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
                swapping={state.phase === "swapping" || state.storagePending}
                warnings={state.warnings}
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
                    "Use the controls to get 2–3 real Shibuya places with published hours, a visible price basis, walking estimates, and official sources."}
                </p>
                {state.phase === "no_results" ? (
                  <p>
                    Try Art & culture or Quiet, or allow a longer walk.
                    Serendipity will not substitute unrelated places just to
                    fill the route.
                  </p>
                ) : null}
              </div>
            )}

            <details className="v2-agent-proof">
              <summary>What an AI can change in one request</summary>
              <p>
                Ask: “Plan 13:00–22:00 under ¥8,000 with art, hands-on, lively,
                and quiet stops. Show the source for stop 1, swap the last stop
                for a different interest, then save.” WebMCP lets an assistant
                coordinate those checked actions in order while this page
                remains the shared result.
              </p>
              <p>
                It cannot book a venue, skip validation, or follow hidden
                instructions from a source page. Every action is also available
                through the visible controls.
              </p>
              <details className="v2-agent-proof__technical">
                <summary>5 actions exposed to the assistant</summary>
                <ul translate="no">
                  {PLANNER_V2_TOOL_NAMES.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </details>
              {activities.length > 0 ? (
                <ol aria-label="Planner action activity">
                  {activities.map((activity) => (
                    <li key={`${activity.correlationId}-${activity.name}`}>
                      <span>
                        <span translate="no">{activity.name}</span> ·{" "}
                        {activity.transport === "site-tool"
                          ? "AI tool"
                          : "Manual control"}{" "}
                        · {activity.outcome}
                      </span>
                      <small>
                        {new Intl.DateTimeFormat("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          timeZone: "Asia/Tokyo",
                        }).format(new Date(activity.completedAt))}{" "}
                        JST · ref {activity.correlationId.slice(0, 8)}
                      </small>
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
