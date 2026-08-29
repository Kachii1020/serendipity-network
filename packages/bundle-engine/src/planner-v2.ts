import {
  type EveningPlanStopV2,
  type EveningPlanV2,
  type PlaceDataPackV2,
  type PlannerIntentV2,
  type PlannerPlaceV2,
  type SwapPreferenceV2,
  validatePlannerIntentV2,
  validateReviewedPlaceDataPackV2,
} from "@serendipity/contracts/planner-v2";

export type ComposeEveningPlanV2Input = Readonly<{
  intent: PlannerIntentV2;
  dataPack: PlaceDataPackV2;
  reviewedClaims: unknown;
  asOf?: Date;
}>;

export type ComposeEveningPlanV2Result =
  | Readonly<{ ok: true; plan: EveningPlanV2; warnings: readonly string[] }>
  | Readonly<{ ok: false; code: "NO_VALID_PLAN" | "STALE_DATA_PACK" }>;

export type SwapEveningPlanStopV2Input = ComposeEveningPlanV2Input &
  Readonly<{
    plan: EveningPlanV2;
    stopIndex: number;
    preference: SwapPreferenceV2;
  }>;

export type SwapEveningPlanStopV2Result =
  | Readonly<{ ok: true; plan: EveningPlanV2; warnings: readonly string[] }>
  | Readonly<{
      ok: false;
      code: "NO_REPLACEMENT" | "STALE_DATA_PACK" | "STALE_PLAN";
    }>;

export type ActivePlanningDataPackValidationV2 =
  | Readonly<{ ok: true; dataPack: PlaceDataPackV2 }>
  | Readonly<{
      ok: false;
      reason: "INVALID_DATA_PACK" | "INACTIVE_DATA_PACK" | "EXPIRED_DATA_PACK";
      issues: readonly string[];
    }>;

type Coordinates = Readonly<{ latitude: number; longitude: number }>;
type RoutablePlannerPlace = PlannerPlaceV2 &
  Readonly<{ coordinates: Coordinates }>;
type TravelEstimate = Readonly<{ distanceMeters: number; minutes: number }>;
type OperatingInterval = Readonly<{
  opensAt: number;
  closesAt: number;
  label: string;
}>;
type PlanningContext = Readonly<{
  intentStartMs: number;
  intentEndMs: number;
  windowMinutes: number;
  freshnessByPlaceId: ReadonlyMap<
    string,
    Readonly<{ eligible: boolean; warnings: readonly string[] }>
  >;
  intervalsByPlaceId: ReadonlyMap<string, readonly OperatingInterval[]>;
  travelByEdge: ReadonlyMap<string, TravelEstimate>;
}>;
type ScheduledStop = Readonly<{
  place: PlannerPlaceV2;
  startsAtMs: number;
  endsAtMs: number;
  openingLabel: string;
  travel: TravelEstimate;
  travelOriginLabel: string;
}>;
type RawPlan = Readonly<{
  stops: readonly ScheduledStop[];
  minPriceYen: number;
  maxPriceYen: number;
  totalWalkMinutes: number;
  score: number;
  scoreBreakdown: EveningPlanV2["scoreBreakdown"];
  reasonCodes: EveningPlanV2["reasonCodes"];
  identity: string;
}>;

const DISCLAIMER =
  "Built from published information, not live availability. Check each official site before you go." as const;
const MINUTE = 60_000;
const DAY = 86_400_000;
const MAX_WAIT_MINUTES = 30;
const CLOSING_HEADROOM_MINUTES = 10;
const WALKING_ROUTE_FACTOR = 1.25;
const WALKING_METERS_PER_MINUTE = 75;
const packValidationCache = new WeakMap<
  object,
  {
    readonly serialized: string;
    readonly validation: ReturnType<typeof validateReviewedPlaceDataPackV2>;
  }
>();

const validatePackCached = (
  dataPack: unknown,
  reviewedClaims: unknown,
): ReturnType<typeof validateReviewedPlaceDataPackV2> => {
  if (dataPack === null || typeof dataPack !== "object") {
    return validateReviewedPlaceDataPackV2(dataPack, reviewedClaims);
  }
  let serialized: string;
  try {
    serialized = JSON.stringify([dataPack, reviewedClaims]);
  } catch {
    return validateReviewedPlaceDataPackV2(dataPack, reviewedClaims);
  }
  const cached = packValidationCache.get(dataPack);
  if (cached?.serialized === serialized) return cached.validation;
  const validation = validateReviewedPlaceDataPackV2(dataPack, reviewedClaims);
  packValidationCache.set(dataPack, { serialized, validation });
  return validation;
};

