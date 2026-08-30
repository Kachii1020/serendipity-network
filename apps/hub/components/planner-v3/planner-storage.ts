import {
  validateEveningPlanV3,
  validatePlannerIntentV3,
  type EveningPlanV3,
  type PlaceEvidenceV3,
  type PlannerIntentV3,
} from "@serendipity/contracts/planner-v3";
import { assertPublicPayloadSafe } from "@serendipity/contracts/public-safety";

export const SAVED_PLAN_STORAGE_KEY_V3 = "serendipity.saved-itineraries.v3";
const MAX_RECORDS = 10;
const MAX_BYTES = 256 * 1024;

export type SavedPlanRecordV3 = Readonly<{
  evidenceByPlace: Readonly<Record<string, PlaceEvidenceV3>>;
  intent: PlannerIntentV3;
  itinerary: EveningPlanV3;
  savedAt: string;
  savedPlanId: string;
  schemaVersion: "3";
}>;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const strictTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
    value,
  ) &&
  Number.isFinite(Date.parse(value));

const exact = (value: Record<string, unknown>, keys: readonly string[]) => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
};

const text = (value: unknown, maximum: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= maximum;

const httpsUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const containsRawMarkup = (value: unknown): boolean => {
  if (typeof value === "string") return /<\/?[a-z][^>]*>/i.test(value);
  if (Array.isArray(value)) return value.some(containsRawMarkup);
  if (!record(value)) return false;
  return Object.values(value).some(containsRawMarkup);
};

const containsGoogleContent = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(containsGoogleContent);
  if (!record(value)) return false;
  return Object.entries(value).some(
    ([key, child]) =>
      [
        "attributions",
        "businessStatus",
        "currentOpeningHours",
        "googleMapsUri",
        "openForRequestedWindow",
        "priceLevel",
        "priceRange",
      ].includes(key) || containsGoogleContent(child),
  );
};

const factScopes = new Set([
  "IDENTITY",
  "ADDRESS",
  "COORDINATES",
  "HOURS",
  "PRICE",
  "PUBLIC_ACCESS",
  "MENU",
]);

const validUsage = (value: unknown): boolean => {
  if (!record(value) || typeof value.mode !== "string") return false;
  if (value.mode === "OFFICIAL_LINK_ONLY") {
    return exact(value, ["mode"]);
  }
  if (value.mode === "OPEN_LICENSE") {
    return (
      exact(value, ["mode", "licenseId", "licenseUrl", "attribution"]) &&
      text(value.licenseId, 120) &&
      httpsUrl(value.licenseUrl) &&
      text(value.attribution, 240)
    );
  }
  return (
    value.mode === "OFFICIAL_FACT_REFERENCE" &&
    exact(value, ["mode", "factScope", "attribution"]) &&
    Array.isArray(value.factScope) &&
    value.factScope.length > 0 &&
    value.factScope.every((scope) => factScopes.has(String(scope))) &&
    text(value.attribution, 240)
  );
};

const validSource = (value: unknown): boolean => {
  if (!record(value)) return false;
  const allowed = [
    "sourceId",
    "title",
    "publisher",
    "sourceKind",
    "url",
    "checkedAt",
    "usage",
    ...(value.publishedAt === undefined ? [] : ["publishedAt"]),
    ...(value.notes === undefined ? [] : ["notes"]),
  ];
  return (
    exact(value, allowed) &&
    text(value.sourceId, 128) &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value.sourceId) &&
    text(value.title, 160) &&
    text(value.publisher, 120) &&
    [
      "OPEN_DATASET",
      "OFFICIAL_SITE",
      "OFFICIAL_MENU",
      "LICENSE_TERMS",
    ].includes(String(value.sourceKind)) &&
    httpsUrl(value.url) &&
    strictTimestamp(value.checkedAt) &&
    (value.publishedAt === undefined || strictTimestamp(value.publishedAt)) &&
    (value.notes === undefined || text(value.notes, 500)) &&
    validUsage(value.usage)
  );
};

