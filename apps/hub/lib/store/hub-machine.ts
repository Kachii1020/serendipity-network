import type {
  BundleSummary,
  ErrorCode,
  Provider,
} from "@serendipity/contracts";

export type HubPhase =
  | "idle"
  | "discovering"
  | "composed"
  | "holding"
  | "held"
  | "releasing"
  | "confirming"
  | "reconciling"
  | "confirmed"
  | "recovering"
  | "no_results"
  | "error";

export type SafeHoldReference = {
  provider: Provider;
  safeReference: string;
};

export type ReservationReference = {
  provider: Provider;
  reservationRef: string;
};

export type HubState = {
  phase: HubPhase;
  bundleSessionId: string | null;
  candidates: BundleSummary[];
  selectedBundleId: string | null;
  activeHolds: SafeHoldReference[];
  expiresAt: string | null;
  reservations: ReservationReference[];
  errorCode: ErrorCode | null;
  compensationIncomplete: boolean;
  compensationBlockedUntil: string | null;
  releaseRetryAvailable: boolean;
  requiresFreshSearch: boolean;
};

export const initialHubState: HubState = {
  phase: "idle",
  bundleSessionId: null,
  candidates: [],
  selectedBundleId: null,
  activeHolds: [],
  expiresAt: null,
  reservations: [],
  errorCode: null,
  compensationIncomplete: false,
  compensationBlockedUntil: null,
  releaseRetryAvailable: false,
  requiresFreshSearch: false,
};

export type HubEvent =
  | { type: "DISCOVER" }
  | {
      type: "DISCOVER_SUCCEEDED";
      bundleSessionId: string;
      candidates: BundleSummary[];
    }
  | { type: "DISCOVER_FAILED"; errorCode: ErrorCode }
  | { type: "SELECT_BUNDLE"; bundleId: string; bundleVersion: number }
  | { type: "HOLD_STARTED" }
  | {
      type: "HOLD_SUCCEEDED";
      expiresAt: string;
      holds: SafeHoldReference[];
    }
  | {
      type: "HOLD_FAILED";
      errorCode: ErrorCode;
      compensationBlockedUntil?: string;
    }
  | {
      type: "HOLD_PARTIAL_FAILED";
      errorCode: ErrorCode;
      successfulHolds: SafeHoldReference[];
    }
  | {
      type: "RECOVERY_COMPLETED";
      candidates: BundleSummary[];
      compensationIncomplete: boolean;
      compensationBlockedUntil?: string;
    }
  | { type: "CONFIRM_STARTED" }
  | {
      type: "CONFIRM_SUCCEEDED";
      reservations: ReservationReference[];
    }
  | { type: "CONFIRM_UNKNOWN" }
  | {
      type: "RECONCILIATION_CONFIRMED";
      reservations: ReservationReference[];
    }
  | { type: "RECONCILIATION_FAILED"; errorCode: ErrorCode }
  | { type: "RELEASE_STARTED" }
  | { type: "RELEASE_COMPLETED" }
  | {
      type: "RELEASE_FAILED";
      errorCode: ErrorCode;
      retryAvailable: boolean;
    }
  | { type: "RELEASE_STATUS_STARTED" }
  | { type: "RELEASE_STATUS_HELD" }
  | { type: "COMPENSATION_BLOCK_RESTORED"; blockedUntil: string }
  | { type: "COMPENSATION_BLOCK_ELAPSED" }
  | { type: "HOLD_EXPIRED" }
  | { type: "RESET" };

const toSafeTerminalCandidateState = (state: HubState): HubState => ({
  ...state,
  phase: "composed",
  activeHolds: [],
  expiresAt: null,
  reservations: [],
  errorCode: null,
  compensationIncomplete: false,
  compensationBlockedUntil: null,
  releaseRetryAvailable: false,
  requiresFreshSearch: true,
});