/**
 * Engine boundary guard. Direct callers cannot bypass schema/semantic pack
 * validation, ACTIVE promotion, or the audited as-of horizon.
 */
export const validateActivePlanningDataPackV2 = (
  dataPack: unknown,
  reviewedClaims: unknown,
  asOf: Date,
  intent?: PlannerIntentV2,
): ActivePlanningDataPackValidationV2 => {
  const validation = validatePackCached(dataPack, reviewedClaims);
  if (!validation.ok) {
    return {
      ok: false,
      reason: "INVALID_DATA_PACK",
      issues: validation.issues,
    };
  }
  if (validation.value.status !== "ACTIVE") {
    return {
      ok: false,
      reason: "INACTIVE_DATA_PACK",
      issues: ["/status must be ACTIVE for route planning"],
    };
  }
  const asOfTime = asOf.getTime();
  const generatedAt = Date.parse(validation.value.generatedAt);
  const validThrough = Date.parse(validation.value.validThrough);
  if (
    !Number.isFinite(asOfTime) ||
    !Number.isFinite(generatedAt) ||
    !Number.isFinite(validThrough) ||
    asOfTime < generatedAt ||
    asOfTime > validThrough ||
    (intent !== undefined && Date.parse(intent.endAt) > validThrough)
  ) {
    return {
      ok: false,
      reason: "EXPIRED_DATA_PACK",
      issues: [
        "/generatedAt and /validThrough must cover both asOf and the requested endAt",
      ],
    };
  }
  return { ok: true, dataPack: validation.value };
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const round = (value: number, places: number): number => {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
};

const canonicalJson = (value: unknown): string =>
  JSON.stringify(canonicalize(value));

const sha256 = async (value: unknown): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson(value)),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const normalizedIntent = (intent: PlannerIntentV2): PlannerIntentV2 => ({
  ...intent,
  preferredTags: [...intent.preferredTags].sort(),
  excludedTags: [...intent.excludedTags].sort(),
});

export const createCandidateSetIdV2 = async (
  intent: PlannerIntentV2,
  dataPack: PlaceDataPackV2,
): Promise<string> =>
  `candidates-${(
    await sha256({
      schemaVersion: "2",
      packVersion: dataPack.packVersion,
      intent: normalizedIntent(intent),
    })
  ).slice(0, 24)}`;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const estimateCoordinateTravelV2 = (
  from: Coordinates,
  to: Coordinates,
): TravelEstimate => {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const straightLineMeters =
    2 * 6_371_000 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  const distanceMeters = Math.round(straightLineMeters * WALKING_ROUTE_FACTOR);
  const unroundedMinutes = distanceMeters / WALKING_METERS_PER_MINUTE;
  return {
    distanceMeters,
    minutes: unroundedMinutes === 0 ? 0 : Math.ceil(unroundedMinutes / 5) * 5,
  };
};

const localDate = (timestamp: string): string => timestamp.slice(0, 10);
const localTimestamp = (date: string, time: string): number =>
  Date.parse(`${date}T${time}:00+09:00`);
const toJstTimestamp = (value: number): string => {
  const local = new Date(value + 9 * 60 * MINUTE).toISOString().slice(0, -1);
  return `${local}+09:00`;
};
const localWeekday = (date: string): number =>
  new Date(`${date}T12:00:00+09:00`).getUTCDay();

const operatingIntervals = (
  place: PlannerPlaceV2,
  date: string,
): readonly OperatingInterval[] => {
  if (place.hoursProvenance.kind !== "PUBLISHED_WINDOWS") return [];
  const exception = place.dateExceptions.find((item) => item.date === date);
  if (exception?.closed) return [];
  if (exception && !exception.closed) {
    return [
      {
        opensAt: localTimestamp(date, exception.opens),
        closesAt: localTimestamp(date, exception.closes),
        label: `${exception.opens}-${exception.closes} (${exception.note})`,
      },
    ];
  }
  const weekday = localWeekday(date);
  return place.weeklyHours
    .filter(({ days }) => days.includes(weekday))
    .map(({ opens, closes }) => ({
      opensAt: localTimestamp(date, opens),
      closesAt: localTimestamp(date, closes),
      label: `${opens}-${closes}`,
    }));
};

