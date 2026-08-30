import type {
  EveningPlanV3,
  GooglePlaceSignalV3,
  PlaceEvidenceV3,
  PlannerIntentV3,
  PlannerPublicErrorV3,
} from "@serendipity/contracts/planner-v3";

import type { SavedPlanRecordV3 } from "./planner-storage";

export type PlannerPhaseV3 =
  "error" | "idle" | "no_results" | "planned" | "searching" | "swapping";

export type PlannerTransportV3 = "manual" | "site-tool";

export type SearchPresentationV3 = Readonly<{
  startedAt: number;
  transport: PlannerTransportV3;
}>;

export type PlannerStateV3 = Readonly<{
  candidateSetId: string | null;
  error: PlannerPublicErrorV3 | null;
  evidenceByPlace: Readonly<Record<string, PlaceEvidenceV3>>;
  googleSignals: readonly GooglePlaceSignalV3[];
  intent: PlannerIntentV3 | null;
  pendingIntent: PlannerIntentV3 | null;
  phase: PlannerPhaseV3;
  plan: EveningPlanV3 | null;
  savedPlans: readonly SavedPlanRecordV3[];
  searchPresentation: SearchPresentationV3 | null;
  storageCorrupt: boolean;
  storagePending: boolean;
  warnings: readonly string[];
}>;

export const initialPlannerStateV3: PlannerStateV3 = {
  candidateSetId: null,
  error: null,
  evidenceByPlace: {},
  googleSignals: [],
  intent: null,
  pendingIntent: null,
  phase: "idle",
  plan: null,
  savedPlans: [],
  searchPresentation: null,
  storageCorrupt: false,
  storagePending: false,
  warnings: [],
};

export type PlannerEventV3 =
  | Readonly<{
      type: "SAVED_LOADED";
      records: readonly SavedPlanRecordV3[];
      corrupt: boolean;
    }>
  | Readonly<{
      type: "SEARCH_STARTED";
      intent: PlannerIntentV3;
      startedAt: number;
      transport: PlannerTransportV3;
    }>
  | Readonly<{
      type: "SEARCH_SUCCEEDED";
      plan: EveningPlanV3;
      candidateSetId: string;
      warnings: readonly string[];
      googleSignals: readonly GooglePlaceSignalV3[];
    }>
  | Readonly<{ type: "SEARCH_FAILED"; error: PlannerPublicErrorV3 }>
  | Readonly<{ type: "SEARCH_EMPTY"; error: PlannerPublicErrorV3 }>
  | Readonly<{ type: "SWAP_STARTED" }>
  | Readonly<{
      type: "SWAP_SUCCEEDED";
      plan: EveningPlanV3;
      warnings: readonly string[];
      googleSignals: readonly GooglePlaceSignalV3[];
    }>
  | Readonly<{ type: "SWAP_FAILED"; error: PlannerPublicErrorV3 }>
  | Readonly<{ type: "EVIDENCE_SUCCEEDED"; evidence: PlaceEvidenceV3 }>
  | Readonly<{ type: "INLINE_ERROR"; error: PlannerPublicErrorV3 }>
  | Readonly<{ type: "SAVE_STARTED" }>
  | Readonly<{ type: "SAVE_SUCCEEDED"; records: readonly SavedPlanRecordV3[] }>
  | Readonly<{ type: "SAVE_FAILED"; error: PlannerPublicErrorV3 }>
  | Readonly<{
      type: "DELETE_SUCCEEDED";
      records: readonly SavedPlanRecordV3[];
    }>;

export const plannerReducerV3 = (
  state: PlannerStateV3,
  event: PlannerEventV3,
): PlannerStateV3 => {
  switch (event.type) {
    case "SAVED_LOADED":
      return {
        ...state,
        savedPlans: event.records,
        storageCorrupt: event.corrupt,
      };
    case "SEARCH_STARTED":
      return {
        ...state,
        error: null,
        pendingIntent: event.intent,
        phase: "searching",
        searchPresentation: {
          startedAt: event.startedAt,
          transport: event.transport,
        },
      };
    case "SEARCH_SUCCEEDED":
      return {
        ...state,
        candidateSetId: event.candidateSetId,
        error: null,
        evidenceByPlace: {},
        googleSignals: event.googleSignals,
        intent: state.pendingIntent,
        pendingIntent: null,
        phase: "planned",
        plan: event.plan,
        searchPresentation: null,
        warnings: event.warnings,
      };
    case "SEARCH_EMPTY":
    case "SEARCH_FAILED":
      return state.plan
        ? {
            ...state,
            error: event.error,
            pendingIntent: null,
            phase: "planned",
            searchPresentation: null,
          }
        : {
            ...state,
            error: event.error,
            intent: state.pendingIntent,
            pendingIntent: null,
            phase: event.type === "SEARCH_EMPTY" ? "no_results" : "error",
            searchPresentation: null,
          };
    case "SWAP_STARTED":
      return state.phase === "planned"
        ? { ...state, error: null, phase: "swapping" }
        : state;
    case "SWAP_SUCCEEDED":
      return state.phase === "swapping"
        ? {
            ...state,
            error: null,
            evidenceByPlace: {},
            googleSignals: event.googleSignals,
            phase: "planned",
            plan: event.plan,
            warnings: event.warnings,
          }
        : state;
    case "SWAP_FAILED":
      return state.phase === "swapping"
        ? { ...state, error: event.error, phase: "planned" }
        : state;
    case "EVIDENCE_SUCCEEDED":
      return state.plan?.stops.some(
        ({ place }) => place.placeId === event.evidence.placeId,
      ) &&
        event.evidence.area === state.plan.intent.area &&
        event.evidence.packVersion === state.plan.packVersion
        ? {
            ...state,
            evidenceByPlace: {
              ...state.evidenceByPlace,
              [event.evidence.placeId]: event.evidence,
            },
          }
        : state;
    case "INLINE_ERROR":
      return { ...state, error: event.error };
    case "SAVE_STARTED":
      return { ...state, error: null, storagePending: true };
    case "SAVE_SUCCEEDED":
      return {
        ...state,
        savedPlans: event.records,
        storageCorrupt: false,
        storagePending: false,
      };
    case "SAVE_FAILED":
      return { ...state, error: event.error, storagePending: false };
    case "DELETE_SUCCEEDED":
      return { ...state, savedPlans: event.records, storageCorrupt: false };
  }
};

export const plannerBusyV3 = (state: PlannerStateV3): boolean =>
  state.phase === "searching" ||
  state.phase === "swapping" ||
  state.storagePending;
