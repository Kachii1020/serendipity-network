import type {
  EveningPlanV2,
  PlaceEvidenceV2,
  PlannerIntentV2,
} from "@serendipity/contracts/planner-v2";
import {
  PLACE_CATEGORIES_V2,
  PLANNER_SCHEMA_VERSION,
  PLANNER_TAGS,
  isStrictTimestampV2,
  validatePlannerIntentV2Client,
} from "@serendipity/contracts/planner-v2-shared";
import { assertPublicPayloadSafe } from "@serendipity/contracts/public-safety";

export const SAVED_PLAN_STORAGE_KEY = "serendipity.saved-itineraries.v2";
export const SAVED_PLAN_LIMIT = 10;
export const SAVED_PLAN_STORAGE_LIMIT_BYTES = 256 * 1024;

export type SavedPlanRecordV2 = {
  readonly evidence: Readonly<Record<string, PlaceEvidenceV2>>;
  readonly intent: PlannerIntentV2;
  readonly itinerary: EveningPlanV2;
  readonly savedAt: string;
  readonly savedPlanId: string;
};

type SavedPlanDocumentV2 = {
  readonly records: readonly SavedPlanRecordV2[];
  readonly schemaVersion: "2";
};

export type SavedPlanLoadResult = {
  readonly corrupt: boolean;
  readonly records: readonly SavedPlanRecordV2[];
};

export type SavedPlanMutationResult =
  | {
      readonly ok: true;
      readonly status: "ALREADY_SAVED" | "DELETED" | "NOT_FOUND" | "SAVED";
      readonly records: readonly SavedPlanRecordV2[];
      readonly savedPlanId: string;
    }
  | {
      readonly ok: false;
      readonly code:
        "STORAGE_CORRUPT" | "STORAGE_LIMIT_REACHED" | "STORAGE_UNAVAILABLE";
      readonly message: string;
    };

type ParsedStorage = SavedPlanLoadResult & { readonly readable: boolean };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const exactKeys = (
  value: Record<string, unknown>,
  required: readonly string[],
): boolean =>
  Object.keys(value).length === required.length &&
  required.every((key) => key in value);

const allowedKeys = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean => {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => key in value) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
};

const validText = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= maxLength;

const validId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 128 &&
  /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);

const validTimestamp = (value: unknown): value is string =>
  isStrictTimestampV2(value);

const validHttpsUrl = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === ""
    );
  } catch {
    return false;
  }
};

const hasRawMarkup = (value: unknown): boolean => {
  if (typeof value === "string") return /<\/?[A-Za-z][^>]*>/.test(value);
  if (Array.isArray(value)) return value.some(hasRawMarkup);
  return isRecord(value) && Object.values(value).some(hasRawMarkup);
};

const validPrice = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["kind", "minYen", "maxYen", "label"]) ||
    !["FREE", "EXACT", "RANGE"].includes(String(value.kind)) ||
    !Number.isInteger(value.minYen) ||
    !Number.isInteger(value.maxYen) ||
    (value.minYen as number) < 0 ||
    (value.maxYen as number) > 100_000 ||
    (value.minYen as number) > (value.maxYen as number) ||
    !validText(value.label, 160)
  ) {
    return false;
  }
  return value.kind === "FREE"
    ? value.minYen === 0 && value.maxYen === 0
    : value.kind === "EXACT"
      ? value.minYen === value.maxYen
      : value.minYen !== value.maxYen;
};

const validPriceProvenance = (value: unknown): boolean =>
  isRecord(value) &&
  exactKeys(value, ["kind", "sourceSummary"]) &&
  ["PUBLISHED_AMOUNT", "PLANNER_ZERO_NO_MANDATORY_PRICE_PUBLISHED"].includes(
    String(value.kind),
  ) &&
  validText(value.sourceSummary, 240);

const validCompactPlace = (value: unknown): boolean =>
  isRecord(value) &&
  exactKeys(value, [
    "placeId",
    "name",
    "summary",
    "category",
    "address",
    "tags",
    "officialUrl",
  ]) &&
  validId(value.placeId) &&
  validText(value.name, 120) &&
  validText(value.summary, 320) &&
  PLACE_CATEGORIES_V2.some((category) => category === value.category) &&
  validText(value.address, 240) &&
  Array.isArray(value.tags) &&
  value.tags.length <= 5 &&
  new Set(value.tags).size === value.tags.length &&
  value.tags.every(
    (tag) =>
      typeof tag === "string" &&
      PLANNER_TAGS.some((candidate) => candidate === tag),
  ) &&
  validHttpsUrl(value.officialUrl);

