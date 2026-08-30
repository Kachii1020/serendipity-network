import {
  validateSwapPlanInputV3,
  type SwapPlanDataV3,
  type SwapPlanInputV3,
} from "@serendipity/contracts/planner-v3";

import { createPlannerV3PostHandler } from "../../../../../lib/planner-v3/boundary";
import {
  DEFAULT_PLANNER_V3_RUNTIME,
  type PlannerV3OperationResult,
} from "../../../../../lib/planner-v3/runtime";

export const dynamic = "force-dynamic";

export type PlannerV3SwapOperation = (
  input: SwapPlanInputV3,
  signal: AbortSignal,
) =>
  | PlannerV3OperationResult<SwapPlanDataV3>
  | Promise<PlannerV3OperationResult<SwapPlanDataV3>>;

export const createPlannerV3SwapPost = (swap: PlannerV3SwapOperation) =>
  createPlannerV3PostHandler({
    execute: swap,
    validate: validateSwapPlanInputV3,
  });

export const POST = createPlannerV3SwapPost((input, signal) =>
  DEFAULT_PLANNER_V3_RUNTIME.swap(input, signal),
);