const schedulePlace = (
  place: PlannerPlaceV2,
  cursorMs: number,
  travel: TravelEstimate,
  intervals: readonly OperatingInterval[],
  intentEndMs: number,
  originLabel: string,
): ScheduledStop | null => {
  const arrivalMs = cursorMs + travel.minutes * MINUTE;
  for (const interval of intervals) {
    const startsAtMs = Math.max(arrivalMs, interval.opensAt);
    const waitMinutes = (startsAtMs - arrivalMs) / MINUTE;
    const endsAtMs = startsAtMs + place.recommendedVisitMinutes * MINUTE;
    if (
      waitMinutes <= MAX_WAIT_MINUTES &&
      endsAtMs <= interval.closesAt - CLOSING_HEADROOM_MINUTES * MINUTE &&
      endsAtMs <= intentEndMs
    ) {
      return {
        place,
        startsAtMs,
        endsAtMs,
        openingLabel: interval.label,
        travel,
        travelOriginLabel: originLabel,
      };
    }
  }
  return null;
};

const sourceAgeDays = (checkedAt: string, asOf: Date): number =>
  Math.max(0, (asOf.getTime() - Date.parse(checkedAt)) / DAY);

const freshnessForPlace = (
  place: PlannerPlaceV2,
  asOf: Date,
  dataPack: PlaceDataPackV2,
): Readonly<{ eligible: boolean; warnings: readonly string[] }> => {
  const sourceById = new Map(
    dataPack.sources.map((source) => [source.sourceId, source]),
  );
  const ages = [
    sourceAgeDays(place.evidence.hours.checkedAt, asOf),
    sourceAgeDays(place.evidence.price.checkedAt, asOf),
    ...place.calendarSourceIds.flatMap((sourceId) => {
      const source = sourceById.get(sourceId);
      return source ? [sourceAgeDays(source.checkedAt, asOf)] : [];
    }),
  ];
  if (ages.some((age) => age > 60)) return { eligible: false, warnings: [] };
  return {
    eligible: true,
    warnings: ages.some((age) => age > 14)
      ? [`SOURCE_RECHECK_RECOMMENDED:${place.placeId}`]
      : [],
  };
};

const scoreRawPlan = (
  stops: readonly ScheduledStop[],
  intent: PlannerIntentV2,
  windowMinutes: number,
): Pick<RawPlan, "score" | "scoreBreakdown" | "reasonCodes"> => {
  const tags = new Set(stops.flatMap(({ place }) => place.tags));
  const preferenceFit =
    intent.preferredTags.length === 0
      ? 0.5
      : intent.preferredTags.filter((tag) => tags.has(tag)).length /
        intent.preferredTags.length;
  const totalWalkMinutes = stops.reduce(
    (total, { travel }) => total + travel.minutes,
    0,
  );
  const walkingEfficiency =
    1 -
    totalWalkMinutes / Math.max(1, intent.maxWalkMinutesPerLeg * stops.length);
  const visitMinutes = stops.reduce(
    (total, stop) => total + (stop.endsAtMs - stop.startsAtMs) / MINUTE,
    0,
  );
  const timeUtilization = visitMinutes / windowMinutes;
  const categoryDiversity =
    new Set(stops.map(({ place }) => place.category)).size / stops.length;
  const scoreBreakdown = {
    preferenceFit: round(clamp01(preferenceFit), 6),
    walkingEfficiency: round(clamp01(walkingEfficiency), 6),
    timeUtilization: round(clamp01(timeUtilization), 6),
    categoryDiversity: round(clamp01(categoryDiversity), 6),
  };
  const score = round(
    scoreBreakdown.preferenceFit * 40 +
      scoreBreakdown.walkingEfficiency * 25 +
      scoreBreakdown.timeUtilization * 20 +
      scoreBreakdown.categoryDiversity * 15,
    4,
  );
  const reasonCandidates: EveningPlanV2["reasonCodes"][number][] = [
    ...(scoreBreakdown.preferenceFit >= 0.5
      ? (["MATCHES_INTERESTS"] as const)
      : []),
    ...(scoreBreakdown.walkingEfficiency >= 0.5
      ? (["SHORT_WALKS"] as const)
      : []),
    ...(scoreBreakdown.timeUtilization >= 0.3
      ? (["USES_TIME_WELL"] as const)
      : []),
    ...(scoreBreakdown.categoryDiversity >= 2 / 3
      ? (["VARIED_STOPS"] as const)
      : []),
    "WITHIN_BUDGET",
  ];
  const reasonCodes: EveningPlanV2["reasonCodes"] = reasonCandidates.slice(
    0,
    4,
  );
  return { score, scoreBreakdown, reasonCodes };
};

