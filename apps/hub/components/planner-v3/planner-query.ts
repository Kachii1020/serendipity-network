import {
  PLANNER_V3_AREAS,
  PLANNER_V3_INTEREST_PRESETS,
  PLANNER_V3_SCHEMA_VERSION,
  PLANNER_V3_TAGS,
  type PlannerIntentV3,
} from "@serendipity/contracts/planner-v3";

import type { PlannerFormDefaultsV3 } from "./planner-options";

export type PlannerQueryV3 = Record<
  string,
  string | readonly string[] | undefined
>;

const allowedKeys = new Set([
  "area",
  "auto",
  "budget",
  "date",
  "end",
  "exclude",
  "interest",
  "meal",
  "party",
  "start",
  "walk",
]);

const scalar = (
  value: string | readonly string[] | undefined,
): string | undefined => (typeof value === "string" ? value : undefined);

const list = (
  value: string | readonly string[] | undefined,
): readonly string[] =>
  value === undefined ? [] : typeof value === "string" ? [value] : value;

const tokyoParts = (now: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Tokyo",
    year: "numeric",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { day: read("day"), month: read("month"), year: read("year") };
};

export const tokyoDateV3 = (offsetDays = 0, now = new Date()): string => {
  const { day, month, year } = tokyoParts(now);
  return new Date(Date.UTC(year, month - 1, day + offsetDays))
    .toISOString()
    .slice(0, 10);
};

const tokyoMinuteOfDay = (now: Date): number => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).formatToParts(now);
  const read = (type: "hour" | "minute") =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return read("hour") * 60 + read("minute");
};

const timeValue = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const minuteOfDay = (value: string): number | undefined => {
  const match = /^(\d{2}):([0-5]\d)$/.exec(value);
  if (!match) return undefined;
  const hours = Number(match[1]);
  return hours <= 23 ? hours * 60 + Number(match[2]) : undefined;
};

const validDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
  );
};

export const earliestPlannerStartV3 = (
  date: string,
  now = new Date(),
): string | null => {
  if (date !== tokyoDateV3(0, now)) return "12:00";
  const earliest = Math.max(
    12 * 60,
    Math.ceil((tokyoMinuteOfDay(now) - 5) / 30) * 30,
  );
  return earliest <= 21 * 60 + 30 ? timeValue(earliest) : null;
};

export const defaultPlannerFormV3 = (
  now = new Date(),
): PlannerFormDefaultsV3 => {
  const today = tokyoDateV3(0, now);
  const earliest = earliestPlannerStartV3(today, now);
  const date = earliest ? today : tokyoDateV3(1, now);
  const startMinutes = Math.max(
    17 * 60 + 30,
    minuteOfDay(earliest ?? "17:30")!,
  );
  return {
    area: "shibuya",
    budgetPerPersonYen: 4000,
    date,
    end: timeValue(Math.max(22 * 60 + 30, startMinutes + 120)),
    excludedTags: [],
    includeMeal: true,
    interestPreset: "SURPRISE",
    partySize: 1,
    start: timeValue(startMinutes),
    walk: 20,
  };
};

export const toTokyoTimestampV3 = (date: string, time: string): string =>
  `${date}T${time}:00+09:00`;

export type NormalizedPlannerQueryV3 = {
  readonly autoSearch: boolean;
  readonly defaults: PlannerFormDefaultsV3;
  readonly invalid: boolean;
  readonly maxDate: string;
  readonly minDate: string;
  readonly normalized: URLSearchParams;
};

