import {
  validateSwapPlanInputV2,
  type SwapPlanDataV2,
  type SwapPlanInputV2,
} from "@serendipity/contracts/planner-v2";

import {
  createPlannerPostHandler,
  type PlannerV2OperationResult,
} from "../../../../../lib/planner-v2/handlers";
import {
  PLANNER_V2_PACK_VERSION,
  swapEveningPlanV2,
} from "../../../../../lib/planner-v2/runtime";

export const dynamic = "force-dynamic";

export type PlannerSwapOperation = (
  input: SwapPlanInputV2,
  signal: AbortSignal,
) =>
  | PlannerV2OperationResult<SwapPlanDataV2>
  | Promise<PlannerV2OperationResult<SwapPlanDataV2>>;

export const createPlannerSwapPost = (
  swap: PlannerSwapOperation,
  packVersion = PLANNER_V2_PACK_VERSION,
) =>
  createPlannerPostHandler({
    execute: swap,
    packVersion,
    validate: validateSwapPlanInputV2,
  });

export const POST = createPlannerSwapPost(swapEveningPlanV2);