const claimKinds = {
  identity: "IDENTITY",
  address: "ADDRESS",
  coordinates: "COORDINATES",
  hours: "HOURS",
  price: "PRICE",
  publicAccess: "PUBLIC_ACCESS",
  officialLink: "OFFICIAL_LINK",
  menu: "MENU",
} as const;

const validClaim = (value: unknown, kind: string): boolean =>
  record(value) &&
  exact(value, [
    "kind",
    "value",
    "publisher",
    "sourceTitle",
    "sourceUrl",
    "checkedAt",
  ]) &&
  value.kind === kind &&
  text(value.value, 500) &&
  text(value.publisher, 120) &&
  text(value.sourceTitle, 160) &&
  httpsUrl(value.sourceUrl) &&
  strictTimestamp(value.checkedAt);

const validEvidenceRecord = (
  value: unknown,
  plan: EveningPlanV3,
  placeId: string,
): value is PlaceEvidenceV3 => {
  const stop = plan.stops.find(({ place }) => place.placeId === placeId);
  if (
    !stop ||
    !record(value) ||
    !exact(value, [
      "schemaVersion",
      "packVersion",
      "area",
      "placeId",
      "placeName",
      "officialUrl",
      "evidenceAsOf",
      "claims",
      "sources",
    ]) ||
    value.schemaVersion !== "3" ||
    value.packVersion !== plan.packVersion ||
    value.area !== plan.intent.area ||
    value.placeId !== placeId ||
    value.placeName !== stop.place.name ||
    value.officialUrl !== stop.place.officialUrl ||
    !httpsUrl(value.officialUrl) ||
    !strictTimestamp(value.evidenceAsOf) ||
    !record(value.claims) ||
    !exact(value.claims, Object.keys(claimKinds)) ||
    !Array.isArray(value.sources) ||
    value.sources.length < 1 ||
    value.sources.length > 100 ||
    !value.sources.every(validSource) ||
    containsGoogleContent(value)
  ) {
    return false;
  }

  const sources = value.sources as Array<Record<string, unknown>>;
  const sourceKeys = new Set(
    sources.map(
      (source) =>
        `${String(source.url)}\u0000${String(source.publisher)}\u0000${String(source.title)}\u0000${String(source.checkedAt)}`,
    ),
  );
  if (sourceKeys.size !== sources.length) return false;

  const usedSourceKeys = new Set<string>();
  const claims = value.claims;
  const claimsValid = Object.entries(claimKinds).every(([key, kind]) => {
    const claim = claims[key];
    if (key === "menu" && claim === null) return stop.place.role === "ACTIVITY";
    if (!validClaim(claim, kind) || !record(claim)) return false;
    const sourceKey = `${String(claim.sourceUrl)}\u0000${String(claim.publisher)}\u0000${String(claim.sourceTitle)}\u0000${String(claim.checkedAt)}`;
    usedSourceKeys.add(sourceKey);
    return sourceKeys.has(sourceKey);
  });
  return (
    claimsValid &&
    (stop.place.role !== "MEAL" || claims.menu !== null) &&
    record(claims.identity) &&
    claims.identity.value === stop.place.name &&
    record(claims.address) &&
    claims.address.value === stop.place.address &&
    record(claims.officialLink) &&
    claims.officialLink.value === stop.place.officialUrl &&
    [...sourceKeys].every((key) => usedSourceKeys.has(key))
  );
};

const validEvidence = (
  value: unknown,
  plan: EveningPlanV3,
): value is Readonly<Record<string, PlaceEvidenceV3>> => {
  if (!record(value) || containsGoogleContent(value)) return false;
  const placeIds = plan.stops.map(({ place }) => place.placeId);
  return (
    Object.keys(value).length === placeIds.length &&
    placeIds.every((placeId) =>
      validEvidenceRecord(value[placeId], plan, placeId),
    )
  );
};