export const hubReducer = (state: HubState, event: HubEvent): HubState => {
  if (event.type === "RESET") {
    if (
      state.phase === "releasing" ||
      state.compensationIncomplete ||
      state.activeHolds.length > 0
    ) {
      return state;
    }
    return { ...initialHubState };
  }

  switch (event.type) {
    case "DISCOVER":
      if (!["idle", "composed", "no_results", "error"].includes(state.phase)) {
        return state;
      }
      if (state.activeHolds.length > 0 || state.compensationIncomplete) {
        return state;
      }
      return {
        ...initialHubState,
        phase: "discovering",
      };

    case "DISCOVER_SUCCEEDED": {
      if (state.phase !== "discovering") return state;
      const selected = event.candidates[0] ?? null;
      return {
        ...state,
        phase: selected ? "composed" : "no_results",
        bundleSessionId: event.bundleSessionId,
        candidates: event.candidates,
        selectedBundleId: selected?.bundleId ?? null,
        errorCode: null,
      };
    }

    case "DISCOVER_FAILED":
      return state.phase === "discovering"
        ? { ...state, phase: "error", errorCode: event.errorCode }
        : state;

    case "SELECT_BUNDLE": {
      if (state.phase !== "composed" || state.requiresFreshSearch) return state;
      const candidate = state.candidates.find(
        ({ bundleId, bundleVersion }) =>
          bundleId === event.bundleId && bundleVersion === event.bundleVersion,
      );
      return candidate
        ? { ...state, selectedBundleId: candidate.bundleId }
        : { ...state, phase: "error", errorCode: "STALE_BUNDLE" };
    }

    case "HOLD_STARTED":
      return state.phase === "composed" &&
        state.selectedBundleId !== null &&
        !state.requiresFreshSearch
        ? { ...state, phase: "holding", errorCode: null }
        : state;

    case "HOLD_SUCCEEDED":
      return state.phase === "holding" && event.holds.length === 3
        ? {
            ...state,
            phase: "held",
            activeHolds: event.holds,
            expiresAt: event.expiresAt,
            errorCode: null,
          }
        : state;

    case "HOLD_FAILED":
      if (state.phase !== "holding") return state;
      if (event.errorCode === "COMPENSATION_INCOMPLETE") {
        return {
          ...state,
          phase: "error",
          errorCode: event.errorCode,
          compensationIncomplete: true,
          compensationBlockedUntil: event.compensationBlockedUntil ?? null,
          releaseRetryAvailable: false,
          requiresFreshSearch: true,
        };
      }
      return {
        ...state,
        phase: "error",
        errorCode: event.errorCode,
        compensationIncomplete: false,
        compensationBlockedUntil: null,
        releaseRetryAvailable: false,
      };

    case "HOLD_PARTIAL_FAILED":
      return state.phase === "holding"
        ? {
            ...state,
            phase: "recovering",
            activeHolds: event.successfulHolds,
            errorCode: event.errorCode,
          }
        : state;

    case "RECOVERY_COMPLETED": {
      if (state.phase !== "recovering") return state;
      if (event.compensationIncomplete) {
        return {
          ...state,
          phase: "error",
          compensationIncomplete: true,
          compensationBlockedUntil: event.compensationBlockedUntil ?? null,
          errorCode: "COMPENSATION_INCOMPLETE",
          releaseRetryAvailable: false,
          requiresFreshSearch: true,
        };
      }
      const selected = event.candidates[0] ?? null;
      return {
        ...state,
        phase: selected ? "composed" : "no_results",
        candidates: event.candidates,
        selectedBundleId: selected?.bundleId ?? null,
        activeHolds: [],
        expiresAt: null,
        errorCode: null,
        compensationIncomplete: false,
        compensationBlockedUntil: null,
        releaseRetryAvailable: false,
        requiresFreshSearch: false,
      };
    }

    case "CONFIRM_STARTED":
      return state.phase === "held"
        ? { ...state, phase: "confirming", errorCode: null }
        : state;

    case "CONFIRM_SUCCEEDED":
      return state.phase === "confirming" && event.reservations.length === 3
        ? {
            ...state,
            phase: "confirmed",
            reservations: event.reservations,
            activeHolds: [],
            expiresAt: null,
            errorCode: null,
          }
        : state;

    case "CONFIRM_UNKNOWN":
      return state.phase === "confirming"
        ? {
            ...state,
            phase: "reconciling",
            errorCode: "RECONCILIATION_REQUIRED",
          }
        : state;

    case "RECONCILIATION_CONFIRMED":
      return state.phase === "reconciling" && event.reservations.length === 3
        ? {
            ...state,
            phase: "confirmed",
            reservations: event.reservations,
            activeHolds: [],
            expiresAt: null,
            errorCode: null,
          }
        : state;

    case "RECONCILIATION_FAILED":
      return state.phase === "reconciling"
        ? { ...state, phase: "error", errorCode: event.errorCode }
        : state;

    case "RELEASE_STARTED":
      return (state.phase === "held" ||
        (state.phase === "error" && state.releaseRetryAvailable)) &&
        state.activeHolds.length > 0 &&
        !state.compensationIncomplete
        ? {
            ...state,
            phase: "releasing",
            errorCode: null,
            releaseRetryAvailable: false,
          }
        : state;

    case "RELEASE_COMPLETED":
      return state.phase === "releasing" ||
        (state.phase === "reconciling" && state.activeHolds.length > 0) ||
        (state.phase === "error" &&
          state.activeHolds.length > 0 &&
          !state.compensationIncomplete)
        ? toSafeTerminalCandidateState(state)
        : state;

    case "RELEASE_FAILED":
      return state.phase === "releasing"
        ? {
            ...state,
            phase: "error",
            errorCode: event.errorCode,
            releaseRetryAvailable: event.retryAvailable,
          }
        : state;

    case "RELEASE_STATUS_STARTED":
      return state.phase === "error" &&
        state.activeHolds.length > 0 &&
        !state.compensationIncomplete &&
        !state.releaseRetryAvailable
        ? {
            ...state,
            phase: "reconciling",
            errorCode: "RECONCILIATION_REQUIRED",
          }
        : state;

    case "RELEASE_STATUS_HELD":
      return state.phase === "reconciling" && state.activeHolds.length > 0
        ? {
            ...state,
            phase: "error",
            errorCode: "COMPENSATION_INCOMPLETE",
            releaseRetryAvailable: true,
          }
        : state;

    case "COMPENSATION_BLOCK_RESTORED":
      return state.phase === "idle" ||
        (state.phase === "error" && state.compensationIncomplete)
        ? {
            ...state,
            phase: "error",
            errorCode: "COMPENSATION_INCOMPLETE",
            compensationIncomplete: true,
            compensationBlockedUntil: event.blockedUntil,
            releaseRetryAvailable: false,
            requiresFreshSearch: true,
          }
        : state;

    case "COMPENSATION_BLOCK_ELAPSED":
      return state.compensationIncomplete &&
        state.compensationBlockedUntil !== null
        ? {
            ...state,
            phase: "error",
            activeHolds: [],
            expiresAt: null,
            compensationIncomplete: false,
            compensationBlockedUntil: null,
            releaseRetryAvailable: false,
            requiresFreshSearch: true,
          }
        : state;

    case "HOLD_EXPIRED":
      return state.phase === "held" ||
        state.phase === "recovering" ||
        (state.phase === "error" &&
          state.activeHolds.length > 0 &&
          !state.compensationIncomplete)
        ? toSafeTerminalCandidateState(state)
        : state;
  }
};

export type HubPrimaryAction =
  | "discover"
  | "hold"
  | "confirm"
  | "check-status"
  | "start-over"
  | "retry"
  | "retry-release";

export type HubUiState = {
  primaryAction: HubPrimaryAction | null;
  canConfirm: boolean;
  isBusy: boolean;
};

export const deriveHubUi = (state: HubState): HubUiState => {
  const primaryAction: HubPrimaryAction | null = (() => {
    switch (state.phase) {
      case "idle":
      case "no_results":
        return "discover";
      case "composed":
        return state.requiresFreshSearch ? "discover" : "hold";
      case "held":
        return "confirm";
      case "reconciling":
        return "check-status";
      case "confirmed":
        return "start-over";
      case "error":
        if (state.compensationIncomplete) return null;
        if (state.activeHolds.length > 0) {
          return state.releaseRetryAvailable ? "retry-release" : "check-status";
        }
        return "retry";
      case "discovering":
      case "holding":
      case "releasing":
      case "confirming":
      case "recovering":
        return null;
    }
  })();
  return {
    primaryAction,
    canConfirm: state.phase === "held",
    isBusy: [
      "discovering",
      "holding",
      "releasing",
      "confirming",
      "recovering",
    ].includes(state.phase),
  };
};