const validStop = (value: unknown): boolean =>
  isRecord(value) &&
  exactKeys(value, [
    "position",
    "place",
    "startsAt",
    "endsAt",
    "price",
    "priceProvenance",
    "travelFromPreviousMinutes",
    "travelFromPreviousDistanceMeters",
    "travelOriginLabel",
    "travelMethod",
    "travelLabel",
    "openingFit",
    "whyThisStop",
    "sourcePublisher",
    "sourceCheckedAt",
  ]) &&
  Number.isInteger(value.position) &&
  (value.position as number) >= 0 &&
  (value.position as number) <= 2 &&
  validCompactPlace(value.place) &&
  validTimestamp(value.startsAt) &&
  validTimestamp(value.endsAt) &&
  Date.parse(value.endsAt) > Date.parse(value.startsAt) &&
  validPrice(value.price) &&
  validPriceProvenance(value.priceProvenance) &&
  Number.isInteger(value.travelFromPreviousMinutes) &&
  (value.travelFromPreviousMinutes as number) >= 0 &&
  (value.travelFromPreviousMinutes as number) <= 30 &&
  Number.isInteger(value.travelFromPreviousDistanceMeters) &&
  (value.travelFromPreviousDistanceMeters as number) >= 0 &&
  (value.travelFromPreviousDistanceMeters as number) <= 5_000 &&
  validText(value.travelOriginLabel, 120) &&
  value.travelMethod === "COORDINATE_ESTIMATE" &&
  validText(value.travelLabel, 200) &&
  validText(value.openingFit, 240) &&
  validText(value.whyThisStop, 240) &&
  validText(value.sourcePublisher, 120) &&
  validTimestamp(value.sourceCheckedAt);

const validIntentSnapshot = (value: unknown): value is PlannerIntentV2 => {
  if (!isRecord(value) || !validTimestamp(value.startAt)) return false;
  return validatePlannerIntentV2Client(
    value,
    new Date(Date.parse(value.startAt)),
  ).ok;
};

const sameIntent = (left: PlannerIntentV2, right: PlannerIntentV2): boolean =>
  left.schemaVersion === right.schemaVersion &&
  left.area === right.area &&
  left.partySize === right.partySize &&
  left.startAt === right.startAt &&
  left.endAt === right.endAt &&
  left.totalBudgetYen === right.totalBudgetYen &&
  left.stopCount === right.stopCount &&
  left.maxWalkMinutesPerLeg === right.maxWalkMinutesPerLeg &&
  left.preferredTags.length === right.preferredTags.length &&
  left.preferredTags.every(
    (tag, index) => right.preferredTags[index] === tag,
  ) &&
  left.excludedTags.length === right.excludedTags.length &&
  left.excludedTags.every((tag, index) => right.excludedTags[index] === tag);

