import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packArgument = process.argv
  .slice(2)
  .find((value) => !value.startsWith("--"));
const packPath = packArgument
  ? resolve(process.cwd(), packArgument)
  : resolve(repositoryRoot, "apps/hub/data/shibuya.places.v2.json");
const reviewedClaimsPath = resolve(
  repositoryRoot,
  "apps/hub/data/shibuya-v2.reviewed-claims.json",
);
const errors = [];

const fail = (path, message) => errors.push(`${path}: ${message}`);
const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isCalendarDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
  );
};
const isTimestamp = (value) => {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(
      value,
    );
  return Boolean(
    match && isCalendarDate(match[1]) && Number.isFinite(Date.parse(value)),
  );
};
const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
};
const canonicalJson = (value) => JSON.stringify(canonicalize(value));
const timeToMinutes = (value) => {
  const [hours = Number.NaN, minutes = Number.NaN] = String(value)
    .split(":")
    .map(Number);
  return hours * 60 + minutes;
};

const httpsUrl = (value, path) => {
  if (typeof value !== "string") {
    fail(path, "must be an HTTPS URL");
    return null;
  }
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.username !== "" ||
      parsed.password !== ""
    ) {
      fail(path, "must use HTTPS without embedded credentials");
      return null;
    }
    return parsed;
  } catch {
    fail(path, "must be a valid HTTPS URL");
    return null;
  }
};

