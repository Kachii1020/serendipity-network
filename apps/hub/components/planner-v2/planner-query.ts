import type { PlannerIntentV2 } from "@serendipity/contracts/planner-v2";
import { PLANNER_TAGS } from "@serendipity/contracts/planner-v2-shared";

import type { PlannerFormDefaults } from "./planner-options";

export type PlannerQuery = Record<
  string,
  string | readonly string[] | undefined
>;

const exclusionValues = PLANNER_TAGS;
const interestValues = PLANNER_TAGS;
const NO_INTERESTS_QUERY_VALUE = "none";
export const PLANNER_START_GRACE_MINUTES = 5;
const allowedKeys = new Set([
  "auto",
  "budget",
  "date",
  "end",
  "exclude",
  "interests",
  "start",
  "walk",
]);

const tokyoParts = (
  now: Date,
): { day: number; month: number; year: number } => {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Tokyo",
    year: "numeric",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  return { day: value("day"), month: value("month"), year: value("year") };
};

export const tokyoDate = (offsetDays = 0, now = new Date()): string => {
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
  const value = (type: "hour" | "minute") =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return value("hour") * 60 + value("minute");
};

const timeValue = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export const earliestPlannerStart = (
  date: string,
  now = new Date(),
): string | null => {
  if (date !== tokyoDate(0, now)) return "12:00";
  const earliest = Math.max(
    12 * 60,
    Math.ceil((tokyoMinuteOfDay(now) - PLANNER_START_GRACE_MINUTES) / 30) * 30,
  );
  return earliest <= 21 * 60 + 30 ? timeValue(earliest) : null;
};

export const defaultPlannerForm = (now = new Date()): PlannerFormDefaults => {
  const today = tokyoDate(0, now);
  const earliest = earliestPlannerStart(today, now);
  const earliestMinutes = earliest ? (minuteOfDay(earliest) ?? 17 * 60) : null;
  const lateForToday = earliestMinutes === null;
  const date = lateForToday ? tokyoDate(1, now) : today;
  const start = lateForToday
    ? "17:00"
    : timeValue(Math.max(17 * 60, earliestMinutes));
  const end = timeValue(Math.max(22 * 60, (minuteOfDay(start) ?? 1020) + 120));
  return {
    budget: 5000,
    date,
    end,
    excludedTags: [],
    interests: ["art", "quiet"],
    start,
    walk: 20,
  };
};

const list = (
  value: string | readonly string[] | undefined,
): readonly string[] =>
  value === undefined ? [] : typeof value === "string" ? [value] : value;

const scalar = (
  value: string | readonly string[] | undefined,
): string | undefined => (typeof value === "string" ? value : undefined);

const minuteOfDay = (value: string): number | undefined => {
  const match = /^(\d{2}):([0-5]\d)$/.exec(value);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 ? hours * 60 + minutes : undefined;
};

const validCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
  );
};

export type NormalizedPlannerQuery = {
  readonly autoSearch: boolean;
  readonly defaults: PlannerFormDefaults;
  readonly invalid: boolean;
  readonly maxDate: string;
  readonly minDate: string;
  readonly normalized: URLSearchParams;
};