const validPlan = (value: unknown): value is EveningPlanV2 => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "schemaVersion",
      "planId",
      "candidateSetId",
      "packVersion",
      "intent",
      "stops",
      "totals",
      "score",
      "scoreBreakdown",
      "reasonCodes",
      "travelMethod",
      "disclaimer",
    ]) ||
    value.schemaVersion !== PLANNER_SCHEMA_VERSION ||
    !validId(value.planId) ||
    !validId(value.candidateSetId) ||
    typeof value.packVersion !== "string" ||
    !/^[1-9]\d*\.\d+\.\d+$/.test(value.packVersion) ||
    !validIntentSnapshot(value.intent) ||
    !Array.isArray(value.stops) ||
    value.stops.length < 2 ||
    value.stops.length > 3 ||
    !value.stops.every(validStop) ||
    !isRecord(value.totals) ||
    !exactKeys(value.totals, [
      "minPriceYen",
      "maxPriceYen",
      "totalWalkMinutes",
      "stopCount",
      "startsAt",
      "endsAt",
    ]) ||
    !Number.isInteger(value.totals.minPriceYen) ||
    !Number.isInteger(value.totals.maxPriceYen) ||
    (value.totals.minPriceYen as number) < 0 ||
    (value.totals.minPriceYen as number) >
      (value.totals.maxPriceYen as number) ||
    (value.totals.maxPriceYen as number) > 300_000 ||
    !Number.isInteger(value.totals.totalWalkMinutes) ||
    (value.totals.totalWalkMinutes as number) < 0 ||
    (value.totals.totalWalkMinutes as number) > 90 ||
    value.totals.stopCount !== value.stops.length ||
    !validTimestamp(value.totals.startsAt) ||
    !validTimestamp(value.totals.endsAt) ||
    !Number.isFinite(value.score) ||
    (value.score as number) < 0 ||
    (value.score as number) > 100 ||
    !isRecord(value.scoreBreakdown) ||
    !exactKeys(value.scoreBreakdown, [
      "preferenceFit",
      "walkingEfficiency",
      "timeUtilization",
      "categoryDiversity",
    ]) ||
    !Object.values(value.scoreBreakdown).every(
      (score) =>
        typeof score === "number" &&
        Number.isFinite(score) &&
        score >= 0 &&
        score <= 1,
    ) ||
    !Array.isArray(value.reasonCodes) ||
    value.reasonCodes.length < 1 ||
    value.reasonCodes.length > 4 ||
    new Set(value.reasonCodes).size !== value.reasonCodes.length ||
    !value.reasonCodes.every((reason) =>
      [
        "MATCHES_INTERESTS",
        "SHORT_WALKS",
        "USES_TIME_WELL",
        "VARIED_STOPS",
        "WITHIN_BUDGET",
      ].includes(String(reason)),
    ) ||
    value.travelMethod !== "COORDINATE_ESTIMATE" ||
    value.disclaimer !==
      "Built from published information, not live availability. Check each official site before you go."
  ) {
    return false;
  }
  const stops = value.stops as unknown as Record<string, unknown>[];
  const placeIds = stops.map((stop) =>
    isRecord(stop.place) ? stop.place.placeId : undefined,
  );
  const priceTotals = stops.reduce<{ max: number; min: number; walk: number }>(
    (totals, stop) => {
      if (isRecord(stop.price)) {
        totals.min += Number(stop.price.minYen);
        totals.max += Number(stop.price.maxYen);
      }
      totals.walk += Number(stop.travelFromPreviousMinutes);
      return totals;
    },
    { max: 0, min: 0, walk: 0 },
  );
  return (
    stops.every((stop, index) => stop.position === index) &&
    stops.every(
      (stop, index) =>
        index === 0 ||
        Date.parse(String(stop.startsAt)) >=
          Date.parse(String(stops[index - 1]?.endsAt)),
    ) &&
    new Set(placeIds).size === stops.length &&
    value.totals.startsAt === stops[0]?.startsAt &&
    value.totals.endsAt === stops.at(-1)?.endsAt &&
    value.totals.minPriceYen === priceTotals.min &&
    value.totals.maxPriceYen === priceTotals.max &&
    value.totals.totalWalkMinutes === priceTotals.walk
  );
};

const validSourceUsage = (value: unknown): boolean => {
  if (!isRecord(value) || typeof value.mode !== "string") return false;
  if (value.mode === "OPEN_LICENSE") {
    return (
      exactKeys(value, ["mode", "licenseId", "licenseUrl", "attribution"]) &&
      validText(value.licenseId, 80) &&
      validHttpsUrl(value.licenseUrl) &&
      validText(value.attribution, 300)
    );
  }
  if (value.mode === "EXPLICIT_PERMISSION") {
    return (
      exactKeys(value, ["mode", "permissionEvidencePath", "attribution"]) &&
      typeof value.permissionEvidencePath === "string" &&
      /^specs\/002-source-backed-evening-planner\/evidence\/permissions\/[^/]+$/.test(
        value.permissionEvidencePath,
      ) &&
      validText(value.attribution, 300)
    );
  }
  if (value.mode === "OFFICIAL_FACT_REFERENCE") {
    return (
      exactKeys(value, ["mode", "factScope", "attribution"]) &&
      Array.isArray(value.factScope) &&
      value.factScope.length >= 1 &&
      value.factScope.length <= 6 &&
      new Set(value.factScope).size === value.factScope.length &&
      value.factScope.every((scope) =>
        [
          "IDENTITY",
          "ADDRESS",
          "COORDINATES",
          "HOURS",
          "PRICE",
          "PUBLIC_ACCESS",
        ].includes(String(scope)),
      ) &&
      validText(value.attribution, 300)
    );
  }
  return value.mode === "OFFICIAL_LINK_ONLY" && exactKeys(value, ["mode"]);
};

const validSource = (value: unknown): boolean =>
  isRecord(value) &&
  allowedKeys(
    value,
    [
      "sourceId",
      "title",
      "publisher",
      "sourceKind",
      "url",
      "checkedAt",
      "usage",
    ],
    ["publishedAt", "notes"],
  ) &&
  validId(value.sourceId) &&
  validText(value.title, 160) &&
  validText(value.publisher, 120) &&
  ["OPEN_DATASET", "OFFICIAL_SITE", "LICENSE_TERMS"].includes(
    String(value.sourceKind),
  ) &&
  validHttpsUrl(value.url) &&
  validTimestamp(value.checkedAt) &&
  (value.publishedAt === undefined || validTimestamp(value.publishedAt)) &&
  (value.notes === undefined || validText(value.notes, 500)) &&
  validSourceUsage(value.usage);