const rejectUnknown = (value, path = "$") => {
  if (typeof value === "string" && /\bunknown\b/i.test(value)) {
    fail(path, 'must not contain the placeholder value "UNKNOWN"');
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => rejectUnknown(child, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (/\bunknown\b/i.test(key)) {
      fail(`${path}.${key}`, 'must not use an "UNKNOWN" field');
    }
    rejectUnknown(child, `${path}.${key}`);
  }
};

const rejectAuthorityClaims = (value, path = "$") => {
  if (Array.isArray(value)) {
    value.forEach((child, index) =>
      rejectAuthorityClaims(child, `${path}[${index}]`),
    );
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (
      /^(?:capacity|inventory|hold|reservation|discount|liveAvailability)$/i.test(
        key,
      )
    ) {
      fail(`${path}.${key}`, "is an unsupported authority or live-state claim");
    }
    rejectAuthorityClaims(child, `${path}.${key}`);
  }
};

if (!existsSync(packPath)) {
  console.error(
    `v2 source audit failed: required pack is absent at ${packPath}`,
  );
  process.exit(1);
}

let pack;
try {
  pack = JSON.parse(readFileSync(packPath, "utf8"));
} catch (error) {
  console.error(
    `v2 source audit failed: pack is not valid JSON (${error instanceof Error ? error.message : "parse error"})`,
  );
  process.exit(1);
}

if (!isRecord(pack)) {
  console.error("v2 source audit failed: pack root must be an object");
  process.exit(1);
}

let reviewedClaimLedger;
try {
  reviewedClaimLedger = JSON.parse(readFileSync(reviewedClaimsPath, "utf8"));
} catch (error) {
  console.error(
    `v2 source audit failed: reviewed claims are unavailable (${error instanceof Error ? error.message : "parse error"})`,
  );
  process.exit(1);
}

rejectUnknown(pack);
rejectAuthorityClaims(pack);
if (pack.schemaVersion !== "2") fail("$.schemaVersion", 'must equal "2"');
if (pack.status !== "ACTIVE") {
  fail("$.status", "standalone release audit requires ACTIVE");
}
if (!isTimestamp(pack.generatedAt)) {
  fail("$.generatedAt", "must be an ISO timestamp");
}
if (!isTimestamp(pack.validThrough)) {
  fail("$.validThrough", "must be an ISO timestamp");
} else if (isTimestamp(pack.generatedAt)) {
  const validityDays =
    (Date.parse(`${pack.validThrough.slice(0, 10)}T00:00:00+09:00`) -
      Date.parse(`${pack.generatedAt.slice(0, 10)}T00:00:00+09:00`)) /
    86_400_000;
  if (
    !pack.generatedAt.endsWith("+09:00") ||
    !pack.validThrough.endsWith("+09:00") ||
    Date.parse(pack.validThrough) <= Date.parse(pack.generatedAt) ||
    validityDays < 0 ||
    validityDays > 60
  ) {
    fail(
      "$.validThrough",
      "must follow generatedAt and end within sixty Tokyo calendar days",
    );
  }
}
if ("travelEdges" in pack) {
  fail(
    "$.travelEdges",
    "must not contain precomputed travel; v2 derives labelled estimates from evidenced coordinates",
  );
}

if (!isRecord(pack.dataLicense)) {
  fail("$.dataLicense", "must declare the distributed database license");
} else {
  httpsUrl(pack.dataLicense.licenseUrl, "$.dataLicense.licenseUrl");
  if (
    typeof pack.dataLicense.licenseId !== "string" ||
    pack.dataLicense.licenseId.length === 0
  ) {
    fail("$.dataLicense.licenseId", "must be non-empty");
  }
  if (
    typeof pack.dataLicense.attribution !== "string" ||
    pack.dataLicense.attribution.length === 0
  ) {
    fail("$.dataLicense.attribution", "must be non-empty");
  }
}

const sources = Array.isArray(pack.sources) ? pack.sources : [];
if (sources.length === 0) fail("$.sources", "must contain at least one source");
const sourceById = new Map();
const usedSourceIds = new Set();
let includesOdbl = false;

for (const [index, source] of sources.entries()) {
  const path = `$.sources[${index}]`;
  if (!isRecord(source)) {
    fail(path, "must be an object");
    continue;
  }
  if (typeof source.sourceId !== "string" || source.sourceId.length === 0) {
    fail(`${path}.sourceId`, "must be non-empty");
    continue;
  }
  if (sourceById.has(source.sourceId)) {
    fail(`${path}.sourceId`, "must be unique");
    continue;
  }
  sourceById.set(source.sourceId, source);
  if (
    !new Set(["OPEN_DATASET", "OFFICIAL_SITE", "LICENSE_TERMS"]).has(
      source.sourceKind,
    )
  ) {
    fail(
      `${path}.sourceKind`,
      "must be OPEN_DATASET, OFFICIAL_SITE, or LICENSE_TERMS",
    );
  }
  httpsUrl(source.url, `${path}.url`);
  if (!isTimestamp(source.checkedAt)) {
    fail(`${path}.checkedAt`, "must be an ISO timestamp");
  } else if (
    isTimestamp(pack.generatedAt) &&
    Date.parse(source.checkedAt) > Date.parse(pack.generatedAt)
  ) {
    fail(`${path}.checkedAt`, "must not follow pack.generatedAt");
  } else if (
    pack.status === "ACTIVE" &&
    isTimestamp(pack.generatedAt) &&
    (Date.parse(pack.generatedAt) - Date.parse(source.checkedAt)) / 86_400_000 >
      7
  ) {
    fail(
      `${path}.checkedAt`,
      "must be within seven days of generatedAt for an ACTIVE pack",
    );
  }
  if (source.publishedAt !== undefined && !isTimestamp(source.publishedAt)) {
    fail(`${path}.publishedAt`, "must be a real ISO calendar timestamp");
  }
  if (!isRecord(source.usage)) {
    fail(`${path}.usage`, "must declare a usage basis");
    continue;
  }

  if (source.usage.mode === "OPEN_LICENSE") {
    if (
      typeof source.usage.licenseId !== "string" ||
      source.usage.licenseId.length === 0
    ) {
      fail(`${path}.usage.licenseId`, "must be non-empty");
    }
    httpsUrl(source.usage.licenseUrl, `${path}.usage.licenseUrl`);
    if (
      typeof source.usage.attribution !== "string" ||
      source.usage.attribution.length === 0
    ) {
      fail(`${path}.usage.attribution`, "must be non-empty");
    }
    includesOdbl ||= source.usage.licenseId === "ODbL-1.0";
  } else if (source.usage.mode === "EXPLICIT_PERMISSION") {
    const evidencePath = source.usage.permissionEvidencePath;
    const expectedPrefix =
      "specs/002-source-backed-evening-planner/evidence/permissions/";
    const evidenceName =
      typeof evidencePath === "string"
        ? evidencePath.slice(expectedPrefix.length)
        : "";
    if (
      typeof evidencePath !== "string" ||
      !evidencePath.startsWith(expectedPrefix) ||
      evidenceName.includes("/") ||
      evidenceName.includes("..") ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]*\.md$/.test(evidenceName)
    ) {
      fail(
        `${path}.usage.permissionEvidencePath`,
        "must be one repository-relative file in the v2 permissions directory",
      );
    } else if (!existsSync(resolve(repositoryRoot, evidencePath))) {
      fail(`${path}.usage.permissionEvidencePath`, "must exist");
    }
    if (
      typeof source.usage.attribution !== "string" ||
      source.usage.attribution.length === 0
    ) {
      fail(`${path}.usage.attribution`, "must be non-empty");
    }
  } else if (source.usage.mode === "OFFICIAL_FACT_REFERENCE") {
    const allowedFacts = new Set([
      "IDENTITY",
      "ADDRESS",
      "COORDINATES",
      "HOURS",
      "PRICE",
      "PUBLIC_ACCESS",
    ]);
    if (source.sourceKind !== "OFFICIAL_SITE") {
      fail(
        `${path}.sourceKind`,
        "OFFICIAL_FACT_REFERENCE requires OFFICIAL_SITE",
      );
    }
    if (
      !Array.isArray(source.usage.factScope) ||
      source.usage.factScope.length === 0 ||
      source.usage.factScope.some((fact) => !allowedFacts.has(fact))
    ) {
      fail(
        `${path}.usage.factScope`,
        "must declare supported official fact fields",
      );
    }
    if (
      typeof source.usage.attribution !== "string" ||
      source.usage.attribution.length === 0
    ) {
      fail(`${path}.usage.attribution`, "must be non-empty");
    }
  } else if (source.usage.mode !== "OFFICIAL_LINK_ONLY") {
    fail(
      `${path}.usage.mode`,
      "must be OPEN_LICENSE, EXPLICIT_PERMISSION, OFFICIAL_FACT_REFERENCE, or OFFICIAL_LINK_ONLY",
    );
  }
}

