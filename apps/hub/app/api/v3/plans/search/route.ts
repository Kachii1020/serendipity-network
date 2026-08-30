import {
  validatePlannerIntentV3,
  type PlannerIntentV3,
  type SearchPlansDataV3,
} from "@serendipity/contracts/planner-v3";

import { createPlannerV3PostHandler } from "../../../../../lib/planner-v3/boundary";
import {
  DEFAULT_PLANNER_V3_RUNTIME,
  type PlannerV3OperationResult,
} from "../../../../../lib/planner-v3/runtime";

export const dynamic = "force-dynamic";

export type PlannerV3SearchOperation = (
  input: PlannerIntentV3,
  signal: AbortSignal,
) =>
  | PlannerV3OperationResult<SearchPlansDataV3>
  | Promise<PlannerV3OperationResult<SearchPlansDataV3>>;

export const createPlannerV3SearchPost = (search: PlannerV3SearchOperation) =>
  createPlannerV3PostHandler({
    execute: search,
    validate: (value) => validatePlannerIntentV3(value, { now: new Date() }),
  });

export const POST = createPlannerV3SearchPost((input, signal) =>
  DEFAULT_PLANNER_V3_RUNTIME.search(input, signal),
);