const scheduleRoute = (
  places: readonly PlannerPlaceV2[],
  intent: PlannerIntentV2,
  dataPack: PlaceDataPackV2,
  context: PlanningContext,
): RawPlan | null => {
  // `places` comes from eligiblePlacesForIntent, which has already applied
  // every per-place route, provenance, tag, exclusion, coordinate, freshness,
  // and opening-window guard. Keep only route-level constraints here: this
  // function runs for every permutation (up to 24,360 at 30 places).
  const exerciseStopCount = places.filter(({ category }) =>
    ["fitness", "pool"].includes(category),
  ).length;
  if (
    exerciseStopCount > 1 ||
    new Set(places.map(({ category }) => category)).size < 2
  ) {
    return null;
  }
  const maxPriceYen = places.reduce(
    (total, { price }) => total + price.maxYen,
    0,
  );
  if (maxPriceYen > intent.totalBudgetYen) return null;

  const stops: ScheduledStop[] = [];
  let cursorMs = context.intentStartMs;
  let previousNodeId = "shibuya-station";
  let originLabel: string = dataPack.station.name;
  for (const place of places) {
    const travel = context.travelByEdge.get(
      `${previousNodeId}->${place.placeId}`,
    );
    if (!travel) return null;
    if (travel.minutes > intent.maxWalkMinutesPerLeg) return null;
    const stop = schedulePlace(
      place,
      cursorMs,
      travel,
      context.intervalsByPlaceId.get(place.placeId) ?? [],
      context.intentEndMs,
      originLabel,
    );
    if (!stop) return null;
    stops.push(stop);
    cursorMs = stop.endsAtMs;
    previousNodeId = place.placeId;
    originLabel = place.name;
  }
  const minPriceYen = places.reduce(
    (total, { price }) => total + price.minYen,
    0,
  );
  const totalWalkMinutes = stops.reduce(
    (total, { travel }) => total + travel.minutes,
    0,
  );
  const score = scoreRawPlan(stops, intent, context.windowMinutes);
  return {
    stops,
    minPriceYen,
    maxPriceYen,
    totalWalkMinutes,
    ...score,
    identity: JSON.stringify(
      stops.map(({ place, startsAtMs, endsAtMs }) => [
        place.placeId,
        toJstTimestamp(startsAtMs),
        toJstTimestamp(endsAtMs),
      ]),
    ),
  };
};

const createPlanningContext = (
  intent: PlannerIntentV2,
  dataPack: PlaceDataPackV2,
  asOf: Date,
): PlanningContext => {
  const date = localDate(intent.startAt);
  const freshnessByPlaceId = new Map(
    dataPack.places.map((place) => [
      place.placeId,
      freshnessForPlace(place, asOf, dataPack),
    ]),
  );
  const intervalsByPlaceId = new Map(
    dataPack.places.map((place) => [
      place.placeId,
      operatingIntervals(place, date),
    ]),
  );
  const travelByEdge = new Map<string, TravelEstimate>();
  const routablePlaces = dataPack.places.filter(
    (place): place is RoutablePlannerPlace =>
      place.routeEligibility.kind === "ROUTABLE" && place.coordinates !== null,
  );
  for (const to of routablePlaces) {
    travelByEdge.set(
      `shibuya-station->${to.placeId}`,
      estimateCoordinateTravelV2(dataPack.station.coordinates, to.coordinates),
    );
    for (const from of routablePlaces) {
      if (from.placeId === to.placeId) continue;
      travelByEdge.set(
        `${from.placeId}->${to.placeId}`,
        estimateCoordinateTravelV2(from.coordinates, to.coordinates),
      );
    }
  }
  const intentStartMs = Date.parse(intent.startAt);
  const intentEndMs = Date.parse(intent.endAt);
  return {
    intentStartMs,
    intentEndMs,
    windowMinutes: (intentEndMs - intentStartMs) / MINUTE,
    freshnessByPlaceId,
    intervalsByPlaceId,
    travelByEdge,
  };
};