const openLicenseIds = new Set(
  sources
    .filter(({ usage }) => usage?.mode === "OPEN_LICENSE")
    .map(({ usage }) => usage.licenseId),
);
const requiresMixedLicense =
  openLicenseIds.size > 1 ||
  sources.some(({ usage }) =>
    ["EXPLICIT_PERMISSION", "OFFICIAL_FACT_REFERENCE"].includes(usage?.mode),
  );
if (
  requiresMixedLicense &&
  pack.dataLicense?.licenseId !== "MIXED-SEE-SOURCES"
) {
  fail(
    "$.dataLicense.licenseId",
    "must be MIXED-SEE-SOURCES when source-specific rights bases differ",
  );
}

if (
  includesOdbl &&
  (!isRecord(pack.dataLicense) || pack.dataLicense.licenseId !== "ODbL-1.0")
) {
  fail(
    "$.dataLicense.licenseId",
    "must be ODbL-1.0 when the pack contains ODbL-derived data",
  );
}

const resolveStationSources = (sourceIds, path) => {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    fail(path, "must contain at least one source ID");
    return;
  }
  if (new Set(sourceIds).size !== sourceIds.length) {
    fail(path, "must not contain duplicate source IDs");
  }
  for (const [index, sourceId] of sourceIds.entries()) {
    const source = sourceById.get(sourceId);
    if (!source) {
      fail(`${path}[${index}]`, "must reference a declared source");
      continue;
    }
    usedSourceIds.add(sourceId);
    if (source.usage?.mode === "OFFICIAL_LINK_ONLY") {
      fail(
        `${path}[${index}]`,
        "factual claims may not use OFFICIAL_LINK_ONLY sources",
      );
    } else if (
      source.usage?.mode === "OFFICIAL_FACT_REFERENCE" &&
      !source.usage.factScope?.includes("COORDINATES")
    ) {
      fail(`${path}[${index}]`, "station source must authorize COORDINATES");
    }
  }
};

const resolveCalendarSources = (sourceIds, path) => {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    fail(path, "must contain at least one official calendar source ID");
    return;
  }
  if (new Set(sourceIds).size !== sourceIds.length) {
    fail(path, "must not contain duplicate source IDs");
  }
  for (const [index, sourceId] of sourceIds.entries()) {
    const source = sourceById.get(sourceId);
    if (!source) {
      fail(`${path}[${index}]`, "must reference a declared source");
      continue;
    }
    usedSourceIds.add(sourceId);
    if (
      source.sourceKind !== "OFFICIAL_SITE" ||
      source.usage?.mode !== "OFFICIAL_FACT_REFERENCE" ||
      !source.usage.factScope?.includes("HOURS")
    ) {
      fail(
        `${path}[${index}]`,
        "must reference an official source authorized for HOURS",
      );
    }
    if (
      isTimestamp(source.checkedAt) &&
      Date.parse(pack.validThrough) - Date.parse(source.checkedAt) >
        60 * 86_400_000
    ) {
      fail(`${path}[${index}]`, "becomes hard-stale before validThrough");
    }
  }
};

