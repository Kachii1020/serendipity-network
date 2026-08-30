"use client";

import {
  PLANNER_V3_SCHEMA_VERSION,
  type EveningPlanV3,
  type PlaceEvidenceDataV3,
  type PlaceEvidenceV3,
  type PlannerEnvelopeV3,
  type PlannerIntentV3,
  type PlannerPublicErrorV3,
  type SearchPlansDataV3,
  type SwapPlanDataV3,
  type SwapPlanInputV3,
} from "@serendipity/contracts/planner-v3";
import {
  validatePlannerEnvelopeV3Client,
  validatePlannerIntentV3Client,
} from "@serendipity/contracts/planner-v3-shared";
import { assertPublicPayloadSafe } from "@serendipity/contracts/public-safety";
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
  PLANNER_V3_TOOL_NAMES,
  registerPlannerV3Tools,
  validatePlannerV3EvidenceData,
  validatePlannerV3SearchData,
  validatePlannerV3SwapData,
  type DeleteSavedPlanToolInputV3,
  type PlannerV3ToolInput,
  type PlannerV3ToolName,
  type SavePlanToolInputV3,
  type ShowPlaceEvidenceToolInputV3,
  type SwapPlanStopToolInputV3,
} from "../../lib/tools/planner-v3-tools";
import { DecisionDialog } from "../product/decision-dialog";
import { PlannerFormV3 } from "./planner-form";
import {
  initialPlannerStateV3,
  plannerBusyV3,
  plannerReducerV3,
  type PlannerStateV3,
  type PlannerTransportV3,
} from "./planner-machine";
import type { PlannerFormDefaultsV3 } from "./planner-options";
import { PlannerPlanV3 } from "./planner-plan";
import { PlannerProgressV3 } from "./planner-progress";
import {
  normalizePlannerQueryV3,
  plannerFormDefaultsFromIntentV3,
  plannerIntentFromDefaultsV3,
  plannerSearchParamsFromDefaultsV3,
  type PlannerQueryV3,
} from "./planner-query";
import {
  deletePlanSnapshotV3,
  loadSavedPlansV3,
  savePlanSnapshotV3,
  type SavedPlanRecordV3,
} from "./planner-storage";

type ActivityV3 = Readonly<{
  completedAt: string;
  correlationId: string;
  durationMs: number;
  name: PlannerV3ToolName;
  outcome: "error" | "success";
  transport: PlannerTransportV3;
}>;

const SEARCH_PRESENTATION_MS = 700;

const waitForSearchPresentation = (
  startedAt: number,
  signal?: AbortSignal,
): Promise<boolean> => {
  const remaining = Math.max(
    0,
    SEARCH_PRESENTATION_MS - (performance.now() - startedAt),
  );
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(true);
    }, remaining);
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      resolve(false);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const publicError = (
  code: PlannerPublicErrorV3["code"],
  message: string,
  retryable = false,
): PlannerPublicErrorV3 => ({ code, message, retryable });

const queryFromForm = (form: HTMLFormElement): PlannerQueryV3 => {
  const query: PlannerQueryV3 = {};
  const params = new URLSearchParams();
  for (const [key, value] of new FormData(form)) {
    if (typeof value === "string") params.append(key, value);
  }
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    query[key] = values.length === 1 ? values[0] : values;
  }
  return query;
};

const responseEnvelope = async <T,>(
  response: Response,
  validateData: (value: unknown, meta: unknown) => value is T,
): Promise<PlannerEnvelopeV3<T> | undefined> => {
  try {
    const value: unknown = await response.json();
    if (
      !validatePlannerEnvelopeV3Client(value) ||
      !record(value) ||
      !assertPublicPayloadSafe(value).ok ||
      (value.ok === true && !validateData(value.data, value.meta))
    ) {
      return undefined;
    }
    return value as PlannerEnvelopeV3<T>;
  } catch {
    return undefined;
  }
};

const focus = (selector: string): void => {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(selector);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "start", behavior: "auto" });
    }),
  );
};