const compareRawPlans = (left: RawPlan, right: RawPlan): number =>
  right.score - left.score ||
  left.totalWalkMinutes - right.totalWalkMinutes ||
  left.maxPriceYen - right.maxPriceYen ||
  (left.stops.at(-1)?.endsAtMs ?? 0) - (right.stops.at(-1)?.endsAtMs ?? 0) ||
  left.identity.localeCompare(right.identity);

const eligiblePlacesForIntent = (
  intent: PlannerIntentV2,
  dataPack: PlaceDataPackV2,
  context: PlanningContext,
): RoutablePlannerPlace[] =>
  dataPack.places.filter(
    (place): place is RoutablePlannerPlace =>
      place.routeEligibility.kind === "ROUTABLE" &&
      place.priceProvenance.kind === "PUBLISHED_AMOUNT" &&
      place.coordinates !== null &&
      place.price.maxYen <= intent.totalBudgetYen &&
      !place.tags.some((tag) => intent.excludedTags.includes(tag)) &&
      (intent.preferredTags.length === 0 ||
        place.tags.some((tag) => intent.preferredTags.includes(tag))) &&
      context.freshnessByPlaceId.get(place.placeId)?.eligible === true &&
      (context.intervalsByPlaceId.get(place.placeId)?.length ?? 0) > 0,
  );

const generateRawPlans = (
  intent: PlannerIntentV2,
  dataPack: PlaceDataPackV2,
  count: number,
  asOf: Date,
): RawPlan[] => {
  const context = createPlanningContext(intent, dataPack, asOf);
  const plans: RawPlan[] = [];
  const places = eligiblePlacesForIntent(intent, dataPack, context);
  for (let firstIndex = 0; firstIndex < places.length; firstIndex += 1) {
    const first = places[firstIndex];
    if (!first) continue;
    for (let secondIndex = 0; secondIndex < places.length; secondIndex += 1) {
      if (secondIndex === firstIndex) continue;
      const second = places[secondIndex];
      if (!second) continue;
      if (count === 2) {
        const plan = scheduleRoute([first, second], intent, dataPack, context);
        if (plan) plans.push(plan);
        continue;
      }
      for (let thirdIndex = 0; thirdIndex < places.length; thirdIndex += 1) {
        if (thirdIndex === firstIndex || thirdIndex === secondIndex) continue;
        const third = places[thirdIndex];
        if (!third) continue;
        const plan = scheduleRoute(
          [first, second, third],
          intent,
          dataPack,
          context,
        );
        if (plan) plans.push(plan);
      }
    }
  }
  return plans.sort(compareRawPlans);
};

const findBestRawPlan = (
  intent: PlannerIntentV2,
  dataPack: PlaceDataPackV2,
  count: number,
  asOf: Date,
): RawPlan | null => {
  const context = createPlanningContext(intent, dataPack, asOf);
  let winner: RawPlan | null = null;
  const consider = (places: readonly PlannerPlaceV2[]): void => {
    const plan = scheduleRoute(places, intent, dataPack, context);
    if (plan && (!winner || compareRawPlans(plan, winner) < 0)) {
      winner = plan;
    }
  };
  const places = eligiblePlacesForIntent(intent, dataPack, context);
  for (let firstIndex = 0; firstIndex < places.length; firstIndex += 1) {
    const first = places[firstIndex];
    if (!first) continue;
    for (let secondIndex = 0; secondIndex < places.length; secondIndex += 1) {
      if (secondIndex === firstIndex) continue;
      const second = places[secondIndex];
      if (!second) continue;
      if (count === 2) {
        consider([first, second]);
        continue;
      }
      for (let thirdIndex = 0; thirdIndex < places.length; thirdIndex += 1) {
        if (thirdIndex === firstIndex || thirdIndex === secondIndex) continue;
        const third = places[thirdIndex];
        if (third) consider([first, second, third]);
      }
    }
  }
  return winner;
};

const planIdFor = async (
  raw: RawPlan,
  intent: PlannerIntentV2,
  dataPack: PlaceDataPackV2,
): Promise<string> =>
  `plan-${(
    await sha256({
      schemaVersion: "2",
      packVersion: dataPack.packVersion,
      intent: normalizedIntent(intent),
      stops: JSON.parse(raw.identity) as unknown,
    })
  ).slice(0, 24)}`;

