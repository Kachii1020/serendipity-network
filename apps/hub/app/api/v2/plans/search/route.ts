import {
  validateSearchPlanInputV2,
  type SearchPlansDataV2,
  type SearchPlanInputV2,
} from "@serendipity/contracts/planner-v2";

import {
  createPlannerPostHandler,
  type PlannerV2OperationResult,
} from "../../../../../lib/planner-v2/handlers";
import {
  PLANNER_V2_PACK_VERSION,
  searchEveningPlanV2,
} from "../../../../../lib/planner-v2/runtime";

export const dynamic = "force-dynamic";

export type PlannerSearchOperation = (
  input: SearchPlanInputV2,
  signal: AbortSignal,
) =>
  | PlannerV2OperationResult<SearchPlansDataV2>
  | Promise<PlannerV2OperationResult<SearchPlansDataV2>>;

export const createPlannerSearchPost = (
  search: PlannerSearchOperation,
  packVersion = PLANNER_V2_PACK_VERSION,
) =>
  createPlannerPostHandler({
    execute: search,
    packVersion,
    validate: (value) => validateSearchPlanInputV2(value, { now: new Date() }),
  });

export const POST = createPlannerSearchPost(searchEveningPlanV2);
