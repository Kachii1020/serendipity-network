import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packPath = resolve(
  repositoryRoot,
  "apps/hub/data/shibuya.places.v2.json",
);
const errors = [];

const fail = (path, message) => errors.push(`${path}: ${message}`);
const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isTimestamp = (value) =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

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
    "v2 source audit failed: required pack is absent at apps/hub/data/shibuya.places.v2.json",
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

rejectUnknown(pack);
rejectAuthorityClaims(pack);
if (pack.schemaVersion !== "2") fail("$.schemaVersion", 'must equal "2"');
if (!isTimestamp(pack.generatedAt)) {
  fail("$.generatedAt", "must be an ISO timestamp");
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
  } else if (source.usage.mode !== "OFFICIAL_LINK_ONLY") {
    fail(
      `${path}.usage.mode`,
      "must be OPEN_LICENSE, EXPLICIT_PERMISSION, or OFFICIAL_LINK_ONLY",
    );
  }
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
    }
  }
};

const resolveEvidence = (reference, path, allowOfficialLink = false) => {
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

const places = Array.isArray(pack.places) ? pack.places : [];
if (places.length === 0) fail("$.places", "must contain at least one place");
if (pack.status === "ACTIVE" && places.length < 9) {
  fail("$.places", "an ACTIVE pack must contain at least nine places");
}
const placeIds = new Set();
const categories = new Set();

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
  const officialUrl = httpsUrl(place.officialUrl, `${path}.officialUrl`);
  if (!isRecord(place.coordinates)) {
    fail(`${path}.coordinates`, "must contain latitude and longitude");
  } else if (
    !Number.isFinite(place.coordinates.latitude) ||
    !Number.isFinite(place.coordinates.longitude)
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
  if (!Array.isArray(place.weeklyHours) || place.weeklyHours.length === 0) {
    fail(`${path}.weeklyHours`, "must contain normalized weekly hours");
  }
  if (!isRecord(place.evidence)) {
    fail(`${path}.evidence`, "must contain field-level evidence references");
  } else {
    for (const claim of ["identity", "location", "hours", "price"]) {
      resolveEvidence(place.evidence[claim], `${path}.evidence.${claim}`);
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

for (const sourceId of sourceById.keys()) {
  if (!usedSourceIds.has(sourceId)) {
    fail(`$.sources[${sourceId}]`, "is declared but unused");
  }
}

if (errors.length > 0) {
  console.error(`v2 source audit failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `v2 source audit passed: ${places.length} places, coordinate-derived walking, ${sources.length} sources`,
);