export const normalizePlannerQueryV3 = (
  query: PlannerQueryV3,
  now = new Date(),
  validThrough = tokyoDateV3(7, now),
): NormalizedPlannerQueryV3 => {
  const fallback = defaultPlannerFormV3(now);
  const minDate = fallback.date;
  const maxDate = [tokyoDateV3(7, now), validThrough].sort()[0]!;
  let invalid = Object.keys(query).some((key) => !allowedKeys.has(key));
  invalid ||= [
    query.area,
    query.auto,
    query.budget,
    query.date,
    query.end,
    query.interest,
    query.meal,
    query.party,
    query.start,
    query.walk,
  ].some(Array.isArray);

  const areaValue = scalar(query.area);
  const area = PLANNER_V3_AREAS.includes(
    areaValue as (typeof PLANNER_V3_AREAS)[number],
  )
    ? (areaValue as PlannerFormDefaultsV3["area"])
    : fallback.area;
  if (areaValue !== undefined && areaValue !== area) invalid = true;

  const partyValue = Number(scalar(query.party));
  const partySize = [1, 2, 3].includes(partyValue)
    ? (partyValue as 1 | 2 | 3)
    : fallback.partySize;
  if (query.party !== undefined && partyValue !== partySize) invalid = true;

  const dateValue = scalar(query.date);
  const date =
    dateValue &&
    validDate(dateValue) &&
    dateValue >= minDate &&
    dateValue <= maxDate
      ? dateValue
      : fallback.date;
  if (dateValue !== undefined && dateValue !== date) invalid = true;

  const startValue = scalar(query.start);
  const endValue = scalar(query.end);
  const startMinutes = startValue ? minuteOfDay(startValue) : undefined;
  const endMinutes = endValue ? minuteOfDay(endValue) : undefined;
  const earliest = earliestPlannerStartV3(date, now);
  const windowValid =
    startMinutes !== undefined &&
    endMinutes !== undefined &&
    startMinutes >= 12 * 60 &&
    endMinutes <= 23 * 60 + 30 &&
    endMinutes - startMinutes >= 120 &&
    endMinutes - startMinutes <= 600 &&
    earliest !== null &&
    startValue! >= earliest;
  const start = windowValid ? startValue! : fallback.start;
  const end = windowValid ? endValue! : fallback.end;
  if ((startValue !== undefined || endValue !== undefined) && !windowValid) {
    invalid = true;
  }

  const budgetValue = Number(scalar(query.budget));
  const budgetPerPersonYen =
    Number.isInteger(budgetValue) && budgetValue >= 0 && budgetValue <= 30_000
      ? budgetValue
      : fallback.budgetPerPersonYen;
  if (query.budget !== undefined && budgetValue !== budgetPerPersonYen) {
    invalid = true;
  }

  const interestValue = scalar(query.interest);
  const interestPreset = PLANNER_V3_INTEREST_PRESETS.includes(
    interestValue as (typeof PLANNER_V3_INTEREST_PRESETS)[number],
  )
    ? (interestValue as PlannerFormDefaultsV3["interestPreset"])
    : fallback.interestPreset;
  if (interestValue !== undefined && interestValue !== interestPreset) {
    invalid = true;
  }

  const includeMeal =
    query.meal === undefined
      ? fallback.includeMeal
      : scalar(query.meal) === "1";
  if (query.meal !== undefined && !["0", "1"].includes(scalar(query.meal)!)) {
    invalid = true;
  }
  if (interestPreset === "FOOD_DISCOVERY" && !includeMeal) invalid = true;

  const walkValue = Number(scalar(query.walk));
  const walk =
    Number.isInteger(walkValue) && walkValue >= 5 && walkValue <= 30
      ? walkValue
      : fallback.walk;
  if (query.walk !== undefined && walkValue !== walk) invalid = true;

  const requestedExcluded = list(query.exclude);
  const excludedTags = PLANNER_V3_TAGS.filter((tag) =>
    requestedExcluded.includes(tag),
  );
  if (requestedExcluded.length !== excludedTags.length) invalid = true;

  const defaults: PlannerFormDefaultsV3 = {
    area,
    budgetPerPersonYen,
    date,
    end,
    excludedTags,
    includeMeal,
    interestPreset,
    partySize,
    start,
    walk,
  };
  const normalized = plannerSearchParamsFromDefaultsV3(defaults);
  if (scalar(query.auto) === "1") normalized.set("auto", "1");
  return {
    autoSearch: scalar(query.auto) === "1",
    defaults,
    invalid,
    maxDate,
    minDate,
    normalized,
  };
};

export const plannerIntentFromDefaultsV3 = (
  defaults: PlannerFormDefaultsV3,
): PlannerIntentV3 => ({
  area: defaults.area,
  budgetPerPersonYen: defaults.budgetPerPersonYen,
  endAt: toTokyoTimestampV3(defaults.date, defaults.end),
  excludedTags: [...defaults.excludedTags],
  includeMeal: defaults.includeMeal,
  interestPreset: defaults.interestPreset,
  maxWalkMinutesPerLeg: defaults.walk,
  partySize: defaults.partySize,
  schemaVersion: PLANNER_V3_SCHEMA_VERSION,
  startAt: toTokyoTimestampV3(defaults.date, defaults.start),
});

export const plannerSearchParamsFromDefaultsV3 = (
  defaults: PlannerFormDefaultsV3,
): URLSearchParams => {
  const params = new URLSearchParams({
    area: defaults.area,
    budget: String(defaults.budgetPerPersonYen),
    date: defaults.date,
    end: defaults.end,
    interest: defaults.interestPreset,
    meal: defaults.includeMeal ? "1" : "0",
    party: String(defaults.partySize),
    start: defaults.start,
    walk: String(defaults.walk),
  });
  for (const tag of defaults.excludedTags) params.append("exclude", tag);
  return params;
};

export const plannerFormDefaultsFromIntentV3 = (
  intent: PlannerIntentV3,
): PlannerFormDefaultsV3 => ({
  area: intent.area,
  budgetPerPersonYen: intent.budgetPerPersonYen,
  date: intent.startAt.slice(0, 10),
  end: intent.endAt.slice(11, 16),
  excludedTags: intent.excludedTags,
  includeMeal: intent.includeMeal,
  interestPreset: intent.interestPreset,
  partySize: intent.partySize,
  start: intent.startAt.slice(11, 16),
  walk: intent.maxWalkMinutesPerLeg,
});
