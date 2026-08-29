import "server-only";

import {
  composeEveningPlan,
  swapEveningPlanStop,
} from "@serendipity/bundle-engine/planner-v2";
import type {
  PlaceEvidenceDataV2,
  SearchPlanInputV2,
  SearchPlansDataV2,
  SwapPlanDataV2,
  SwapPlanInputV2,
} from "@serendipity/contracts/planner-v2";

import {
  getPlaceEvidenceV2,
  SHIBUYA_ACTIVE_PACK_V2,
} from "../../data/shibuya-v2";
import type { PlannerV2OperationResult } from "./handlers";

export const PLANNER_V2_PACK_VERSION = SHIBUYA_ACTIVE_PACK_V2.packVersion;

const cancelled = (): never => {
  throw new DOMException("The planner request was aborted.", "AbortError");
};

const checkSignal = (signal: AbortSignal): void => {
  if (signal.aborted) cancelled();
};

export const searchEveningPlanV2 = (
  input: SearchPlanInputV2,
  signal: AbortSignal,
): Promise<PlannerV2OperationResult<SearchPlansDataV2>> => {
  return searchEveningPlan(input, signal);
};

const searchEveningPlan = async (
  input: SearchPlanInputV2,
  signal: AbortSignal,
): Promise<PlannerV2OperationResult<SearchPlansDataV2>> => {
  checkSignal(signal);
  const result = await composeEveningPlan({
    asOf: new Date(),
    dataPack: SHIBUYA_ACTIVE_PACK_V2,
    intent: input,
  });
  checkSignal(signal);
  if (!result.ok) {
    return {
      ok: false,
      error: {
        code: "NO_VALID_PLAN",
        message:
          "No two- or three-stop route fits the selected time, reference budget, interests, and walking limit.",
        retryable: false,
      },
    };
  }

  return {
    ok: true,
    data: {
      candidateSetId: result.plan.candidateSetId,
      plan: result.plan,
      warnings: result.warnings,
    },
  };
};

export const swapEveningPlanV2 = (
  input: SwapPlanInputV2,
  signal: AbortSignal,
): Promise<PlannerV2OperationResult<SwapPlanDataV2>> => {
  return swapEveningPlan(input, signal);
};

const swapEveningPlan = async (
  input: SwapPlanInputV2,
  signal: AbortSignal,
): Promise<PlannerV2OperationResult<SwapPlanDataV2>> => {
  checkSignal(signal);
  const current = await composeEveningPlan({
    asOf: new Date(),
    dataPack: SHIBUYA_ACTIVE_PACK_V2,
    intent: input.intent,
  });
  if (!current.ok) {
    return {
      ok: false,
      error: {
        code: "NO_VALID_PLAN",
        message: "The current planner intent no longer produces a route.",
        retryable: false,
      },
    };
  }
  if (current.plan.candidateSetId !== input.candidateSetId) {
    return {
      ok: false,
      error: {
        code: "STALE_DATA_PACK",
        message:
          "The place dataset changed. Build a fresh plan before swapping.",
        retryable: false,
      },
    };
  }
  if (input.plan.packVersion !== SHIBUYA_ACTIVE_PACK_V2.packVersion) {
    return {
      ok: false,
      error: {
        code: "STALE_DATA_PACK",
        message:
          "The place dataset changed. Build a fresh plan before swapping.",
        retryable: false,
      },
    };
  }

  const swapped = await swapEveningPlanStop({
    asOf: new Date(),
    dataPack: SHIBUYA_ACTIVE_PACK_V2,
    intent: input.intent,
    plan: input.plan,
    preference: input.preference,
    stopIndex: input.stopIndex,
  });
  checkSignal(signal);
  if (!swapped.ok) {
    return {
      ok: false,
      error: {
        code: swapped.code,
        message:
          swapped.code === "NO_REPLACEMENT"
            ? "No honest replacement preserves this stop and the current constraints. Try a different stop or adjust interests or walking distance."
            : "The displayed plan or place dataset changed. Build a fresh plan.",
        retryable: false,
      },
    };
  }

  return {
    ok: true,
    data: {
      candidateSetId: swapped.plan.candidateSetId,
      plan: swapped.plan,
      preference: input.preference,
      replacedStopIndex: input.stopIndex,
    },
  };
};

export const readPlaceEvidenceV2 = (
  placeId: string,
): PlannerV2OperationResult<PlaceEvidenceDataV2> => {
  const evidence = getPlaceEvidenceV2(placeId);
  return evidence
    ? { ok: true, data: { evidence } }
    : {
        ok: false,
        error: {
          code: "PLACE_NOT_FOUND",
          message: "That place is not present in the active source pack.",
          retryable: false,
        },
      };
};
