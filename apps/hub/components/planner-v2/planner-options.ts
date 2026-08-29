import type { PlannerTag } from "@serendipity/contracts/planner-v2";

export const PLANNER_INTEREST_OPTIONS = [
  { label: "Art & culture", value: "art" },
  { label: "Quiet", value: "quiet" },
] as const;

export type PlannerFormDefaults = {
  readonly budget: number;
  readonly date: string;
  readonly end: string;
  readonly excludedTags: readonly PlannerTag[];
  readonly interests: readonly PlannerTag[];
  readonly start: string;
  readonly walk: number;
};