const materializePlan = async (
  raw: RawPlan,
  intent: PlannerIntentV2,
  dataPack: PlaceDataPackV2,
  candidateSetId: string,
): Promise<EveningPlanV2> => {
  const sourceById = new Map(
    dataPack.sources.map((source) => [source.sourceId, source]),
  );
  const stops: EveningPlanStopV2[] = raw.stops.map((stop, position) => {
    const source = sourceById.get(stop.place.evidence.identity.sourceId);
    const matchedTags = intent.preferredTags.filter((tag) =>
      stop.place.tags.includes(tag),
    );
    return {
      position,
      place: {
        placeId: stop.place.placeId,
        name: stop.place.name,
        summary: stop.place.summary,
        category: stop.place.category,
        address: stop.place.address,
        tags: stop.place.tags,
        officialUrl: stop.place.officialUrl,
      },
      startsAt: toJstTimestamp(stop.startsAtMs),
      endsAt: toJstTimestamp(stop.endsAtMs),
      price: stop.place.price,
      priceProvenance: stop.place.priceProvenance,
      travelFromPreviousMinutes: stop.travel.minutes,
      travelFromPreviousDistanceMeters: stop.travel.distanceMeters,
      travelOriginLabel: stop.travelOriginLabel,
      travelMethod: "COORDINATE_ESTIMATE",
      travelLabel: `Estimated ${stop.travel.minutes} min / ${stop.travel.distanceMeters} m from coordinates`,
      openingFit: `Scheduled within published ${stop.openingLabel} hours with ${CLOSING_HEADROOM_MINUTES} minutes before closing.`,
      whyThisStop:
        matchedTags.length > 0
          ? `Matches ${matchedTags.join(", ")} within your time, walking, and budget limits.`
          : `Adds a ${stop.place.category} stop within your time, walking, and budget limits.`,
      sourcePublisher: source?.publisher ?? "Published source",
      sourceCheckedAt:
        [
          stop.place.evidence.hours.checkedAt,
          stop.place.evidence.price.checkedAt,
        ].sort()[1] ?? stop.place.evidence.hours.checkedAt,
    };
  });
  const first = stops[0];
  const last = stops.at(-1);
  if (!first || !last) throw new Error("Cannot materialize an empty plan");
  return {
    schemaVersion: "2",
    planId: await planIdFor(raw, intent, dataPack),
    candidateSetId,
    packVersion: dataPack.packVersion,
    intent,
    stops,
    totals: {
      minPriceYen: raw.minPriceYen,
      maxPriceYen: raw.maxPriceYen,
      totalWalkMinutes: raw.totalWalkMinutes,
      stopCount: stops.length,
      startsAt: first.startsAt,
      endsAt: last.endsAt,
    },
    score: raw.score,
    scoreBreakdown: raw.scoreBreakdown,
    reasonCodes: raw.reasonCodes,
    travelMethod: "COORDINATE_ESTIMATE",
    disclaimer: DISCLAIMER,
  };
};

const warningsFor = (
  raw: RawPlan,
  asOf: Date,
  dataPack: PlaceDataPackV2,
): readonly string[] => [
  ...new Set(
    raw.stops.flatMap(
      ({ place }) => freshnessForPlace(place, asOf, dataPack).warnings,
    ),
  ),
];

export const composeEveningPlan = async ({
  intent,
  dataPack,
  reviewedClaims,
  asOf = new Date(),
}: ComposeEveningPlanV2Input): Promise<ComposeEveningPlanV2Result> => {
  if (!validatePlannerIntentV2(intent, { now: asOf }).ok) {
    return { ok: false, code: "NO_VALID_PLAN" };
  }
  if (
    !validateActivePlanningDataPackV2(dataPack, reviewedClaims, asOf, intent).ok
  ) {
    return { ok: false, code: "STALE_DATA_PACK" };
  }
  const winner =
    findBestRawPlan(intent, dataPack, 3, asOf) ??
    findBestRawPlan(intent, dataPack, 2, asOf);
  if (!winner) return { ok: false, code: "NO_VALID_PLAN" };
  const candidateSetId = await createCandidateSetIdV2(intent, dataPack);
  return {
    ok: true,
    plan: await materializePlan(winner, intent, dataPack, candidateSetId),
    warnings: warningsFor(winner, asOf, dataPack),
  };
};

const rawIdentityFromPlan = (plan: EveningPlanV2): string =>
  canonicalJson(
    plan.stops.map(({ place, startsAt, endsAt }) => [
      place.placeId,
      startsAt,
      endsAt,
    ]),
  );