const resolveEvidence = (
  reference,
  path,
  allowOfficialLink = false,
  factScope,
) => {
  if (!isRecord(reference)) {
    fail(path, "must be a sourceId/checkedAt evidence reference");
    return null;
  }
  if (!isTimestamp(reference.checkedAt)) {
    fail(`${path}.checkedAt`, "must be an ISO timestamp");
  } else if (
    isTimestamp(pack.generatedAt) &&
    Date.parse(reference.checkedAt) > Date.parse(pack.generatedAt)
  ) {
    fail(`${path}.checkedAt`, "must not follow pack.generatedAt");
  }
  const source = sourceById.get(reference.sourceId);
  if (!source) {
    fail(`${path}.sourceId`, "must reference a declared source");
    return null;
  }
  usedSourceIds.add(reference.sourceId);
  if (!allowOfficialLink && source.usage?.mode === "OFFICIAL_LINK_ONLY") {
    fail(path, "factual claims may not use OFFICIAL_LINK_ONLY sources");
  } else if (
    factScope === "PUBLIC_ACCESS" &&
    (source.sourceKind !== "OFFICIAL_SITE" ||
      source.usage?.mode !== "OFFICIAL_FACT_REFERENCE" ||
      !source.usage.factScope?.includes("PUBLIC_ACCESS"))
  ) {
    fail(
      path,
      "public access requires an official source with PUBLIC_ACCESS scope",
    );
  } else if (
    factScope &&
    source.usage?.mode === "OFFICIAL_FACT_REFERENCE" &&
    !source.usage.factScope?.includes(factScope)
  ) {
    fail(path, `official source does not authorize ${factScope}`);
  }
  if (
    isTimestamp(reference.checkedAt) &&
    isTimestamp(source.checkedAt) &&
    reference.checkedAt !== source.checkedAt
  ) {
    fail(`${path}.checkedAt`, "must equal the referenced source checkedAt");
  }
  return source;
};

if (!isRecord(pack.station)) {
  fail("$.station", "must describe the Shibuya Station anchor");
} else {
  resolveStationSources(pack.station.sourceIds, "$.station.sourceIds");
  if (!isRecord(pack.station.coordinates)) {
    fail("$.station.coordinates", "must contain latitude and longitude");
  }
}
resolveCalendarSources(pack.calendarSourceIds, "$.calendarSourceIds");

const places = Array.isArray(pack.places) ? pack.places : [];
if (places.length === 0) fail("$.places", "must contain at least one place");
if (pack.status === "ACTIVE" && places.length < 9) {
  fail("$.places", "an ACTIVE pack must contain at least nine places");
}
const placeIds = new Set();
const categories = new Set();
const usedCalendarSourceIds = new Set();
let routablePlaceCount = 0;

