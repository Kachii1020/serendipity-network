import {
  PLANNER_INTEREST_OPTIONS,
  type PlannerFormDefaults,
} from "./planner-form";

export type PlannerQuery = Record<
  string,
  string | readonly string[] | undefined
>;

const budgetValues = [3000, 5000, 8000] as const;
const walkValues = [10, 20, 30] as const;
const exclusionValues = ["alcohol", "smoking", "outdoors"] as const;
const interestValues = [
  ...PLANNER_INTEREST_OPTIONS.map(({ value }) => value),
  "coffee-tea",
  "food",
  "lively",
  "music",
  "outdoors",
  "shopping",
  "viewpoint",
] as const;
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

export const defaultPlannerForm = (now = new Date()): PlannerFormDefaults => ({
  budget: 5000,
  date: tokyoDate(0, now),
  end: "22:00",
  excludedTags: [],
  interests: ["art", "quiet"],
  start: "17:00",
  walk: 20,
});

const list = (
  value: string | readonly string[] | undefined,
): readonly string[] =>
  value === undefined ? [] : typeof value === "string" ? [value] : value;

const scalar = (
  value: string | readonly string[] | undefined,
): string | undefined => (typeof value === "string" ? value : undefined);

const minuteOfDay = (value: string): number | undefined => {
  const match = /^(\d{2}):(00|30)$/.exec(value);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 ? hours * 60 + minutes : undefined;
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
): NormalizedPlannerQuery => {
  const fallback = defaultPlannerForm(now);
  const minDate = tokyoDate(0, now);
  const maxDate = tokyoDate(7, now);
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
    dateValue && dateValue >= minDate && dateValue <= maxDate
      ? dateValue
      : fallback.date;
  if (dateValue !== undefined && dateValue !== date) invalid = true;

  const startValue = scalar(query.start);
  const endValue = scalar(query.end);
  const startMinutes = startValue ? minuteOfDay(startValue) : undefined;
  const endMinutes = endValue ? minuteOfDay(endValue) : undefined;
  const validWindow =
    startMinutes !== undefined &&
    endMinutes !== undefined &&
    startMinutes >= 12 * 60 &&
    endMinutes <= 23 * 60 + 30 &&
    endMinutes - startMinutes >= 120 &&
    endMinutes - startMinutes <= 600;
  const start = validWindow ? startValue! : fallback.start;
  const end = validWindow ? endValue! : fallback.end;
  if ((startValue !== undefined || endValue !== undefined) && !validWindow) {
    invalid = true;
  }

  const budgetValue = Number(scalar(query.budget));
  const budget = budgetValues.includes(
    budgetValue as (typeof budgetValues)[number],
  )
    ? budgetValue
    : fallback.budget;
  if (query.budget !== undefined && budgetValue !== budget) invalid = true;

  const walkValue = Number(scalar(query.walk));
  const walk = walkValues.includes(walkValue as (typeof walkValues)[number])
    ? walkValue
    : fallback.walk;
  if (query.walk !== undefined && walkValue !== walk) invalid = true;

  const requestedInterests = list(query.interests);
  const validInterests = interestValues.filter((value) =>
    requestedInterests.includes(value),
  );
  const interests =
    validInterests.length > 0 && validInterests.length <= 3
      ? validInterests
      : fallback.interests;
  if (
    query.interests !== undefined &&
    (requestedInterests.length !== validInterests.length ||
      requestedInterests.length === 0 ||
      requestedInterests.length > 3)
  ) {
    invalid = true;
  }

  const requestedExclusions = list(query.exclude);
  const excludedTags = exclusionValues.filter((value) =>
    requestedExclusions.includes(value),
  );
  if (requestedExclusions.length !== excludedTags.length) invalid = true;

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
  interests.forEach((value) => normalized.append("interests", value));
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
