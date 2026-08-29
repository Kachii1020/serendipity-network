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
  readonly pendingIntent: PlannerIntentV2 | null;
  readonly phase: PlannerPhase;
  readonly plan: EveningPlanV2 | null;
  readonly savedPlans: readonly SavedPlanRecordV2[];
  readonly storageCorrupt: boolean;
  readonly storagePending: boolean;
  readonly warnings: readonly string[];
};

export const initialPlannerState: PlannerState = {
  candidateSetId: null,
  evidenceByPlace: {},
  evidenceLoadingPlaceId: null,
  inlineError: null,
  intent: null,
  operationEpoch: 0,
  pendingIntent: null,
  phase: "idle",
  plan: null,
  savedPlans: [],
  storageCorrupt: false,
  storagePending: false,
  warnings: [],
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
      readonly warnings: readonly string[];
      readonly type: "SEARCH_SUCCEEDED";
    }
  | { readonly error: PlannerUiError; readonly type: "SEARCH_EMPTY" }
  | { readonly error: PlannerUiError; readonly type: "SEARCH_FAILED" }
  | { readonly type: "SWAP_STARTED" }
  | {
      readonly plan: EveningPlanV2;
      readonly type: "SWAP_SUCCEEDED";
      readonly warnings: readonly string[];
    }
  | { readonly error: PlannerUiError; readonly type: "SWAP_FAILED" }
  | {
      readonly placeId: string;
      readonly planId: string;
      readonly type: "EVIDENCE_STARTED";
    }
  | {
      readonly evidence: PlaceEvidenceV2;
      readonly placeId: string;
      readonly planId: string;
      readonly type: "EVIDENCE_SUCCEEDED";
    }
  | {
      readonly error: PlannerUiError;
      readonly planId: string;
      readonly type: "EVIDENCE_FAILED";
    }
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
        candidateSetId: state.plan ? state.candidateSetId : null,
        evidenceByPlace: state.plan ? state.evidenceByPlace : {},
        evidenceLoadingPlaceId: null,
        inlineError: null,
        operationEpoch: state.operationEpoch + 1,
        pendingIntent: event.intent,
        phase: "searching",
        warnings: state.plan ? state.warnings : [],
      };
    case "SEARCH_SUCCEEDED":
      if (state.phase !== "searching") return state;
      return {
        ...state,
        candidateSetId: event.candidateSetId,
        evidenceByPlace: {},
        evidenceLoadingPlaceId: null,
        intent: state.pendingIntent ?? state.intent,
        pendingIntent: null,
        phase: "planned",
        plan: event.plan,
        warnings: event.warnings,
      };
    case "SEARCH_EMPTY":
      if (state.phase !== "searching") return state;
      return state.plan
        ? {
            ...state,
            inlineError: event.error,
            pendingIntent: null,
            phase: "planned",
          }
        : {
            ...state,
            inlineError: event.error,
            intent: state.pendingIntent ?? state.intent,
            pendingIntent: null,
            phase: "no_results",
          };
    case "SEARCH_FAILED":
      if (state.phase !== "searching") return state;
      return state.plan
        ? {
            ...state,
            inlineError: event.error,
            pendingIntent: null,
            phase: "planned",
          }
        : {
            ...state,
            inlineError: event.error,
            intent: state.pendingIntent ?? state.intent,
            pendingIntent: null,
            phase: "error",
          };
    case "SWAP_STARTED":
      return state.phase === "planned"
        ? {
            ...state,
            evidenceLoadingPlaceId: null,
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
            warnings: event.warnings,
          }
        : state;
    case "SWAP_FAILED":
      return state.phase === "swapping"
        ? { ...state, inlineError: event.error, phase: "planned" }
        : state;
    case "EVIDENCE_STARTED":
      return state.phase === "planned" && state.plan?.planId === event.planId
        ? {
            ...state,
            evidenceLoadingPlaceId: event.placeId,
            inlineError: null,
          }
        : state;
    case "EVIDENCE_SUCCEEDED":
      if (
        state.phase !== "planned" ||
        state.plan?.planId !== event.planId ||
        !state.plan.stops.some(({ place }) => place.placeId === event.placeId)
      ) {
        return state;
      }
      return {
        ...state,
        evidenceByPlace: {
          ...state.evidenceByPlace,
          [event.placeId]: event.evidence,
        },
        evidenceLoadingPlaceId: null,
      };
    case "EVIDENCE_FAILED":
      if (state.phase !== "planned" || state.plan?.planId !== event.planId) {
        return state;
      }
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
        storageCorrupt: false,
        storagePending: false,
      };
    case "SAVE_FAILED":
      return {
        ...state,
        inlineError: event.error,
        storagePending: false,
      };
    case "DELETE_SUCCEEDED":
      return { ...state, savedPlans: event.records, storageCorrupt: false };
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