for (const [index, place] of places.entries()) {
  const path = `$.places[${index}]`;
  if (!isRecord(place)) {
    fail(path, "must be an object");
    continue;
  }
  if (typeof place.placeId !== "string" || place.placeId.length === 0) {
    fail(`${path}.placeId`, "must be non-empty");
  } else if (placeIds.has(place.placeId)) {
    fail(`${path}.placeId`, "must be unique");
  } else {
    placeIds.add(place.placeId);
  }
  categories.add(place.category);
  if (!Array.isArray(place.calendarSourceIds)) {
    fail(`${path}.calendarSourceIds`, "must be an array");
  } else {
    for (const [calendarIndex, sourceId] of place.calendarSourceIds.entries()) {
      const calendarPath = `${path}.calendarSourceIds[${calendarIndex}]`;
      const source = sourceById.get(sourceId);
      usedCalendarSourceIds.add(sourceId);
      if (!source) {
        fail(calendarPath, "must reference a declared source");
        continue;
      }
      usedSourceIds.add(sourceId);
      if (
        source.sourceKind !== "OFFICIAL_SITE" ||
        source.usage?.mode !== "OFFICIAL_FACT_REFERENCE" ||
        !source.usage.factScope?.includes("HOURS")
      ) {
        fail(calendarPath, "must reference an official HOURS source");
      }
      if (
        isTimestamp(source.checkedAt) &&
        Date.parse(pack.validThrough) - Date.parse(source.checkedAt) >
          60 * 86_400_000
      ) {
        fail(calendarPath, "becomes hard-stale before validThrough");
      }
    }
  }
  if (!isRecord(place.routeEligibility)) {
    fail(`${path}.routeEligibility`, "must declare route eligibility");
  } else if (place.routeEligibility.kind === "ROUTABLE") {
    routablePlaceCount += 1;
  } else if (place.routeEligibility.kind === "REFERENCE_ONLY") {
    if (
      !Array.isArray(place.routeEligibility.reasons) ||
      place.routeEligibility.reasons.length === 0 ||
      typeof place.routeEligibility.note !== "string" ||
      place.routeEligibility.note.length === 0
    ) {
      fail(
        `${path}.routeEligibility`,
        "REFERENCE_ONLY requires reasons and an explanatory note",
      );
    }
  } else {
    fail(`${path}.routeEligibility.kind`, "must be ROUTABLE or REFERENCE_ONLY");
  }
  const officialUrl = httpsUrl(place.officialUrl, `${path}.officialUrl`);
  if (place.coordinates !== null && !isRecord(place.coordinates)) {
    fail(
      `${path}.coordinates`,
      "must be null or contain latitude and longitude",
    );
  } else if (
    (isRecord(place.coordinates) &&
      !Number.isFinite(place.coordinates.latitude)) ||
    (isRecord(place.coordinates) &&
      !Number.isFinite(place.coordinates.longitude))
  ) {
    fail(`${path}.coordinates`, "must contain finite numbers");
  }

  if (!isRecord(place.price)) {
    fail(
      `${path}.price`,
      "must contain source-backed FREE, EXACT, or RANGE data",
    );
  } else {
    if (!new Set(["FREE", "EXACT", "RANGE"]).has(place.price.kind)) {
      fail(`${path}.price.kind`, "must be FREE, EXACT, or RANGE");
    }
    if (
      !Number.isInteger(place.price.minYen) ||
      !Number.isInteger(place.price.maxYen) ||
      place.price.minYen < 0 ||
      place.price.maxYen < place.price.minYen
    ) {
      fail(
        `${path}.price`,
        "must contain an ordered non-negative integer range",
      );
    }
    if (
      typeof place.price.label !== "string" ||
      place.price.label.length === 0
    ) {
      fail(`${path}.price.label`, "must be non-empty");
    }
    if (
      place.price.kind === "FREE" &&
      (place.price.minYen !== 0 || place.price.maxYen !== 0)
    ) {
      fail(`${path}.price`, "FREE must be 0..0");
    }
    if (
      place.price.kind === "EXACT" &&
      place.price.minYen !== place.price.maxYen
    ) {
      fail(`${path}.price`, "EXACT minYen and maxYen must be equal");
    }
    if (
      place.price.kind === "RANGE" &&
      place.price.minYen === place.price.maxYen
    ) {
      fail(`${path}.price`, "RANGE minYen and maxYen must differ");
    }
  }
  if (!isRecord(place.priceProvenance)) {
    fail(`${path}.priceProvenance`, "must declare how the price was sourced");
  } else if (place.priceProvenance.kind === "PUBLISHED_AMOUNT") {
    if (
      typeof place.priceProvenance.sourceSummary !== "string" ||
      place.priceProvenance.sourceSummary.length === 0
    ) {
      fail(
        `${path}.priceProvenance.sourceSummary`,
        "must describe the source-published amount",
      );
    }
  } else if (
    place.priceProvenance.kind === "PLANNER_ZERO_NO_MANDATORY_PRICE_PUBLISHED"
  ) {
    if (
      place.price?.kind !== "FREE" ||
      place.price?.minYen !== 0 ||
      place.price?.maxYen !== 0
    ) {
      fail(
        `${path}.priceProvenance`,
        "planner-zero provenance requires a zero reference",
      );
    }
    if (
      !/\b(?:no mandatory|does not publish a mandatory|no published admission)\b/i.test(
        place.priceProvenance.sourceSummary ?? "",
      )
    ) {
      fail(
        `${path}.priceProvenance.sourceSummary`,
        "must say that no mandatory admission amount is published",
      );
    }
    if (!/^¥0 planner reference\b/i.test(place.price?.label ?? "")) {
      fail(
        `${path}.price.label`,
        "planner-zero output must be labelled as a planner reference, never Free",
      );
    }
    if (
      place.routeEligibility?.kind !== "REFERENCE_ONLY" ||
      !place.routeEligibility.reasons?.includes("UNSOURCED_PRICE")
    ) {
      fail(
        `${path}.routeEligibility`,
        "planner-zero price provenance must be REFERENCE_ONLY with UNSOURCED_PRICE",
      );
    }
  } else {
    fail(
      `${path}.priceProvenance.kind`,
      "must be PUBLISHED_AMOUNT or PLANNER_ZERO_NO_MANDATORY_PRICE_PUBLISHED",
    );
  }
  const weeklyHours = Array.isArray(place.weeklyHours) ? place.weeklyHours : [];
  const dateExceptions = Array.isArray(place.dateExceptions)
    ? place.dateExceptions
    : [];
  const seenExceptionDates = new Set();
  for (const [exceptionIndex, exception] of dateExceptions.entries()) {
    const exceptionPath = `${path}.dateExceptions[${exceptionIndex}]`;
    if (!isRecord(exception) || typeof exception.date !== "string") {
      fail(exceptionPath, "must contain a date");
      continue;
    }
    if (!isCalendarDate(exception.date)) {
      fail(`${exceptionPath}.date`, "must be a real calendar date");
    }
    if (seenExceptionDates.has(exception.date)) {
      fail(`${exceptionPath}.date`, "must be unique within a place");
    }
    seenExceptionDates.add(exception.date);
    if (
      exception.date < pack.generatedAt.slice(0, 10) ||
      exception.date > pack.validThrough.slice(0, 10)
    ) {
      fail(`${exceptionPath}.date`, "must stay inside the pack horizon");
    }
    if (
      exception.closed === false &&
      (!Number.isFinite(timeToMinutes(exception.opens)) ||
        !Number.isFinite(timeToMinutes(exception.closes)) ||
        timeToMinutes(exception.closes) <= timeToMinutes(exception.opens))
    ) {
      fail(exceptionPath, "special hours must close after they open");
    }
  }
  const allDayWindows = weeklyHours.filter(
    ({ opens, closes }) => opens === "00:00" && closes === "23:59",
  );
  if (!isRecord(place.hoursProvenance)) {
    fail(
      `${path}.hoursProvenance`,
      "must declare how opening hours were sourced",
    );
  } else if (place.hoursProvenance.kind === "NO_SET_HOURS") {
    if (weeklyHours.length > 0 || dateExceptions.length > 0) {
      fail(
        `${path}.hoursProvenance`,
        "NO_SET_HOURS must not create schedulable windows",
      );
    }
    if (
      typeof place.hoursProvenance.sourceSummary !== "string" ||
      !/\b(?:does not publish|no set hours|no published hours)\b/i.test(
        place.hoursProvenance.sourceSummary,
      )
    ) {
      fail(
        `${path}.hoursProvenance.sourceSummary`,
        "NO_SET_HOURS must state that the source publishes no set window",
      );
    }
  } else if (place.hoursProvenance.kind === "PUBLISHED_WINDOWS") {
    if (weeklyHours.length === 0) {
      fail(
        `${path}.weeklyHours`,
        "PUBLISHED_WINDOWS requires at least one window",
      );
    }
    if (typeof place.hoursProvenance.publishedAllDay !== "boolean") {
      fail(
        `${path}.hoursProvenance.publishedAllDay`,
        "must explicitly state whether the source publishes all-day access",
      );
    }
    if (
      typeof place.hoursProvenance.sourceSummary !== "string" ||
      place.hoursProvenance.sourceSummary.length === 0 ||
      /\b(?:blank|inferred|assumed|editorial|no set|no published)\b/i.test(
        place.hoursProvenance.sourceSummary ?? "",
      )
    ) {
      fail(
        `${path}.hoursProvenance.sourceSummary`,
        "must describe a source-published window, not an inferred one",
      );
    }
    if (allDayWindows.length > 0 && !place.hoursProvenance.publishedAllDay) {
      fail(
        `${path}.weeklyHours`,
        "00:00-23:59 is forbidden unless the source explicitly publishes all-day access",
      );
    }
    if (allDayWindows.length === 0 && place.hoursProvenance.publishedAllDay) {
      fail(
        `${path}.hoursProvenance.publishedAllDay`,
        "must correspond to an explicit all-day window",
      );
    }
  } else if (place.hoursProvenance.kind === "PUBLISHED_INCOMPLETE") {
    if (weeklyHours.length === 0) {
      fail(
        `${path}.weeklyHours`,
        "PUBLISHED_INCOMPLETE must preserve the published windows",
      );
    }
    if (
      !/\b(?:incomplete|not fully modeled|recurring closure|holiday)\b/i.test(
        place.hoursProvenance.sourceSummary ?? "",
      )
    ) {
      fail(
        `${path}.hoursProvenance.sourceSummary`,
        "must identify why the published schedule is incomplete",
      );
    }
  } else {
    fail(
      `${path}.hoursProvenance.kind`,
      "must be PUBLISHED_WINDOWS, PUBLISHED_INCOMPLETE, or NO_SET_HOURS",
    );
  }
  if (
    place.routeEligibility?.kind === "ROUTABLE" &&
    place.hoursProvenance?.kind !== "PUBLISHED_WINDOWS"
  ) {
    fail(
      `${path}.routeEligibility`,
      "ROUTABLE requires complete PUBLISHED_WINDOWS",
    );
  }
  if (
    place.hoursProvenance?.kind === "NO_SET_HOURS" &&
    (place.routeEligibility?.kind !== "REFERENCE_ONLY" ||
      !place.routeEligibility.reasons?.includes("NO_SET_HOURS"))
  ) {
    fail(
      `${path}.routeEligibility`,
      "NO_SET_HOURS must be REFERENCE_ONLY with a NO_SET_HOURS reason",
    );
  }
  if (
    place.hoursProvenance?.kind === "PUBLISHED_INCOMPLETE" &&
    (place.routeEligibility?.kind !== "REFERENCE_ONLY" ||
      !place.routeEligibility.reasons?.includes("INCOMPLETE_HOURS"))
  ) {
    fail(
      `${path}.routeEligibility`,
      "PUBLISHED_INCOMPLETE must be REFERENCE_ONLY with an INCOMPLETE_HOURS reason",
    );
  }
  if (!isRecord(place.evidence)) {
    fail(`${path}.evidence`, "must contain field-level evidence references");
  } else {
    for (const [claim, scope] of [
      ["identity", "IDENTITY"],
      ["address", "ADDRESS"],
      ["hours", "HOURS"],
      ["price", "PRICE"],
      ["publicAccess", "PUBLIC_ACCESS"],
    ]) {
      const reference = place.evidence[claim];
      resolveEvidence(reference, `${path}.evidence.${claim}`, false, scope);
      if (
        (claim === "hours" || claim === "price") &&
        isRecord(reference) &&
        isTimestamp(reference.checkedAt) &&
        Date.parse(pack.validThrough) - Date.parse(reference.checkedAt) >
          60 * 86_400_000
      ) {
        fail(
          `${path}.evidence.${claim}.checkedAt`,
          "becomes hard-stale before validThrough",
        );
      }
    }
    if (place.evidence.coordinates === null) {
      if (
        place.routeEligibility?.kind !== "REFERENCE_ONLY" ||
        !place.routeEligibility.reasons?.includes("UNSUPPORTED_COORDINATES") ||
        place.coordinates !== null
      ) {
        fail(
          `${path}.evidence.coordinates`,
          "missing coordinate evidence requires null coordinates and REFERENCE_ONLY",
        );
      }
    } else {
      resolveEvidence(
        place.evidence.coordinates,
        `${path}.evidence.coordinates`,
        false,
        "COORDINATES",
      );
      if (place.coordinates === null) {
        fail(
          `${path}.coordinates`,
          "coordinate evidence requires coordinate values",
        );
      }
    }
    const officialSource = resolveEvidence(
      place.evidence.officialLink,
      `${path}.evidence.officialLink`,
      true,
    );
    if (officialSource?.sourceKind !== "OFFICIAL_SITE") {
      fail(
        `${path}.evidence.officialLink`,
        "must reference an OFFICIAL_SITE source",
      );
    }
    const sourceUrl = officialSource
      ? httpsUrl(officialSource.url, `${path}.evidence.officialLink.sourceUrl`)
      : null;
    if (officialUrl && sourceUrl && officialUrl.origin !== sourceUrl.origin) {
      fail(
        `${path}.officialUrl`,
        "must share an origin with its officialLink evidence",
      );
    }
  }
}

