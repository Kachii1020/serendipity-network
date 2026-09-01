import { validatePlannerIntentV3Client } from "@serendipity/contracts/planner-v3-shared";
import type {
  PlannerAreaV3,
  PlannerIntentV3,
} from "@serendipity/contracts/planner-v3";

export const PLANNER_RECOVERY_CHANGES_V3 = [
  "INTEREST_SURPRISE",
  "WALK_30",
  "END_PLUS_60",
  "MEAL_OFF",
] as const;

export type PlannerRecoveryChangeV3 =
  (typeof PLANNER_RECOVERY_CHANGES_V3)[number];

export type PlannerRecoveryDataV3 = Readonly<{
  buttonLabel: string;
  changes: readonly PlannerRecoveryChangeV3[];
  intent: PlannerIntentV3;
  verified: Readonly<{
    candidateSetId: string;
    planId: string;
    stopCount: 2 | 3;
  }>;
}>;

const record = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const validatePlannerRecoveryDataV3 = (
  value: unknown,
  original: PlannerIntentV3,
  area: PlannerAreaV3,
): value is PlannerRecoveryDataV3 => {
  if (!record(value) || !validatePlannerIntentV3Client(value.intent).ok) {
    return false;
  }
  const intent = value.intent as PlannerIntentV3;
  if (
    intent.area !== area ||
    intent.area !== original.area ||
    intent.partySize !== original.partySize ||
    intent.startAt !== original.startAt ||
    intent.budgetPerPersonYen !== original.budgetPerPersonYen ||
    intent.schemaVersion !== original.schemaVersion ||
    !Array.isArray(value.changes) ||
    value.changes.length === 0 ||
    value.changes.some(
      (change) =>
        !PLANNER_RECOVERY_CHANGES_V3.includes(
          change as PlannerRecoveryChangeV3,
        ),
    ) ||
    typeof value.buttonLabel !== "string" ||
    value.buttonLabel.length < 3 ||
    value.buttonLabel.length > 160 ||
    !record(value.verified) ||
    typeof value.verified.candidateSetId !== "string" ||
    typeof value.verified.planId !== "string" ||
    ![2, 3].includes(value.verified.stopCount as number)
  ) {
    return false;
  }
  return true;
};
