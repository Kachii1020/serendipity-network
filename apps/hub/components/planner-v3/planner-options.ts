import type {
  InterestPresetV3,
  PlannerAreaV3,
  PlannerTagV3,
} from "@serendipity/contracts/planner-v3";

export const AREA_OPTIONS: readonly {
  label: string;
  station: string;
  value: PlannerAreaV3;
}[] = [
  { label: "Shibuya", station: "Shibuya Station", value: "shibuya" },
  { label: "Shinjuku", station: "Shinjuku Station", value: "shinjuku" },
  { label: "Ikebukuro", station: "Ikebukuro Station", value: "ikebukuro" },
];

export const INTEREST_OPTIONS: readonly {
  label: string;
  value: InterestPresetV3;
}[] = [
  { label: "Surprise me", value: "SURPRISE" },
  { label: "Art & heritage", value: "ART_HERITAGE" },
  { label: "Food discovery", value: "FOOD_DISCOVERY" },
  { label: "Hands-on", value: "HANDS_ON" },
  { label: "Calm & quiet", value: "CALM_QUIET" },
  { label: "Lively", value: "LIVELY" },
];

export const BUDGET_PRESETS = [2000, 4000, 7000] as const;
export const PARTY_PRESETS = [1, 2, 3] as const;

export type PlannerFormDefaultsV3 = {
  readonly area: PlannerAreaV3;
  readonly budgetPerPersonYen: number;
  readonly date: string;
  readonly end: string;
  readonly excludedTags: readonly PlannerTagV3[];
  readonly includeMeal: boolean;
  readonly interestPreset: InterestPresetV3;
  readonly partySize: 1 | 2 | 3;
  readonly start: string;
  readonly walk: number;
};

export const areaLabel = (area: PlannerAreaV3): string =>
  AREA_OPTIONS.find(({ value }) => value === area)?.label ?? area;