if (pack.status === "ACTIVE" && categories.size < 3) {
  fail("$.places", "an ACTIVE pack must contain at least three categories");
}
if (pack.status === "ACTIVE" && routablePlaceCount < 9) {
  fail(
    "$.places",
    `an ACTIVE pack must contain at least nine routable places; found ${routablePlaceCount}`,
  );
}
if (
  [...usedCalendarSourceIds].sort().join("\u0000") !==
  [...(Array.isArray(pack.calendarSourceIds) ? pack.calendarSourceIds : [])]
    .sort()
    .join("\u0000")
) {
  fail(
    "$.calendarSourceIds",
    "must exactly equal the calendar sources referenced by places",
  );
}

const sourcePointer = (sourceId, checkedAt) => {
  const source = sourceById.get(sourceId);
  return {
    sourceId,
    sourceUrl: source?.url ?? `missing:${sourceId}`,
    checkedAt,
    title: source?.title ?? "Missing source",
    publisher: source?.publisher ?? "Missing publisher",
    sourceKind: source?.sourceKind ?? "OFFICIAL_SITE",
    usage: source?.usage ?? { mode: "OFFICIAL_LINK_ONLY" },
    ...(source?.publishedAt ? { publishedAt: source.publishedAt } : {}),
    ...(source?.notes ? { notes: source.notes } : {}),
  };
};
const claim = (value, reference) => ({
  value,
  source: sourcePointer(
    isRecord(reference) ? reference.sourceId : "missing-evidence",
    isRecord(reference) ? reference.checkedAt : "missing",
  ),
});
const reviewedClaims = {
  schemaVersion: "2",
  packVersion: pack.packVersion,
  status: pack.status,
  generatedAt: pack.generatedAt,
  validThrough: pack.validThrough,
  dataLicense: pack.dataLicense,
  station: {
    name: pack.station?.name,
    coordinates: pack.station?.coordinates,
    sources: Array.isArray(pack.station?.sourceIds)
      ? pack.station.sourceIds.map((sourceId) => {
          const source = sourceById.get(sourceId);
          return sourcePointer(sourceId, source?.checkedAt ?? "missing");
        })
      : [],
  },
  calendarSources: Array.isArray(pack.calendarSourceIds)
    ? pack.calendarSourceIds.map((sourceId) => {
        const source = sourceById.get(sourceId);
        return sourcePointer(sourceId, source?.checkedAt ?? "missing");
      })
    : [],
  places: places.map((place) => ({
    placeId: place.placeId,
    calendarSources: Array.isArray(place.calendarSourceIds)
      ? place.calendarSourceIds.map((sourceId) => {
          const source = sourceById.get(sourceId);
          return sourcePointer(sourceId, source?.checkedAt ?? "missing");
        })
      : [],
    identity: claim(place.name, place.evidence?.identity),
    address: claim(place.address, place.evidence?.address),
    coordinates: claim(place.coordinates, place.evidence?.coordinates),
    hours: claim(
      {
        hoursProvenance: place.hoursProvenance,
        weeklyHours: place.weeklyHours,
        dateExceptions: place.dateExceptions,
      },
      place.evidence?.hours,
    ),
    price: claim(
      {
        price: place.price,
        priceProvenance: place.priceProvenance,
      },
      place.evidence?.price,
    ),
    publicAccess: claim(place.routeEligibility, place.evidence?.publicAccess),
    officialLink: claim(place.officialUrl, place.evidence?.officialLink),
  })),
};
const reviewedClaimSnapshot = isRecord(reviewedClaimLedger)
  ? reviewedClaimLedger[pack.packVersion]
  : undefined;