const claimKinds = {
  address: "ADDRESS",
  coordinates: "COORDINATES",
  hours: "HOURS",
  identity: "IDENTITY",
  officialLink: "OFFICIAL_LINK",
  price: "PRICE",
  publicAccess: "PUBLIC_ACCESS",
} as const;

const validClaim = (value: unknown, expectedKind: string): boolean =>
  isRecord(value) &&
  exactKeys(value, [
    "kind",
    "value",
    "publisher",
    "sourceTitle",
    "sourceUrl",
    "checkedAt",
  ]) &&
  value.kind === expectedKind &&
  validText(value.value, 500) &&
  validText(value.publisher, 120) &&
  validText(value.sourceTitle, 160) &&
  validHttpsUrl(value.sourceUrl) &&
  validTimestamp(value.checkedAt);

const validEvidence = (value: unknown): value is PlaceEvidenceV2 => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "schemaVersion",
      "packVersion",
      "placeId",
      "placeName",
      "officialUrl",
      "evidenceAsOf",
      "claims",
      "sources",
    ]) ||
    value.schemaVersion !== PLANNER_SCHEMA_VERSION ||
    typeof value.packVersion !== "string" ||
    !/^[1-9]\d*\.\d+\.\d+$/.test(value.packVersion) ||
    !validId(value.placeId) ||
    !validText(value.placeName, 120) ||
    !validHttpsUrl(value.officialUrl) ||
    !validTimestamp(value.evidenceAsOf) ||
    !isRecord(value.claims) ||
    !exactKeys(value.claims, Object.keys(claimKinds)) ||
    !Array.isArray(value.sources) ||
    value.sources.length < 1 ||
    value.sources.length > 100 ||
    !value.sources.every(validSource)
  ) {
    return false;
  }
  const claims = value.claims;
  const sourceKeys = new Set(
    value.sources.map((source) =>
      isRecord(source)
        ? `${String(source.url)}\u0000${String(source.publisher)}\u0000${String(source.title)}\u0000${String(source.checkedAt)}`
        : "",
    ),
  );
  return Object.entries(claimKinds).every(([key, kind]) => {
    const claim = claims[key];
    if (key === "coordinates" && claim === null) return true;
    return (
      validClaim(claim, kind) &&
      isRecord(claim) &&
      sourceKeys.has(
        `${String(claim.sourceUrl)}\u0000${String(claim.publisher)}\u0000${String(claim.sourceTitle)}\u0000${String(claim.checkedAt)}`,
      )
    );
  });
};

const sanitizeSavedRecord = (value: unknown): SavedPlanRecordV2 | null => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "evidence",
      "intent",
      "itinerary",
      "savedAt",
      "savedPlanId",
    ]) ||
    assertPublicPayloadSafe(value).ok === false ||
    hasRawMarkup(value) ||
    !validId(value.savedPlanId) ||
    !validTimestamp(value.savedAt) ||
    !validIntentSnapshot(value.intent) ||
    !validPlan(value.itinerary) ||
    value.savedPlanId !== value.itinerary.planId ||
    !sameIntent(value.intent, value.itinerary.intent) ||
    !isRecord(value.evidence)
  ) {
    return null;
  }
  const itinerary = value.itinerary;
  const evidenceByPlace = value.evidence;
  const stopByPlaceId = new Map(
    itinerary.stops.map((stop) => [stop.place.placeId, stop.place]),
  );
  if (
    Object.keys(evidenceByPlace).length !== stopByPlaceId.size ||
    ![...stopByPlaceId].every(([placeId, place]) => {
      const evidence = evidenceByPlace[placeId];
      return (
        validEvidence(evidence) &&
        evidence.placeId === placeId &&
        evidence.placeName === place.name &&
        evidence.officialUrl === place.officialUrl &&
        evidence.packVersion === itinerary.packVersion
      );
    })
  ) {
    return null;
  }
  return JSON.parse(JSON.stringify(value)) as SavedPlanRecordV2;
};