const differentInterestGain = (
  candidate: RawPlan,
  current: RawPlan,
  stopIndex: number,
  intent: PlannerIntentV2,
): number => {
  const next = candidate.stops[stopIndex]?.place;
  const previous = current.stops[stopIndex]?.place;
  if (!next || !previous) return 0;
  const previousTags = new Set(previous.tags);
  const preferredGain = intent.preferredTags.filter(
    (tag) => next.tags.includes(tag) && !previousTags.has(tag),
  ).length;
  if (preferredGain > 0) return preferredGain + 10;
  const generalGain = next.tags.filter((tag) => !previousTags.has(tag)).length;
  return generalGain + (next.category === previous.category ? 0 : 1);
};

export const swapEveningPlanStop = async ({
  intent,
  dataPack,
  reviewedClaims,
  plan,
  stopIndex,
  preference,
  asOf = new Date(),
}: SwapEveningPlanStopV2Input): Promise<SwapEveningPlanStopV2Result> => {
  if (!validatePlannerIntentV2(intent, { now: asOf }).ok) {
    return { ok: false, code: "STALE_PLAN" };
  }
  if (
    !validateActivePlanningDataPackV2(dataPack, reviewedClaims, asOf, intent).ok
  ) {
    return { ok: false, code: "STALE_DATA_PACK" };
  }
  if (plan.packVersion !== dataPack.packVersion) {
    return { ok: false, code: "STALE_DATA_PACK" };
  }
  const candidateSetId = await createCandidateSetIdV2(intent, dataPack);
  if (
    plan.candidateSetId !== candidateSetId ||
    canonicalJson(plan.intent) !== canonicalJson(intent) ||
    stopIndex < 0 ||
    stopIndex >= plan.stops.length
  ) {
    return { ok: false, code: "STALE_PLAN" };
  }

  const candidates = generateRawPlans(
    intent,
    dataPack,
    plan.stops.length,
    asOf,
  );
  const currentIdentity = rawIdentityFromPlan(plan);
  const current = candidates.find(
    ({ identity }) => identity === currentIdentity,
  );
  if (!current) return { ok: false, code: "STALE_PLAN" };
  const reconstructed = await materializePlan(
    current,
    intent,
    dataPack,
    candidateSetId,
  );
  if (canonicalJson(reconstructed) !== canonicalJson(plan)) {
    return { ok: false, code: "STALE_PLAN" };
  }

  const previousPlace = current.stops[stopIndex]?.place;
  if (!previousPlace) return { ok: false, code: "STALE_PLAN" };
  const replacements = candidates.filter((candidate) => {
    const replacement = candidate.stops[stopIndex]?.place;
    if (!replacement || replacement.placeId === previousPlace.placeId) {
      return false;
    }
    if (
      candidate.stops.some(
        ({ place }, index) =>
          index !== stopIndex &&
          place.placeId !== current.stops[index]?.place.placeId,
      )
    ) {
      return false;
    }
    if (preference === "CHEAPER") {
      return replacement.price.maxYen < previousPlace.price.maxYen;
    }
    if (preference === "LESS_WALKING") {
      return candidate.totalWalkMinutes < current.totalWalkMinutes;
    }
    return differentInterestGain(candidate, current, stopIndex, intent) > 0;
  });
  replacements.sort((left, right) => {
    if (preference === "CHEAPER") {
      return (
        (left.stops[stopIndex]?.place.price.maxYen ?? Infinity) -
          (right.stops[stopIndex]?.place.price.maxYen ?? Infinity) ||
        compareRawPlans(left, right)
      );
    }
    if (preference === "LESS_WALKING") {
      return (
        left.totalWalkMinutes - right.totalWalkMinutes ||
        compareRawPlans(left, right)
      );
    }
    return (
      differentInterestGain(right, current, stopIndex, intent) -
        differentInterestGain(left, current, stopIndex, intent) ||
      compareRawPlans(left, right)
    );
  });
  const replacement = replacements[0];
  if (!replacement) return { ok: false, code: "NO_REPLACEMENT" };
  return {
    ok: true,
    plan: await materializePlan(replacement, intent, dataPack, candidateSetId),
    warnings: warningsFor(replacement, asOf, dataPack),
  };
};

export const composeEveningPlanV2 = composeEveningPlan;
export const swapEveningPlanStopV2 = swapEveningPlanStop;