if (reviewedClaimSnapshot === undefined) {
  fail(
    `$.reviewedClaims.${pack.packVersion}`,
    "must contain a reviewed claim snapshot for this pack version",
  );
} else if (
  canonicalJson(reviewedClaimSnapshot) !== canonicalJson(reviewedClaims)
) {
  fail(
    `$.reviewedClaims.${pack.packVersion}`,
    "must exactly match canonical hours, prices, coordinates, access, and official links",
  );
}

for (const sourceId of sourceById.keys()) {
  if (!usedSourceIds.has(sourceId)) {
    fail(`$.sources[${sourceId}]`, "is declared but unused");
  }
}

if (errors.length === 0 && process.argv.includes("--check-urls")) {
  const urls = new Set([
    pack.dataLicense.licenseUrl,
    ...sources.map(({ url }) => url),
    ...sources.flatMap(({ usage }) =>
      usage?.mode === "OPEN_LICENSE" ? [usage.licenseUrl] : [],
    ),
    ...places.map(({ officialUrl }) => officialUrl),
  ]);
  for (const url of urls) {
    try {
      const response = await globalThis.fetch(url, {
        headers: { "user-agent": "SerendipitySourceAudit/2.0" },
        redirect: "follow",
        signal: globalThis.AbortSignal.timeout(10_000),
      });
      await response.body?.cancel();
      if (response.status < 200 || response.status >= 400) {
        fail(`source URL ${url}`, `returned HTTP ${response.status}`);
      }
    } catch (error) {
      fail(
        `source URL ${url}`,
        error instanceof Error ? error.message : "request failed",
      );
    }
  }
}

if (errors.length > 0) {
  console.error(`v2 source audit failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `v2 source audit passed: ${places.length} places (${routablePlaceCount} routable), coordinate-derived walking, ${sources.length} sources${process.argv.includes("--check-urls") ? ", live URLs 200-399" : ""}`,
);
