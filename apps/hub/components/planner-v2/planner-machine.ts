import type {
  EveningPlanV2,
  PlaceEvidenceV2,
  PlannerErrorCodeV2,
  PlannerIntentV2,
} from "@serendipity/contracts/planner-v2";

import type { SavedPlanRecordV2 } from "./planner-storage";

export type PlannerPhase =
  "error" | "idle" | "no_results" | "planned" | "searching" | "swapping";

export type PlannerUiError = {
  readonly code: PlannerErrorCodeV2;
  readonly message: string;
  readonly retryable: boolean;
};

export type PlannerState = {
  readonly candidateSetId: string | null;
  readonly evidenceByPlace: Readonly<Record<string, PlaceEvidenceV2>>;
  readonly evidenceLoadingPlaceId: string | null;
  readonly inlineError: PlannerUiError | null;
  readonly intent: PlannerIntentV2 | null;
  readonly operationEpoch: number;
  readonly phase: PlannerPhase;
  readonly plan: EveningPlanV2 | null;
  readonly savedPlans: readonly SavedPlanRecordV2[];
  readonly storageCorrupt: boolean;
  readonly storagePending: boolean;
};

export const initialPlannerState: PlannerState = {
  candidateSetId: null,
  evidenceByPlace: {},
  evidenceLoadingPlaceId: null,
  inlineError: null,
  intent: null,
  operationEpoch: 0,
  phase: "idle",
  plan: null,
  savedPlans: [],
  storageCorrupt: false,
  storagePending: false,
};

export type PlannerEvent =
  | {
      readonly corrupt: boolean;
      readonly records: readonly SavedPlanRecordV2[];
      readonly type: "SAVED_PLANS_LOADED";
    }
  | { readonly intent: PlannerIntentV2; readonly type: "SEARCH_STARTED" }
  | {
      readonly candidateSetId: string;
      readonly plan: EveningPlanV2;
      readonly type: "SEARCH_SUCCEEDED";
    }
  | { readonly error: PlannerUiError; readonly type: "SEARCH_EMPTY" }
  | { readonly error: PlannerUiError; readonly type: "SEARCH_FAILED" }
  | { readonly type: "SWAP_STARTED" }
  | { readonly plan: EveningPlanV2; readonly type: "SWAP_SUCCEEDED" }
  | { readonly error: PlannerUiError; readonly type: "SWAP_FAILED" }
  | { readonly placeId: string; readonly type: "EVIDENCE_STARTED" }
  | {
      readonly evidence: PlaceEvidenceV2;
      readonly placeId: string;
      readonly type: "EVIDENCE_SUCCEEDED";
    }
  | { readonly error: PlannerUiError; readonly type: "EVIDENCE_FAILED" }
  | { readonly type: "SAVE_STARTED" }
  | {
      readonly records: readonly SavedPlanRecordV2[];
      readonly type: "SAVE_SUCCEEDED";
    }
  | { readonly error: PlannerUiError; readonly type: "SAVE_FAILED" }
  | {
      readonly records: readonly SavedPlanRecordV2[];
      readonly type: "DELETE_SUCCEEDED";
    }
  | { readonly error: PlannerUiError; readonly type: "DELETE_FAILED" }
  | { readonly type: "CLEAR_INLINE_ERROR" };

export const plannerReducer = (
  state: PlannerState,
  event: PlannerEvent,
): PlannerState => {
  switch (event.type) {
    case "SAVED_PLANS_LOADED":
      return {
        ...state,
        savedPlans: event.records,
        storageCorrupt: event.corrupt,
      };
    case "SEARCH_STARTED":
      return {
        ...state,
        candidateSetId: null,
        evidenceByPlace: {},
        evidenceLoadingPlaceId: null,
        inlineError: null,
        intent: event.intent,
        operationEpoch: state.operationEpoch + 1,
        phase: "searching",
        plan: null,
      };
    case "SEARCH_SUCCEEDED":
      if (state.phase !== "searching") return state;
      return {
        ...state,
        candidateSetId: event.candidateSetId,
        phase: "planned",
        plan: event.plan,
      };
    case "SEARCH_EMPTY":
      if (state.phase !== "searching") return state;
      return { ...state, inlineError: event.error, phase: "no_results" };
    case "SEARCH_FAILED":
      if (state.phase !== "searching") return state;
      return { ...state, inlineError: event.error, phase: "error" };
    case "SWAP_STARTED":
      return state.phase === "planned"
        ? {
            ...state,
            inlineError: null,
            operationEpoch: state.operationEpoch + 1,
            phase: "swapping",
          }
        : state;
    case "SWAP_SUCCEEDED":
      return state.phase === "swapping"
        ? {
            ...state,
            evidenceByPlace: {},
            phase: "planned",
            plan: event.plan,
          }
        : state;
    case "SWAP_FAILED":
      return state.phase === "swapping"
        ? { ...state, inlineError: event.error, phase: "planned" }
        : state;
    case "EVIDENCE_STARTED":
      return state.phase === "planned"
        ? {
            ...state,
            evidenceLoadingPlaceId: event.placeId,
            inlineError: null,
          }
        : state;
    case "EVIDENCE_SUCCEEDED":
      return {
        ...state,
        evidenceByPlace: {
          ...state.evidenceByPlace,
          [event.placeId]: event.evidence,
        },
        evidenceLoadingPlaceId: null,
      };
    case "EVIDENCE_FAILED":
      return {
        ...state,
        evidenceLoadingPlaceId: null,
        inlineError: event.error,
      };
    case "SAVE_STARTED":
      return state.phase === "planned"
        ? { ...state, inlineError: null, storagePending: true }
        : state;
    case "SAVE_SUCCEEDED":
      return {
        ...state,
        savedPlans: event.records,
        storagePending: false,
      };
    case "SAVE_FAILED":
      return {
        ...state,
        inlineError: event.error,
        storagePending: false,
      };
    case "DELETE_SUCCEEDED":
      return { ...state, savedPlans: event.records };
    case "DELETE_FAILED":
      return { ...state, inlineError: event.error };
    case "CLEAR_INLINE_ERROR":
      return { ...state, inlineError: null };
  }
};

export const plannerBusy = (state: PlannerState): boolean =>
  state.phase === "searching" ||
  state.phase === "swapping" ||
  state.storagePending;
