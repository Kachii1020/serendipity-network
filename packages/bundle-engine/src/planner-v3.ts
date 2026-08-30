import {
  INTEREST_PRESET_TAGS_V3,
  PLANNER_V3_DISCLAIMER,
  projectPriceCostV3,
  validateAreaDataPackV3,
  validateEveningPlanV3,
  validatePlannerIntentV3,
  validateReviewedPackClaimsV3,
  validateSwapPlanInputV3,
  type AreaDataPackV3,
  type CoordinatesV3,
  type EveningPlanStopV3,
  type EveningPlanV3,
  type PlannerIntentV3,
  type PlannerPlaceV3,
  type ReviewedPackClaimLedgerV3,
  type StopCostV3,
  type SwapPlanInputV3,
  type SwapPreferenceV3,
} from "@serendipity/contracts/planner-v3";

const MINUTE = 60_000;
const DAY = 86_400_000;
const CLOSING_HEADROOM_MINUTES = 10;
const MAX_WAIT_MINUTES = 30;

type PackGateFailure =
  | "INVALID_DATA_PACK"
  | "INACTIVE_DATA_PACK"
  | "UNREVIEWED_DATA_PACK"
  | "EXPIRED_DATA_PACK"
  | "AREA_MISMATCH";

export type ActiveAreaDataPackValidationV3 =
  | { ok: true; pack: AreaDataPackV3; warnings: string[] }
  | { ok: false; reason: PackGateFailure };

export type ComposeEveningPlanInputV3 = Readonly<{
  intent: PlannerIntentV3;
  dataPack: AreaDataPackV3;
  reviewedClaims: ReviewedPackClaimLedgerV3;
  asOf?: Date;
}>;

export type ComposeEveningPlanResultV3 =
  | {
      ok: true;
      candidateSetId: string;
      plan: EveningPlanV3;
      warnings: string[];
    }
  | {
      ok: false;
      code: "VALIDATION_ERROR" | "NO_VALID_PLAN" | "STALE_DATA_PACK";
    };

export type SwapEveningPlanStopInputV3 = SwapPlanInputV3 &
  Readonly<{
    dataPack: AreaDataPackV3;
    reviewedClaims: ReviewedPackClaimLedgerV3;
    asOf?: Date;
  }>;

export type SwapEveningPlanStopResultV3 =
  | {
      ok: true;
      candidateSetId: string;
      plan: EveningPlanV3;
      replacedStopIndex: number;
      preference: SwapPreferenceV3;
      warnings: string[];
    }
  | {
      ok: false;
      code:
        | "VALIDATION_ERROR"
        | "NO_REPLACEMENT"
        | "STALE_DATA_PACK"
        | "STALE_PLAN";
    };