export const normalizePlannerQuery = (
  query: PlannerQuery,
  now = new Date(),
  sourcePackValidThrough = tokyoDate(7, now),
): NormalizedPlannerQuery => {
  const fallback = defaultPlannerForm(now);
  const minDate = fallback.date;
  const requestedMaxDate = tokyoDate(7, now);
  const maxDate =
    requestedMaxDate < sourcePackValidThrough
      ? requestedMaxDate
      : sourcePackValidThrough;
  let invalid = Object.keys(query).some((key) => !allowedKeys.has(key));
  invalid ||= [
    query.auto,
    query.budget,
    query.date,
    query.end,
    query.start,
    query.walk,
  ].some(Array.isArray);

  const dateValue = scalar(query.date);
  const date =
    dateValue &&
    validCalendarDate(dateValue) &&
    dateValue >= minDate &&
    dateValue <= maxDate
      ? dateValue
      : fallback.date;
  if (dateValue !== undefined && dateValue !== date) invalid = true;

  const startValue = scalar(query.start);
  const endValue = scalar(query.end);
  const startMinutes = startValue ? minuteOfDay(startValue) : undefined;
  const endMinutes = endValue ? minuteOfDay(endValue) : undefined;
  const staticWindowValid =
    startMinutes !== undefined &&
    endMinutes !== undefined &&
    startMinutes >= 12 * 60 &&
    endMinutes <= 23 * 60 + 30 &&
    endMinutes - startMinutes >= 120 &&
    endMinutes - startMinutes <= 600;
  const requestedStartAt =
    staticWindowValid && dateValue
      ? Date.parse(`${date}T${startValue}:00+09:00`)
      : Number.NaN;
  const validWindow =
    staticWindowValid &&
    requestedStartAt >= now.getTime() - PLANNER_START_GRACE_MINUTES * 60_000;
  const start = validWindow ? startValue! : fallback.start;
  const end = validWindow ? endValue! : fallback.end;
  if ((startValue !== undefined || endValue !== undefined) && !validWindow) {
    invalid = true;
  }

  const budgetValue = Number(scalar(query.budget));
  const budget =
    Number.isInteger(budgetValue) && budgetValue >= 0 && budgetValue <= 30_000
      ? budgetValue
      : fallback.budget;
  if (query.budget !== undefined && budgetValue !== budget) invalid = true;

  const walkValue = Number(scalar(query.walk));
  const walk =
    Number.isInteger(walkValue) && walkValue >= 5 && walkValue <= 30
      ? walkValue
      : fallback.walk;
  if (query.walk !== undefined && walkValue !== walk) invalid = true;

  const rawInterests = list(query.interests);
  const requestedInterests = rawInterests.filter(
    (value) => value !== NO_INTERESTS_QUERY_VALUE && value !== "",
  );
  const validInterests = interestValues.filter((value) =>
    requestedInterests.includes(value),
  );
  const interests =
    query.interests === undefined
      ? fallback.interests
      : validInterests.length <= 5
        ? validInterests
        : fallback.interests;
  if (
    query.interests !== undefined &&
    (requestedInterests.length !== validInterests.length ||
      requestedInterests.length > 5 ||
      rawInterests.some(
        (value) =>
          value !== "" &&
          value !== NO_INTERESTS_QUERY_VALUE &&
          !interestValues.includes(value as (typeof interestValues)[number]),
      ))
  ) {
    invalid = true;
  }

  const requestedExclusions = list(query.exclude);
  const validExcludedTags = exclusionValues.filter((value) =>
    requestedExclusions.includes(value),
  );
  const excludedTags = validExcludedTags.filter(
    (value) => !interests.includes(value),
  );
  if (
    requestedExclusions.length !== validExcludedTags.length ||
    excludedTags.length !== validExcludedTags.length
  ) {
    invalid = true;
  }

  const autoValue = scalar(query.auto);
  const autoSearch = autoValue === "1";
  if (query.auto !== undefined && !autoSearch) invalid = true;
  if (
    Object.values(query).some(
      (value) => Array.isArray(value) && value.length === 0,
    )
  ) {
    invalid = true;
  }

  const normalized = new URLSearchParams({
    budget: String(budget),
    date,
    end,
    start,
    walk: String(walk),
  });
  if (interests.length === 0) {
    normalized.append("interests", NO_INTERESTS_QUERY_VALUE);
  } else {
    interests.forEach((value) => normalized.append("interests", value));
  }
  excludedTags.forEach((value) => normalized.append("exclude", value));
  if (autoSearch) normalized.set("auto", "1");

  return {
    autoSearch,
    defaults: {
      budget,
      date,
      end,
      excludedTags,
      interests,
      start,
      walk,
    },
    invalid,
    maxDate,
    minDate,
    normalized,
  };
};

export const toTokyoTimestamp = (date: string, time: string): string =>
  `${date}T${time}:00+09:00`;

export const plannerFormDefaultsFromIntent = (
  intent: PlannerIntentV2,
): PlannerFormDefaults => ({
  budget: intent.totalBudgetYen,
  date: intent.startAt.slice(0, 10),
  end: intent.endAt.slice(11, 16),
  excludedTags: intent.excludedTags,
  interests: intent.preferredTags,
  start: intent.startAt.slice(11, 16),
  walk: intent.maxWalkMinutesPerLeg,
});

export const plannerIntentFromDefaults = (
  defaults: PlannerFormDefaults,
): PlannerIntentV2 => ({
  area: "shibuya",
  endAt: toTokyoTimestamp(defaults.date, defaults.end),
  excludedTags: [...defaults.excludedTags],
  maxWalkMinutesPerLeg: defaults.walk,
  partySize: 1,
  preferredTags: [...defaults.interests],
  schemaVersion: "2",
  startAt: toTokyoTimestamp(defaults.date, defaults.start),
  stopCount: "AUTO",
  totalBudgetYen: defaults.budget,
});

export const plannerSearchParamsFromDefaults = (
  defaults: PlannerFormDefaults,
): URLSearchParams => {
  const params = new URLSearchParams({
    auto: "1",
    budget: String(defaults.budget),
    date: defaults.date,
    end: defaults.end,
    start: defaults.start,
    walk: String(defaults.walk),
  });
  if (defaults.interests.length === 0) {
    params.append("interests", NO_INTERESTS_QUERY_VALUE);
  } else {
    defaults.interests.forEach((value) => params.append("interests", value));
  }
  defaults.excludedTags.forEach((value) => params.append("exclude", value));
  return params;
};