const readStorage = (storage: Pick<Storage, "getItem">): ParsedStorage => {
  let raw: string | null;
  try {
    raw = storage.getItem(SAVED_PLAN_STORAGE_KEY);
  } catch {
    return { corrupt: true, readable: false, records: [] };
  }
  if (raw === null) return { corrupt: false, readable: true, records: [] };
  if (
    new TextEncoder().encode(raw).byteLength > SAVED_PLAN_STORAGE_LIMIT_BYTES
  ) {
    return { corrupt: true, readable: false, records: [] };
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      !exactKeys(value, ["records", "schemaVersion"]) ||
      value.schemaVersion !== PLANNER_SCHEMA_VERSION ||
      !Array.isArray(value.records)
    ) {
      return { corrupt: true, readable: false, records: [] };
    }
    const records: SavedPlanRecordV2[] = [];
    const seen = new Set<string>();
    let corrupt = value.records.length > SAVED_PLAN_LIMIT;
    for (const candidate of value.records) {
      const record = sanitizeSavedRecord(candidate);
      if (!record || seen.has(record.savedPlanId)) {
        corrupt = true;
        continue;
      }
      seen.add(record.savedPlanId);
      if (records.length < SAVED_PLAN_LIMIT) records.push(record);
    }
    return { corrupt, readable: true, records };
  } catch {
    return { corrupt: true, readable: false, records: [] };
  }
};

export const loadSavedPlans = (
  storage: Pick<Storage, "getItem">,
): SavedPlanLoadResult => {
  const { corrupt, records } = readStorage(storage);
  return { corrupt, records };
};

const persist = (
  storage: Pick<Storage, "setItem">,
  records: readonly SavedPlanRecordV2[],
): SavedPlanMutationResult | undefined => {
  const document: SavedPlanDocumentV2 = { records, schemaVersion: "2" };
  const serialized = JSON.stringify(document);
  if (
    new TextEncoder().encode(serialized).byteLength >
    SAVED_PLAN_STORAGE_LIMIT_BYTES
  ) {
    return {
      ok: false,
      code: "STORAGE_LIMIT_REACHED",
      message: "Saved plans have reached the 256 KiB safety limit.",
    };
  }
  try {
    storage.setItem(SAVED_PLAN_STORAGE_KEY, serialized);
  } catch {
    return {
      ok: false,
      code: "STORAGE_UNAVAILABLE",
      message: "This browser could not store the plan.",
    };
  }
  return undefined;
};

const corruptStorage = (): SavedPlanMutationResult => ({
  ok: false,
  code: "STORAGE_CORRUPT",
  message:
    "Some saved-plan data is invalid. Existing browser data was left unchanged.",
});

export const savePlanSnapshot = (
  storage: Pick<Storage, "getItem" | "setItem">,
  candidate: SavedPlanRecordV2,
): SavedPlanMutationResult => {
  const record = sanitizeSavedRecord(candidate);
  if (!record) return corruptStorage();
  const loaded = readStorage(storage);
  if (!loaded.readable) return corruptStorage();
  const existing = loaded.records.find(
    ({ savedPlanId }) => savedPlanId === record.savedPlanId,
  );
  if (existing) {
    if (loaded.corrupt) {
      const failure = persist(storage, loaded.records);
      if (failure) return failure;
    }
    return {
      ok: true,
      records: loaded.records,
      savedPlanId: existing.savedPlanId,
      status: "ALREADY_SAVED",
    };
  }
  if (loaded.records.length >= SAVED_PLAN_LIMIT) {
    return {
      ok: false,
      code: "STORAGE_LIMIT_REACHED",
      message: "Delete a saved plan before saving another one.",
    };
  }
  const records = [record, ...loaded.records];
  const failure = persist(storage, records);
  return (
    failure ?? {
      ok: true,
      records,
      savedPlanId: record.savedPlanId,
      status: "SAVED",
    }
  );
};

export const deletePlanSnapshot = (
  storage: Pick<Storage, "getItem" | "setItem">,
  savedPlanId: string,
): SavedPlanMutationResult => {
  if (!validId(savedPlanId)) return corruptStorage();
  const loaded = readStorage(storage);
  if (!loaded.readable) return corruptStorage();
  const records = loaded.records.filter(
    (record) => record.savedPlanId !== savedPlanId,
  );
  if (records.length === loaded.records.length) {
    if (loaded.corrupt) {
      const failure = persist(storage, loaded.records);
      if (failure) return failure;
    }
    return {
      ok: true,
      records,
      savedPlanId,
      status: "NOT_FOUND",
    };
  }
  const failure = persist(storage, records);
  return (
    failure ?? {
      ok: true,
      records,
      savedPlanId,
      status: "DELETED",
    }
  );
};
