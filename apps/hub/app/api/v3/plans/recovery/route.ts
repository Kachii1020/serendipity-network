import {
  validatePlannerIntentV3,
  type PlannerIntentV3,
} from "@serendipity/contracts/planner-v3";

import { createPlannerV3PostHandler } from "../../../../../lib/planner-v3/boundary";
import {
  DEFAULT_PLANNER_V3_RUNTIME,
  type PlannerV3OperationResult,
} from "../../../../../lib/planner-v3/runtime";
import type { PlannerRecoveryDataV3 } from "../../../../../lib/planner-v3/recovery-contract";

export const dynamic = "force-dynamic";

export type PlannerV3RecoveryOperation = (
  input: PlannerIntentV3,
  signal: AbortSignal,
) =>
  | PlannerV3OperationResult<PlannerRecoveryDataV3>
  | Promise<PlannerV3OperationResult<PlannerRecoveryDataV3>>;

export const createPlannerV3RecoveryPost = (
  recover: PlannerV3RecoveryOperation,
) =>
  createPlannerV3PostHandler({
    execute: recover,
    validate: (value) => validatePlannerIntentV3(value, { now: new Date() }),
  });

export const POST = createPlannerV3RecoveryPost((input, signal) =>
  DEFAULT_PLANNER_V3_RUNTIME.recovery(input, signal),
);