const round = (value: number, places: number): number => {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const digest = async (value: string): Promise<string> => {
  const bytes = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const canonicalIntent = (intent: PlannerIntentV3) => ({
  schemaVersion: intent.schemaVersion,
  area: intent.area,
  partySize: intent.partySize,
  startAt: intent.startAt,
  endAt: intent.endAt,
  budgetPerPersonYen: intent.budgetPerPersonYen,
  includeMeal: intent.includeMeal,
  interestPreset: intent.interestPreset,
  maxWalkMinutesPerLeg: intent.maxWalkMinutesPerLeg,
  excludedTags: [...intent.excludedTags].sort(),
});

export const createCandidateSetIdV3 = async (
  intent: PlannerIntentV3,
  pack: AreaDataPackV3,
): Promise<string> => {
  const identity = JSON.stringify({
    schemaVersion: "3",
    packVersion: pack.packVersion,
    intent: canonicalIntent(intent),
    placeIds: pack.places.map(({ placeId }) => placeId).sort(),
  });
  return `candidates-${(await digest(identity)).slice(0, 24)}`;
};

const canonicalPlanIdentity = (plan: EveningPlanV3) => {
  const identity = { ...plan, planId: undefined };
  return JSON.stringify(identity);
};

const createPlanId = async (plan: EveningPlanV3): Promise<string> =>
  `plan-${(await digest(canonicalPlanIdentity(plan))).slice(0, 24)}`;

const sourceWarnings = (pack: AreaDataPackV3, asOf: Date): string[] => {
  const warnings = new Set<string>();
  for (const source of pack.sources) {
    const ageDays = (asOf.getTime() - Date.parse(source.checkedAt)) / DAY;
    if (ageDays > 14) {
      warnings.add(`SOURCE_RECHECK_RECOMMENDED:${source.sourceId}`);
    }
  }
  return [...warnings].sort();
};

export const validateActiveAreaDataPackV3 = (
  dataPack: unknown,
  reviewedClaims: ReviewedPackClaimLedgerV3,
  asOf = new Date(),
  intent?: PlannerIntentV3,
): ActiveAreaDataPackValidationV3 => {
  const validation = validateAreaDataPackV3(dataPack);
  if (!validation.ok) return { ok: false, reason: "INVALID_DATA_PACK" };
  const pack = validation.value;
  if (pack.status !== "ACTIVE") {
    return { ok: false, reason: "INACTIVE_DATA_PACK" };
  }
  if (!validateReviewedPackClaimsV3(pack, reviewedClaims).ok) {
    return { ok: false, reason: "UNREVIEWED_DATA_PACK" };
  }
  if (intent && intent.area !== pack.area) {
    return { ok: false, reason: "AREA_MISMATCH" };
  }
  const now = asOf.getTime();
  if (
    !Number.isFinite(now) ||
    now < Date.parse(pack.generatedAt) ||
    now > Date.parse(pack.validThrough) ||
    (intent && Date.parse(intent.endAt) > Date.parse(pack.validThrough)) ||
    pack.sources.some(({ checkedAt }) => now - Date.parse(checkedAt) > 60 * DAY)
  ) {
    return { ok: false, reason: "EXPIRED_DATA_PACK" };
  }
  return { ok: true, pack, warnings: sourceWarnings(pack, asOf) };
};

export const estimateCoordinateTravelV3 = (
  from: CoordinatesV3,
  to: CoordinatesV3,
): { distanceMeters: number; minutes: number } => {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const fromLatitude = radians(from.latitude);
  const toLatitude = radians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const straightLineMeters =
    6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  const conservativeMeters = Math.ceil(straightLineMeters * 1.25);
  const rawMinutes = conservativeMeters / 75;
  return {
    distanceMeters: conservativeMeters,
    minutes: Math.max(5, Math.ceil(rawMinutes / 5) * 5),
  };
};

export const calculateStopCostV3 = (
  place: PlannerPlaceV3,
  partySize: 1 | 2 | 3,
): StopCostV3 => projectPriceCostV3(place.price, partySize);

const weekdayFor = (date: string): number =>
  new Date(`${date}T12:00:00+09:00`).getUTCDay();
const localTimestamp = (date: string, time: string): number =>
  Date.parse(`${date}T${time}:00+09:00`);

const openingWindow = (
  place: PlannerPlaceV3,
  date: string,
): { opensAt: number; closesAt: number } | null => {
  const exception = place.dateExceptions.find(
    (candidate) => candidate.date === date,
  );
  if (exception?.closed === true) return null;
  if (exception?.closed === false) {
    return {
      opensAt: localTimestamp(date, exception.opens),
      closesAt: localTimestamp(date, exception.closes),
    };
  }
  const weekday = weekdayFor(date);
  const windows = place.weeklyHours
    .filter(({ days }) => days.includes(weekday))
    .map(({ opens, closes }) => ({
      opensAt: localTimestamp(date, opens),
      closesAt: localTimestamp(date, closes),
    }))
    .sort((left, right) => left.opensAt - right.opensAt);
  return windows[0] ?? null;
};

const formatTimestamp = (milliseconds: number): string => {
  const local = new Date(milliseconds + 9 * 60 * MINUTE)
    .toISOString()
    .replace("Z", "+09:00");
  return local;
};

const compactPlace = (place: PlannerPlaceV3) => ({
  placeId: place.placeId,
  role: place.role,
  name: place.name,
  summary: place.summary,
  category: place.category,
  address: place.address,
  tags: place.tags,
  officialUrl: place.officialUrl,
  googlePlaceId: place.googlePlaceId,
});

type ScheduledCandidate = {
  places: PlannerPlaceV3[];
  stops: EveningPlanStopV3[];
  totals: EveningPlanV3["totals"];
  preferenceFit: number;
  score: number;
  scoreBreakdown: EveningPlanV3["scoreBreakdown"];
  reasonCodes: EveningPlanV3["reasonCodes"];
};

const schedulePlaces = (
  places: PlannerPlaceV3[],
  intent: PlannerIntentV3,
  pack: AreaDataPackV3,
): ScheduledCandidate | null => {
  const date = intent.startAt.slice(0, 10);
  const sourceById = new Map(
    pack.sources.map((source) => [source.sourceId, source]),
  );
  let cursor = Date.parse(intent.startAt);
  let previousCoordinates = pack.station.coordinates;
  let previousLabel = pack.station.name;
  const stops: EveningPlanStopV3[] = [];
  for (const [position, place] of places.entries()) {
    const travel = estimateCoordinateTravelV3(
      previousCoordinates,
      place.coordinates,
    );
    if (travel.minutes > intent.maxWalkMinutesPerLeg) return null;
    const arrival = cursor + travel.minutes * MINUTE;
    const hours = openingWindow(place, date);
    if (!hours) return null;
    const startsAt = Math.max(arrival, hours.opensAt);
    if ((startsAt - arrival) / MINUTE > MAX_WAIT_MINUTES) return null;
    const endsAt = startsAt + place.recommendedVisitMinutes * MINUTE;
    if (
      endsAt + CLOSING_HEADROOM_MINUTES * MINUTE > hours.closesAt ||
      endsAt > Date.parse(intent.endAt)
    ) {
      return null;
    }
    const hoursSource = sourceById.get(place.evidence.hours.sourceId);
    if (!hoursSource) return null;
    const cost = calculateStopCostV3(place, intent.partySize);
    const preferenceTags = INTEREST_PRESET_TAGS_V3[intent.interestPreset];
    const matches = place.tags.some((tag) =>
      preferenceTags.includes(tag as never),
    );
    stops.push({
      position,
      place: compactPlace(place),
      startsAt: formatTimestamp(startsAt),
      endsAt: formatTimestamp(endsAt),
      price: place.price,
      cost,
      travelFromPreviousMinutes: travel.minutes,
      travelFromPreviousDistanceMeters: travel.distanceMeters,
      travelOriginLabel: previousLabel,
      travelMethod: "COORDINATE_ESTIMATE",
      openingFit: "Published hours cover this visit with closing headroom.",
      whyThisStop: matches
        ? `Matches the ${intent.interestPreset.toLowerCase().replaceAll("_", " ")} preference.`
        : place.role === "MEAL"
          ? "Adds a published-price meal to the route."
          : "Fits the route's time, budget, and walking constraints.",
      sourcePublisher: hoursSource.publisher,
      sourceCheckedAt: hoursSource.checkedAt,
    });
    cursor = endsAt;
    previousCoordinates = place.coordinates;
    previousLabel = place.name;
  }

  const sumCost = <K extends keyof StopCostV3>(key: K) =>
    stops.reduce((total, stop) => total + stop.cost[key], 0);
  const totalWalkMinutes = stops.reduce(
    (total, stop) => total + stop.travelFromPreviousMinutes,
    0,
  );
  const perPersonMaxYen = sumCost("perPersonMaxYen");
  if (perPersonMaxYen > intent.budgetPerPersonYen) return null;
  const preferenceTags = INTEREST_PRESET_TAGS_V3[intent.interestPreset];
  const matchingStops = places.filter((place) =>
    place.tags.some((tag) => preferenceTags.includes(tag as never)),
  ).length;
  if (intent.interestPreset !== "SURPRISE" && matchingStops === 0) return null;
  const preferenceFit =
    intent.interestPreset === "SURPRISE" ? 1 : matchingStops / places.length;
  const walkingEfficiency = clamp01(
    1 - totalWalkMinutes / (intent.maxWalkMinutesPerLeg * places.length),
  );
  const visitMinutes = stops.reduce(
    (total, stop) =>
      total + (Date.parse(stop.endsAt) - Date.parse(stop.startsAt)) / MINUTE,
    0,
  );
  const windowMinutes =
    (Date.parse(intent.endAt) - Date.parse(intent.startAt)) / MINUTE;
  const timeUtilization = clamp01(visitMinutes / windowMinutes);
  const categoryDiversity = clamp01(
    new Set(places.map(({ category }) => category)).size / places.length,
  );
  const scoreBreakdown = {
    preferenceFit: round(preferenceFit, 6),
    walkingEfficiency: round(walkingEfficiency, 6),
    timeUtilization: round(timeUtilization, 6),
    categoryDiversity: round(categoryDiversity, 6),
  };
  const score = round(
    preferenceFit * 40 +
      walkingEfficiency * 25 +
      timeUtilization * 20 +
      categoryDiversity * 15,
    4,
  );
  const reasonCodes: EveningPlanV3["reasonCodes"] = [];
  if (intent.interestPreset === "SURPRISE" || matchingStops > 0) {
    reasonCodes.push("MATCHES_INTEREST");
  }
  if (walkingEfficiency >= 0.5) reasonCodes.push("SHORT_WALKS");
  if (timeUtilization >= 0.4) reasonCodes.push("USES_TIME_WELL");
  if (categoryDiversity >= 2 / places.length) reasonCodes.push("VARIED_STOPS");
  reasonCodes.push("WITHIN_BUDGET");
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return null;
  return {
    places,
    stops,
    totals: {
      perPersonMinYen: sumCost("perPersonMinYen"),
      perPersonMaxYen,
      estimatedGroupMinYen: sumCost("estimatedGroupMinYen"),
      estimatedGroupMaxYen: sumCost("estimatedGroupMaxYen"),
      totalWalkMinutes,
      stopCount: stops.length,
      startsAt: first.startsAt,
      endsAt: last.endsAt,
    },
    preferenceFit,
    score,
    scoreBreakdown,
    reasonCodes,
  };
};

const permutationsForRoles = (
  roles: Array<"ACTIVITY" | "MEAL">,
  places: PlannerPlaceV3[],
): PlannerPlaceV3[][] => {
  const results: PlannerPlaceV3[][] = [];
  const walk = (index: number, selected: PlannerPlaceV3[]) => {
    if (index === roles.length) {
      results.push(selected);
      return;
    }
    const role = roles[index];
    for (const place of places) {
      if (
        place.role === role &&
        !selected.some(({ placeId }) => placeId === place.placeId)
      ) {
        walk(index + 1, [...selected, place]);
      }
    }
  };
  walk(0, []);
  return results;
};

const eligiblePlaces = (
  pack: AreaDataPackV3,
  intent: PlannerIntentV3,
): PlannerPlaceV3[] =>
  pack.places.filter(
    (place) =>
      !place.tags.some((tag) => intent.excludedTags.includes(tag)) &&
      (intent.includeMeal || place.role !== "MEAL"),
  );

const candidateToPlan = async (
  candidate: ScheduledCandidate,
  intent: PlannerIntentV3,
  pack: AreaDataPackV3,
  candidateSetId: string,
): Promise<EveningPlanV3> => {
  const provisional: EveningPlanV3 = {
    schemaVersion: "3",
    planId: "plan-pending",
    candidateSetId,
    packVersion: pack.packVersion,
    intent,
    stops: candidate.stops,
    totals: candidate.totals,
    score: candidate.score,
    scoreBreakdown: candidate.scoreBreakdown,
    reasonCodes: candidate.reasonCodes,
    travelMethod: "COORDINATE_ESTIMATE",
    disclaimer: PLANNER_V3_DISCLAIMER,
  };
  return { ...provisional, planId: await createPlanId(provisional) };
};

const comparePlans = (left: EveningPlanV3, right: EveningPlanV3): number =>
  right.score - left.score ||
  left.totals.totalWalkMinutes - right.totals.totalWalkMinutes ||
  left.totals.perPersonMaxYen - right.totals.perPersonMaxYen ||
  Date.parse(left.totals.endsAt) - Date.parse(right.totals.endsAt) ||
  left.planId.localeCompare(right.planId);

const composeRoleGrammar = async (
  roles: Array<"ACTIVITY" | "MEAL">,
  intent: PlannerIntentV3,
  pack: AreaDataPackV3,
  candidateSetId: string,
): Promise<EveningPlanV3[]> => {
  const scheduled = permutationsForRoles(roles, eligiblePlaces(pack, intent))
    .map((places) => schedulePlaces(places, intent, pack))
    .filter((candidate): candidate is ScheduledCandidate => candidate !== null);
  return Promise.all(
    scheduled.map((candidate) =>
      candidateToPlan(candidate, intent, pack, candidateSetId),
    ),
  );
};

export const composeEveningPlanV3 = async ({
  intent,
  dataPack,
  reviewedClaims,
  asOf = new Date(),
}: ComposeEveningPlanInputV3): Promise<ComposeEveningPlanResultV3> => {
  if (!validatePlannerIntentV3(intent, { now: asOf }).ok) {
    return { ok: false, code: "VALIDATION_ERROR" };
  }
  const gate = validateActiveAreaDataPackV3(
    dataPack,
    reviewedClaims,
    asOf,
    intent,
  );
  if (!gate.ok) return { ok: false, code: "STALE_DATA_PACK" };
  const candidateSetId = await createCandidateSetIdV3(intent, gate.pack);
  const grammars: Array<Array<"ACTIVITY" | "MEAL">> = intent.includeMeal
    ? [
        ["ACTIVITY", "MEAL", "ACTIVITY"],
        ["ACTIVITY", "MEAL"],
      ]
    : [
        ["ACTIVITY", "ACTIVITY", "ACTIVITY"],
        ["ACTIVITY", "ACTIVITY"],
      ];
  for (const roles of grammars) {
    const plans = await composeRoleGrammar(
      roles,
      intent,
      gate.pack,
      candidateSetId,
    );
    plans.sort(comparePlans);
    const plan = plans[0];
    if (plan) {
      return { ok: true, candidateSetId, plan, warnings: gate.warnings };
    }
  }
  return { ok: false, code: "NO_VALID_PLAN" };
};

const preferenceSatisfied = (
  preference: SwapPreferenceV3,
  previous: EveningPlanV3,
  next: EveningPlanV3,
  stopIndex: number,
): boolean => {
  const previousStop = previous.stops[stopIndex];
  const nextStop = next.stops[stopIndex];
  if (!previousStop || !nextStop) return false;
  if (preference === "CHEAPER") {
    return nextStop.cost.perPersonMaxYen < previousStop.cost.perPersonMaxYen;
  }
  if (preference === "LESS_WALKING") {
    return next.totals.totalWalkMinutes < previous.totals.totalWalkMinutes;
  }
  return nextStop.place.tags.some(
    (tag) => !previousStop.place.tags.includes(tag),
  );
};

const compareSwapPlans = (
  preference: SwapPreferenceV3,
  stopIndex: number,
  left: EveningPlanV3,
  right: EveningPlanV3,
): number => {
  if (preference === "CHEAPER") {
    return (
      left.stops[stopIndex]!.cost.perPersonMaxYen -
        right.stops[stopIndex]!.cost.perPersonMaxYen ||
      comparePlans(left, right)
    );
  }
  if (preference === "LESS_WALKING") {
    return (
      left.totals.totalWalkMinutes - right.totals.totalWalkMinutes ||
      comparePlans(left, right)
    );
  }
  return comparePlans(left, right);
};

export const swapEveningPlanStopV3 = async (
  input: SwapEveningPlanStopInputV3,
): Promise<SwapEveningPlanStopResultV3> => {
  const core: SwapPlanInputV3 = {
    schemaVersion: input.schemaVersion,
    candidateSetId: input.candidateSetId,
    planId: input.planId,
    intent: input.intent,
    plan: input.plan,
    stopIndex: input.stopIndex,
    preference: input.preference,
  };
  if (!validateSwapPlanInputV3(core).ok) {
    return { ok: false, code: "VALIDATION_ERROR" };
  }
  const asOf = input.asOf ?? new Date();
  const gate = validateActiveAreaDataPackV3(
    input.dataPack,
    input.reviewedClaims,
    asOf,
    input.intent,
  );
  if (!gate.ok) return { ok: false, code: "STALE_DATA_PACK" };
  const candidateSetId = await createCandidateSetIdV3(input.intent, gate.pack);
  const expectedPlanId = await createPlanId({
    ...input.plan,
    planId: "plan-pending",
  });
  if (
    candidateSetId !== input.candidateSetId ||
    expectedPlanId !== input.planId ||
    input.plan.packVersion !== gate.pack.packVersion ||
    !validateEveningPlanV3(input.plan).ok
  ) {
    return { ok: false, code: "STALE_PLAN" };
  }
  const currentIds = input.plan.stops.map(({ place }) => place.placeId);
  const currentPlaces = currentIds.map((placeId) =>
    gate.pack.places.find((place) => place.placeId === placeId),
  );
  if (currentPlaces.some((place) => place === undefined)) {
    return { ok: false, code: "STALE_PLAN" };
  }
  const currentStop = input.plan.stops[input.stopIndex];
  if (!currentStop) return { ok: false, code: "VALIDATION_ERROR" };
  const replacements = eligiblePlaces(gate.pack, input.intent).filter(
    (place) =>
      place.role === currentStop.place.role &&
      !currentIds.includes(place.placeId),
  );
  const plans: EveningPlanV3[] = [];
  for (const replacement of replacements) {
    const places = [...(currentPlaces as PlannerPlaceV3[])];
    places[input.stopIndex] = replacement;
    const scheduled = schedulePlaces(places, input.intent, gate.pack);
    if (!scheduled) continue;
    const plan = await candidateToPlan(
      scheduled,
      input.intent,
      gate.pack,
      candidateSetId,
    );
    if (
      preferenceSatisfied(input.preference, input.plan, plan, input.stopIndex)
    ) {
      plans.push(plan);
    }
  }
  plans.sort((left, right) =>
    compareSwapPlans(input.preference, input.stopIndex, left, right),
  );
  const plan = plans[0];
  if (!plan) return { ok: false, code: "NO_REPLACEMENT" };
  return {
    ok: true,
    candidateSetId,
    plan,
    replacedStopIndex: input.stopIndex,
    preference: input.preference,
    warnings: gate.warnings,
  };
};