const sanitize = (value: unknown): SavedPlanRecordV3 | null => {
  if (
    !record(value) ||
    !exact(value, [
      "schemaVersion",
      "evidenceByPlace",
      "intent",
      "itinerary",
      "savedAt",
      "savedPlanId",
    ]) ||
    value.schemaVersion !== "3" ||
    typeof value.savedPlanId !== "string" ||
    !strictTimestamp(value.savedAt) ||
    !validatePlannerIntentV3(value.intent).ok ||
    !validateEveningPlanV3(value.itinerary).ok
  ) {
    return null;
  }
  const itinerary = value.itinerary as EveningPlanV3;
  if (
    value.savedPlanId !== itinerary.planId ||
    JSON.stringify(value.intent) !== JSON.stringify(itinerary.intent) ||
    !validEvidence(value.evidenceByPlace, itinerary) ||
    !assertPublicPayloadSafe(value).ok ||
    containsGoogleContent(value) ||
    containsRawMarkup(value)
  ) {
    return null;
  }
  return JSON.parse(JSON.stringify(value)) as SavedPlanRecordV3;
};

export const loadSavedPlansV3 = (
  storage: StorageLike,
): { corrupt: boolean; records: readonly SavedPlanRecordV3[] } => {
  let raw: string | null;
  try {
    raw = storage.getItem(SAVED_PLAN_STORAGE_KEY_V3);
  } catch {
    return { corrupt: true, records: [] };
  }
  if (!raw) return { corrupt: false, records: [] };
  if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) {
    return { corrupt: true, records: [] };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !record(parsed) ||
      parsed.schemaVersion !== "3" ||
      !Array.isArray(parsed.records)
    ) {
      return { corrupt: true, records: [] };
    }
    const records = parsed.records.flatMap((item) => {
      const valid = sanitize(item);
      return valid ? [valid] : [];
    });
    return {
      corrupt: records.length !== parsed.records.length,
      records: records.slice(0, MAX_RECORDS),
    };
  } catch {
    return { corrupt: true, records: [] };
  }
};

const persist = (
  storage: StorageLike,
  records: readonly SavedPlanRecordV3[],
):
  | { ok: true }
  | { ok: false; code: "STORAGE_LIMIT_REACHED" | "STORAGE_UNAVAILABLE" } => {
  const serialized = JSON.stringify({ schemaVersion: "3", records });
  if (new TextEncoder().encode(serialized).byteLength > MAX_BYTES) {
    return { ok: false, code: "STORAGE_LIMIT_REACHED" };
  }
  try {
    storage.setItem(SAVED_PLAN_STORAGE_KEY_V3, serialized);
    return { ok: true };
  } catch {
    return { ok: false, code: "STORAGE_UNAVAILABLE" };
  }
};

export const savePlanSnapshotV3 = (
  storage: StorageLike,
  candidate: SavedPlanRecordV3,
) => {
  const valid = sanitize(candidate);
  if (!valid) return { ok: false as const, code: "STORAGE_CORRUPT" as const };
  const loaded = loadSavedPlansV3(storage);
  const existing = loaded.records.find(
    ({ savedPlanId }) => savedPlanId === candidate.savedPlanId,
  );
  if (existing) {
    return {
      ok: true as const,
      records: loaded.records,
      savedPlanId: existing.savedPlanId,
      status: "ALREADY_SAVED" as const,
    };
  }
  if (loaded.records.length >= MAX_RECORDS) {
    return { ok: false as const, code: "STORAGE_LIMIT_REACHED" as const };
  }
  const records = [valid, ...loaded.records];
  const written = persist(storage, records);
  return written.ok
    ? {
        ok: true as const,
        records,
        savedPlanId: valid.savedPlanId,
        status: "SAVED" as const,
      }
    : { ok: false as const, code: written.code };
};

export const deletePlanSnapshotV3 = (
  storage: StorageLike,
  savedPlanId: string,
) => {
  const loaded = loadSavedPlansV3(storage);
  const records = loaded.records.filter(
    (record) => record.savedPlanId !== savedPlanId,
  );
  const written = persist(storage, records);
  return written.ok
    ? {
        deleted: records.length !== loaded.records.length,
        ok: true as const,
        records,
        savedPlanId,
      }
    : { ok: false as const, code: written.code };
};