const evidenceMatchesPlan = (
  evidence: PlaceEvidenceV3 | undefined,
  plan: EveningPlanV3,
  placeId: string,
): evidence is PlaceEvidenceV3 => {
  const stop = plan.stops.find(({ place }) => place.placeId === placeId);
  return (
    evidence !== undefined &&
    stop !== undefined &&
    evidence.area === plan.intent.area &&
    evidence.packVersion === plan.packVersion &&
    evidence.placeId === placeId &&
    evidence.placeName === stop.place.name &&
    evidence.officialUrl === stop.place.officialUrl
  );
};

export function PlannerClientV3({
  autoSearch,
  defaults,
  earliestStartToday,
  hubOrigin,
  initialIntent,
  maxDate,
  minDate,
}: {
  readonly autoSearch: boolean;
  readonly defaults: PlannerFormDefaultsV3;
  readonly earliestStartToday: string | null;
  readonly hubOrigin: string;
  readonly initialIntent: PlannerIntentV3;
  readonly maxDate: string;
  readonly minDate: string;
}) {
  const [state, dispatch] = useReducer(plannerReducerV3, initialPlannerStateV3);
  const stateRef = useRef<PlannerStateV3>(state);
  stateRef.current = state;
  const lock = useRef(false);
  const autoStarted = useRef(false);
  const [formDefaults, setFormDefaults] = useState(defaults);
  const [formError, setFormError] = useState<string | null>(null);
  const [connection, setConnection] = useState<
    "checking" | "connected" | "connecting" | "failed" | "manual"
  >("checking");
  const [activities, setActivities] = useState<readonly ActivityV3[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [saveAnnouncement, setSaveAnnouncement] = useState("");
  const [openEvidencePlaceId, setOpenEvidencePlaceId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const loaded = loadSavedPlansV3(localStorage);
    dispatch({
      corrupt: loaded.corrupt,
      records: loaded.records,
      type: "SAVED_LOADED",
    });
  }, []);

  useEffect(() => {
    const reconcileHistory = () => globalThis.location.reload();
    globalThis.addEventListener("popstate", reconcileHistory);
    return () => globalThis.removeEventListener("popstate", reconcileHistory);
  }, []);

  const context = useCallback(
    () => ({
      area: stateRef.current.plan?.intent.area ?? null,
      packVersion: stateRef.current.plan?.packVersion ?? null,
    }),
    [],
  );

  const envelope = useCallback(
    <T,>(data: T): PlannerEnvelopeV3<T> => ({
      schemaVersion: "3",
      ok: true,
      data,
      meta: {
        area: stateRef.current.plan?.intent.area ?? null,
        completedAt: new Date().toISOString(),
        correlationId: crypto.randomUUID(),
        origin: globalThis.location?.origin ?? new URL(hubOrigin).origin,
        packVersion: stateRef.current.plan?.packVersion ?? null,
      },
    }),
    [hubOrigin],
  );

  const failure = useCallback(
    (error: PlannerPublicErrorV3): PlannerEnvelopeV3<never> => ({
      schemaVersion: "3",
      ok: false,
      error,
      meta: {
        area: stateRef.current.plan?.intent.area ?? null,
        completedAt: new Date().toISOString(),
        correlationId: crypto.randomUUID(),
        origin: globalThis.location?.origin ?? new URL(hubOrigin).origin,
        packVersion: stateRef.current.plan?.packVersion ?? null,
      },
    }),
    [hubOrigin],
  );

  const recordActivity = useCallback(
    (
      name: PlannerV3ToolName,
      transport: PlannerTransportV3,
      result: PlannerEnvelopeV3<unknown>,
      startedAt: number,
    ) => {
      setActivities((current) =>
        [
          {
            completedAt: result.meta.completedAt,
            correlationId: result.meta.correlationId,
            durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
            name,
            outcome: result.ok ? ("success" as const) : ("error" as const),
            transport,
          },
          ...current,
        ].slice(0, 10),
      );
    },
    [],
  );

  const projectIntent = useCallback((intent: PlannerIntentV3) => {
    const next = plannerFormDefaultsFromIntentV3(intent);
    setFormDefaults(next);
    const params = plannerSearchParamsFromDefaultsV3(next);
    const target = `/v3/plan?${params}`;
    if (`${location.pathname}${location.search}` !== target) {
      history.pushState(null, "", target);
    }
  }, []);

  const find = useCallback(
    async (
      intent: PlannerIntentV3,
      transport: PlannerTransportV3,
      signal?: AbortSignal,
    ): Promise<PlannerEnvelopeV3<SearchPlansDataV3>> => {
      const startedAt = performance.now();
      const current = stateRef.current;
      if (
        signal?.aborted ||
        lock.current ||
        plannerBusyV3(current) ||
        !validatePlannerIntentV3Client(intent, new Date()).ok
      ) {
        const result = failure(
          publicError("CANCELLED", "Another planner action is active.", true),
        );
        recordActivity("find_evening_plan", transport, result, startedAt);
        return result;
      }
      lock.current = true;
      setOpenEvidencePlaceId(null);
      setSaveAnnouncement("");
      projectIntent(intent);
      dispatch({
        intent,
        startedAt: Date.now(),
        transport,
        type: "SEARCH_STARTED",
      });
      focus(".v3-progress");
      let result: PlannerEnvelopeV3<SearchPlansDataV3>;
      try {
        const response = await fetch("/api/v3/plans/search", {
          body: JSON.stringify(intent),
          headers: { "content-type": "application/json" },
          method: "POST",
          ...(signal ? { signal } : {}),
        });
        result =
          (await responseEnvelope(
            response,
            (value, meta): value is SearchPlansDataV3 =>
              record(meta) &&
              meta.area === intent.area &&
              typeof meta.packVersion === "string" &&
              validatePlannerV3SearchData(
                value,
                intent,
                intent.area,
                meta.packVersion,
              ),
          )) ??
          failure(
            publicError(
              "INTERNAL_ERROR",
              "The planner returned an unsafe response.",
              true,
            ),
          );
        const presentable = result.ok || result.error.code === "NO_VALID_PLAN";
        if (presentable) {
          const completed = await waitForSearchPresentation(startedAt, signal);
          if (!completed) {
            result = failure(
              publicError("CANCELLED", "The request was cancelled.", true),
            );
          }
        }
      } catch {
        result = failure(
          publicError(
            signal?.aborted ? "CANCELLED" : "INTERNAL_ERROR",
            signal?.aborted
              ? "The request was cancelled."
              : "The planner could not be reached.",
            true,
          ),
        );
      } finally {
        lock.current = false;
      }
      if (result.ok) {
        dispatch({
          candidateSetId: result.data.candidateSetId,
          googleSignals: result.data.googleSignals,
          plan: result.data.plan,
          type: "SEARCH_SUCCEEDED",
          warnings: result.data.warnings,
        });
        focus(".v3-result-title");
      } else {
        dispatch({
          error: result.error,
          type:
            result.error.code === "NO_VALID_PLAN"
              ? "SEARCH_EMPTY"
              : "SEARCH_FAILED",
        });
        focus(current.plan ? ".v3-result-title" : ".v3-empty");
      }
      recordActivity("find_evening_plan", transport, result, startedAt);
      return result;
    },
    [failure, projectIntent, recordActivity],
  );

  const loadEvidence = useCallback(
    async (
      input: ShowPlaceEvidenceToolInputV3,
      expectedPackVersion: string,
      startsAt: string,
      endsAt: string,
      signal?: AbortSignal,
    ): Promise<PlannerEnvelopeV3<PlaceEvidenceDataV3>> => {
      if (signal?.aborted) {
        return failure(
          publicError("CANCELLED", "The evidence request was cancelled.", true),
        );
      }
      const params = new URLSearchParams({
        endsAt,
        startsAt,
      });
      try {
        const response = await fetch(
          `/api/v3/areas/${encodeURIComponent(input.area)}/places/${encodeURIComponent(input.placeId)}/evidence?${params}`,
          signal ? { signal } : {},
        );
        return (
          (await responseEnvelope(
            response,
            (value, meta): value is PlaceEvidenceDataV3 =>
              record(meta) &&
              meta.area === input.area &&
              meta.packVersion === expectedPackVersion &&
              validatePlannerV3EvidenceData(
                value,
                input.area,
                input.placeId,
                expectedPackVersion,
              ),
          )) ??
          failure(
            publicError(
              "INTERNAL_ERROR",
              "The evidence response was unsafe.",
              true,
            ),
          )
        );
      } catch {
        return failure(
          publicError(
            signal?.aborted ? "CANCELLED" : "INTERNAL_ERROR",
            signal?.aborted
              ? "The evidence request was cancelled."
              : "Official evidence could not be loaded.",
            true,
          ),
        );
      }
    },
    [failure],
  );

  const showEvidence = useCallback(
    async (
      input: ShowPlaceEvidenceToolInputV3,
      transport: PlannerTransportV3,
      signal?: AbortSignal,
    ): Promise<PlannerEnvelopeV3<PlaceEvidenceDataV3>> => {
      const startedAt = performance.now();
      const current = stateRef.current;
      const stop = current.plan?.stops.find(
        ({ place }) => place.placeId === input.placeId,
      );
      if (
        signal?.aborted ||
        lock.current ||
        plannerBusyV3(current) ||
        current.phase !== "planned" ||
        current.plan?.planId !== input.planId ||
        current.candidateSetId !== input.candidateSetId ||
        current.plan.intent.area !== input.area ||
        !stop
      ) {
        const result = failure(
          publicError(
            signal?.aborted || lock.current || plannerBusyV3(current)
              ? "CANCELLED"
              : "STALE_PLAN",
            signal?.aborted || lock.current || plannerBusyV3(current)
              ? "Another planner action is active."
              : "That stop is not in the current plan.",
            signal?.aborted || lock.current || plannerBusyV3(current),
          ),
        );
        recordActivity("show_place_evidence", transport, result, startedAt);
        return result;
      }

      setOpenEvidencePlaceId(input.placeId);
      const cached = current.evidenceByPlace[input.placeId];
      let result: PlannerEnvelopeV3<PlaceEvidenceDataV3>;
      if (evidenceMatchesPlan(cached, current.plan, input.placeId)) {
        result = envelope({
          evidence: cached,
          googleSignal:
            current.googleSignals.find(
              ({ placeId }) => placeId === input.placeId,
            ) ?? null,
        });
      } else {
        result = await loadEvidence(
          input,
          current.plan.packVersion,
          stop.startsAt,
          stop.endsAt,
          signal,
        );
      }

      const latest = stateRef.current;
      const stillCurrent =
        latest.phase === "planned" &&
        latest.plan?.planId === current.plan.planId &&
        latest.plan.packVersion === current.plan.packVersion &&
        latest.candidateSetId === current.candidateSetId;
      if (result.ok && (signal?.aborted || !stillCurrent)) {
        result = failure(
          publicError(
            "CANCELLED",
            "The plan changed before evidence finished loading.",
            true,
          ),
        );
      }

      if (result.ok) {
        dispatch({
          evidence: result.data.evidence,
          type: "EVIDENCE_SUCCEEDED",
        });
        focus(`#v3-evidence-${input.placeId}`);
      } else if (stillCurrent) {
        dispatch({ error: result.error, type: "INLINE_ERROR" });
      }
      recordActivity("show_place_evidence", transport, result, startedAt);
      return result;
    },
    [envelope, failure, loadEvidence, recordActivity],
  );

  const swap = useCallback(
    async (
      input: SwapPlanStopToolInputV3,
      transport: PlannerTransportV3,
      signal?: AbortSignal,
    ): Promise<PlannerEnvelopeV3<SwapPlanDataV3>> => {
      const startedAt = performance.now();
      const current = stateRef.current;
      const stopIndex = current.plan?.stops.findIndex(
        ({ place }) => place.placeId === input.targetPlaceId,
      );
      if (
        signal?.aborted ||
        lock.current ||
        plannerBusyV3(current) ||
        current.phase !== "planned" ||
        current.plan?.planId !== input.planId ||
        current.candidateSetId !== input.candidateSetId ||
        current.intent === null ||
        stopIndex === undefined ||
        stopIndex < 0
      ) {
        const result = failure(
          publicError("STALE_PLAN", "That stop is not current."),
        );
        recordActivity("swap_plan_stop", transport, result, startedAt);
        return result;
      }
      lock.current = true;
      setOpenEvidencePlaceId(null);
      setSaveAnnouncement("");
      dispatch({ type: "SWAP_STARTED" });
      const request: SwapPlanInputV3 = {
        candidateSetId: current.candidateSetId,
        intent: current.intent,
        plan: current.plan,
        planId: current.plan.planId,
        preference: input.preference,
        schemaVersion: PLANNER_V3_SCHEMA_VERSION,
        stopIndex,
      };
      let result: PlannerEnvelopeV3<SwapPlanDataV3>;
      try {
        const response = await fetch("/api/v3/plans/swap", {
          body: JSON.stringify(request),
          headers: { "content-type": "application/json" },
          method: "POST",
          ...(signal ? { signal } : {}),
        });
        result =
          (await responseEnvelope(
            response,
            (value, meta): value is SwapPlanDataV3 =>
              record(meta) &&
              meta.area === current.intent!.area &&
              typeof meta.packVersion === "string" &&
              validatePlannerV3SwapData(
                value,
                input,
                current.intent!.area,
                meta.packVersion,
              ),
          )) ??
          failure(
            publicError(
              "INTERNAL_ERROR",
              "The replacement response was unsafe.",
              true,
            ),
          );
      } catch {
        result = failure(
          publicError("INTERNAL_ERROR", "The stop could not be changed.", true),
        );
      } finally {
        lock.current = false;
      }
      if (result.ok) {
        dispatch({
          googleSignals: result.data.googleSignals,
          plan: result.data.plan,
          type: "SWAP_SUCCEEDED",
          warnings: result.data.warnings,
        });
        const changed = result.data.plan.stops[result.data.replacedStopIndex];
        if (changed) focus(`#v3-place-${changed.place.placeId}`);
      } else {
        dispatch({ error: result.error, type: "SWAP_FAILED" });
      }
      recordActivity("swap_plan_stop", transport, result, startedAt);
      return result;
    },
    [failure, recordActivity],
  );

  const save = useCallback(
    async (
      input: SavePlanToolInputV3,
      transport: PlannerTransportV3,
      signal?: AbortSignal,
    ): Promise<
      PlannerEnvelopeV3<{
        savedAt: string;
        savedPlanId: string;
        status: string;
      }>
    > => {
      const startedAt = performance.now();
      const current = stateRef.current;
      if (
        signal?.aborted ||
        lock.current ||
        current.phase !== "planned" ||
        current.plan?.planId !== input.planId ||
        current.candidateSetId !== input.candidateSetId ||
        current.intent === null
      ) {
        const result = failure(
          publicError("STALE_PLAN", "Only the current plan can be saved."),
        );
        recordActivity("save_plan", transport, result, startedAt);
        return result;
      }
      lock.current = true;
      setSaveAnnouncement("");
      dispatch({ type: "SAVE_STARTED" });
      type SaveResult = PlannerEnvelopeV3<{
        savedAt: string;
        savedPlanId: string;
        status: string;
      }>;
      let result: SaveResult | null = null;
      const stillCurrent = (): boolean => {
        const latest = stateRef.current;
        return (
          latest.plan?.planId === current.plan!.planId &&
          latest.plan.packVersion === current.plan!.packVersion &&
          latest.candidateSetId === current.candidateSetId &&
          latest.intent !== null &&
          JSON.stringify(latest.intent) === JSON.stringify(current.intent)
        );
      };

      try {
        const evidenceByPlace: Record<string, PlaceEvidenceV3> = {};
        for (const stop of current.plan.stops) {
          if (signal?.aborted || !stillCurrent()) {
            const error = publicError(
              "CANCELLED",
              signal?.aborted
                ? "The save request was cancelled."
                : "The plan changed before it could be saved.",
              true,
            );
            result = failure(error);
            dispatch({ error, type: "SAVE_FAILED" });
            return result;
          }

          const cached = current.evidenceByPlace[stop.place.placeId];
          if (evidenceMatchesPlan(cached, current.plan, stop.place.placeId)) {
            evidenceByPlace[stop.place.placeId] = cached;
            continue;
          }

          const loaded = await loadEvidence(
            {
              area: current.plan.intent.area,
              candidateSetId: current.candidateSetId,
              placeId: stop.place.placeId,
              planId: current.plan.planId,
              schemaVersion: "3",
            },
            current.plan.packVersion,
            stop.startsAt,
            stop.endsAt,
            signal,
          );
          if (!loaded.ok) {
            result = loaded;
            dispatch({ error: loaded.error, type: "SAVE_FAILED" });
            return result;
          }
          if (signal?.aborted || !stillCurrent()) {
            const error = publicError(
              "CANCELLED",
              signal?.aborted
                ? "The save request was cancelled."
                : "The plan changed while its evidence was loading.",
              true,
            );
            result = failure(error);
            dispatch({ error, type: "SAVE_FAILED" });
            return result;
          }
          evidenceByPlace[stop.place.placeId] = loaded.data.evidence;
        }

        if (signal?.aborted || !stillCurrent()) {
          const error = publicError(
            "CANCELLED",
            signal?.aborted
              ? "The save request was cancelled."
              : "The plan changed before browser storage was updated.",
            true,
          );
          result = failure(error);
          dispatch({ error, type: "SAVE_FAILED" });
          return result;
        }

        const savedAt = new Date().toISOString();
        const saved: SavedPlanRecordV3 = {
          evidenceByPlace,
          intent: current.intent,
          itinerary: current.plan,
          savedAt,
          savedPlanId: current.plan.planId,
          schemaVersion: "3",
        };
        const stored = savePlanSnapshotV3(localStorage, saved);
        result = stored.ok
          ? envelope({
              savedAt,
              savedPlanId: stored.savedPlanId,
              status: stored.status,
            })
          : failure(
              publicError(stored.code, "This browser could not save the plan."),
            );
        if (stored.ok) {
          dispatch({ records: stored.records, type: "SAVE_SUCCEEDED" });
          setSaveAnnouncement(
            stored.status === "ALREADY_SAVED"
              ? "This plan is already saved in this browser."
              : "Plan saved in this browser.",
          );
        } else {
          dispatch({
            error: publicError(
              stored.code,
              "This browser could not save the plan.",
            ),
            type: "SAVE_FAILED",
          });
        }
        return result;
      } catch {
        const error = publicError(
          "INTERNAL_ERROR",
          "This browser could not save the plan.",
          true,
        );
        result = failure(error);
        dispatch({ error, type: "SAVE_FAILED" });
        return result;
      } finally {
        lock.current = false;
        if (result) recordActivity("save_plan", transport, result, startedAt);
      }
    },
    [envelope, failure, loadEvidence, recordActivity],
  );

  const deleteSaved = useCallback(
    (
      input: DeleteSavedPlanToolInputV3,
      transport: PlannerTransportV3,
      signal?: AbortSignal,
    ): PlannerEnvelopeV3<{ deleted: boolean; savedPlanId: string }> => {
      const startedAt = performance.now();
      if (signal?.aborted || lock.current) {
        const result = failure(
          publicError("CANCELLED", "Another action is active.", true),
        );
        recordActivity("delete_saved_plan", transport, result, startedAt);
        return result;
      }
      const stored = deletePlanSnapshotV3(localStorage, input.planId);
      const result = stored.ok
        ? envelope({ deleted: stored.deleted, savedPlanId: stored.savedPlanId })
        : failure(
            publicError(
              stored.code,
              "This browser could not update saved plans.",
            ),
          );
      if (stored.ok)
        dispatch({ records: stored.records, type: "DELETE_SUCCEEDED" });
      recordActivity("delete_saved_plan", transport, result, startedAt);
      return result;
    },
    [envelope, failure, recordActivity],
  );

  const checkState = useCallback(
    (name: PlannerV3ToolName, input: PlannerV3ToolInput) => {
      const current = stateRef.current;
      if (plannerBusyV3(current) || lock.current) {
        return {
          ok: false as const,
          error: publicError(
            "CANCELLED",
            "Another planner action is active.",
            true,
          ),
        };
      }
      if (name === "find_evening_plan" || name === "delete_saved_plan")
        return { ok: true as const };
      const reference = input as SavePlanToolInputV3;
      return current.phase === "planned" &&
        current.plan?.planId === reference.planId &&
        current.candidateSetId === reference.candidateSetId
        ? { ok: true as const }
        : {
            ok: false as const,
            error: publicError("STALE_PLAN", "That reference is stale."),
          };
    },
    [],
  );

  const controller = useRef({
    checkState,
    deleteSaved,
    find,
    save,
    showEvidence,
    swap,
  });
  controller.current = {
    checkState,
    deleteSaved,
    find,
    save,
    showEvidence,
    swap,
  };
  useEffect(() => {
    if (!isWebMcpAvailable(document)) {
      setConnection("manual");
      return;
    }
    setConnection("connecting");
    let active = true;
    let registration: ReturnType<typeof registerPlannerV3Tools>;
    try {
      registration = registerPlannerV3Tools({
        checkState: (name, input) => controller.current.checkState(name, input),
        context,
        deleteSaved: (input, _transport, signal) =>
          controller.current.deleteSaved(input, "site-tool", signal),
        find: (input, _transport, signal) =>
          controller.current.find(input, "site-tool", signal),
        hubOrigin: globalThis.location.origin,
        save: (input, _transport, signal) =>
          controller.current.save(input, "site-tool", signal),
        showEvidence: (input, _transport, signal) =>
          controller.current.showEvidence(input, "site-tool", signal),
        swap: (input, _transport, signal) =>
          controller.current.swap(input, "site-tool", signal),
      });
    } catch {
      setConnection("failed");
      return;
    }
    void registration.ready.then(
      () => active && setConnection("connected"),
      () => {
        registration.dispose();
        if (active) setConnection("failed");
      },
    );
    return () => {
      active = false;
      registration.dispose();
    };
  }, [context]);

  useEffect(() => {
    if (!autoSearch || autoStarted.current) return;
    autoStarted.current = true;
    void find(initialIntent, "manual");
  }, [autoSearch, find, initialIntent]);

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const normalized = normalizePlannerQueryV3(
        queryFromForm(event.currentTarget),
        new Date(),
        maxDate,
      );
      if (normalized.invalid) {
        setFormError(
          "Choose a valid hub, 1–3 adults, a 2–10 hour window, and compatible meal and interest settings.",
        );
        return;
      }
      setFormError(null);
      void find(plannerIntentFromDefaultsV3(normalized.defaults), "manual");
    },
    [find, maxDate],
  );

  const reference = useMemo(
    () =>
      state.plan && state.candidateSetId
        ? {
            candidateSetId: state.candidateSetId,
            planId: state.plan.planId,
            schemaVersion: "3" as const,
          }
        : null,
    [state.candidateSetId, state.plan],
  );
  const enrichmentByPlace = Object.fromEntries(
    state.googleSignals.map((signal) => [signal.placeId, signal]),
  );

  return (
    <div className="v3-shell">
      <a className="skip-link" href="#v3-result">
        Skip to plan
      </a>
      <header className="v3-header">
        <Link className="v3-wordmark" href="/v3" translate="no">
          SERENDIPITY<span aria-hidden="true">✦</span>
        </Link>
        <span className="v3-mode">
          {connection === "connected"
            ? "AI tools connected"
            : connection === "connecting" || connection === "checking"
              ? "Connecting tools…"
              : "Planner ready"}
        </span>
      </header>
      <main className="v3-result-main" id="v3-result">
        {state.phase === "searching" &&
        state.searchPresentation &&
        state.pendingIntent ? (
          <PlannerProgressV3
            intent={state.pendingIntent}
            transport={state.searchPresentation.transport}
          />
        ) : (
          <>
            <details className="v3-adjust">
              <summary>Adjust plan</summary>
              <PlannerFormV3
                defaults={formDefaults}
                earliestStartToday={earliestStartToday}
                error={formError}
                key={plannerSearchParamsFromDefaultsV3(formDefaults).toString()}
                maxDate={maxDate}
                minDate={minDate}
                onSubmit={submit}
              />
            </details>
            {state.error && state.plan ? (
              <p className="v3-warning" role="alert">
                Previous verified plan kept. {state.error.message}
              </p>
            ) : null}
            {state.plan && state.phase !== "searching" ? (
              <PlannerPlanV3
                enrichmentByPlace={enrichmentByPlace}
                evidenceByPlace={state.evidenceByPlace}
                onEvidence={(placeId, open) => {
                  if (!open) {
                    setOpenEvidencePlaceId((current) =>
                      current === placeId ? null : current,
                    );
                    return;
                  }
                  if (openEvidencePlaceId === placeId) return;
                  if (!reference || !state.plan) return;
                  void showEvidence(
                    { ...reference, area: state.plan.intent.area, placeId },
                    "manual",
                  );
                }}
                onSave={() => reference && void save(reference, "manual")}
                onSwap={(targetPlaceId, preference) =>
                  reference &&
                  void swap(
                    { ...reference, preference, targetPlaceId },
                    "manual",
                  )
                }
                openEvidencePlaceId={openEvidencePlaceId}
                plan={state.plan}
                saveAnnouncement={saveAnnouncement}
                saving={state.storagePending}
                swapping={state.phase === "swapping"}
                warnings={state.warnings}
              />
            ) : (
              <section className="v3-empty" tabIndex={-1}>
                <h1>
                  {state.phase === "searching"
                    ? "Building your Tokyo night…"
                    : state.phase === "no_results"
                      ? "Nothing honest fits yet."
                      : state.phase === "error"
                        ? "The planner paused."
                        : "Choose a hub. Build the night."}
                </h1>
                <p>
                  {state.error?.message ??
                    "Adjust the plan above. Meal routes use published official menu prices."}
                </p>
              </section>
            )}
            <details className="v3-adjust v3-secondary">
              <summary>Saved plans ({state.savedPlans.length})</summary>
              {state.storageCorrupt ? (
                <p role="alert">Some saved data was ignored safely.</p>
              ) : null}
              <ul>
                {state.savedPlans.map((saved) => (
                  <li key={saved.savedPlanId}>
                    {saved.itinerary.stops
                      .map(({ place }) => place.name)
                      .join(" → ")}{" "}
                    <button
                      disabled={plannerBusyV3(state)}
                      onClick={() => void find(saved.intent, "manual")}
                      type="button"
                    >
                      Open &amp; refresh
                    </button>{" "}
                    <button
                      onClick={() => setPendingDelete(saved.savedPlanId)}
                      type="button"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </details>
            <details className="v3-adjust v3-secondary">
              <summary>AI tool activity ({activities.length})</summary>
              <ul aria-label="Planner action activity">
                {activities.map((activity, index) => (
                  <li key={`${activity.completedAt}-${activity.name}-${index}`}>
                    {activity.name} ·{" "}
                    {activity.transport === "site-tool"
                      ? "AI tool"
                      : "Manual control"}{" "}
                    · {activity.outcome} · {activity.durationMs}ms ·{" "}
                    <code>{activity.correlationId.slice(0, 8)}</code>
                  </li>
                ))}
              </ul>
              <p>
                Exactly {PLANNER_V3_TOOL_NAMES.length} planner tools share these
                visible actions.
              </p>
            </details>
          </>
        )}
      </main>
      {pendingDelete ? (
        <DecisionDialog
          cancelLabel="Keep plan"
          confirmLabel="Delete saved plan"
          description="This removes only the snapshot stored in this browser."
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteSaved(
              {
                planId: pendingDelete,
                schemaVersion: "3",
              },
              "manual",
            );
            setPendingDelete(null);
          }}
          open
          title="Delete this saved plan?"
        />
      ) : null}
    </div>
  );
}
