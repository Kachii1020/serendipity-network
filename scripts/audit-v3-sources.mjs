import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const defaultCatalogPath = resolve(
  repositoryRoot,
  "apps/hub/data/planner-v3/area-packs.v3.json",
);

const AREAS = ["shibuya", "shinjuku", "ikebukuro"];
const SOURCE_KINDS = [
  "OPEN_DATASET",
  "OFFICIAL_SITE",
  "OFFICIAL_MENU",
  "LICENSE_TERMS",
];
const FACTS = [
  "IDENTITY",
  "ADDRESS",
  "COORDINATES",
  "HOURS",
  "PRICE",
  "PUBLIC_ACCESS",
  "MENU",
];
const CATEGORIES = [
  "heritage",
  "library",
  "park",
  "gallery",
  "botanical",
  "science-center",
  "museum",
  "experience",
  "restaurant",
  "cafe",
  "public-space",
];
const TAGS = [
  "art",
  "heritage",
  "food",
  "drinks",
  "hands-on",
  "quiet",
  "lively",
  "books",
  "outdoors",
  "music",
  "coffee-tea",
  "science",
];
const CLAIM_FACT = {
  identity: "IDENTITY",
  address: "ADDRESS",
  coordinates: "COORDINATES",
  hours: "HOURS",
  price: "PRICE",
  publicAccess: "PUBLIC_ACCESS",
  menu: "MENU",
};

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isDate = (value) => {
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
    /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?\+09:00$/.exec(
      value,
    );
  return Boolean(
    match && isDate(match[1]) && Number.isFinite(Date.parse(value)),
  );
};
const isTime = (value) =>
  typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const isHttps = (value) => {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && url.username === "" && url.password === ""
    );
  } catch {
    return false;
  }
};
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonical(child)]),
  );
};
const sameJson = (left, right) =>
  JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));

export const auditV3Catalog = (catalog, options = {}) => {
  const errors = [];
  const warnings = [];
  const fail = (path, message) => errors.push(`${path}: ${message}`);
  const warn = (path, message) => warnings.push(`${path}: ${message}`);

  if (!Array.isArray(catalog)) {
    return { errors: ["$: must be an array"], warnings };
  }
  if (
    catalog.length !== 3 ||
    !sameJson(catalog.map((pack) => pack?.area).sort(), [...AREAS].sort())
  ) {
    fail("$", "must contain exactly one pack for each supported area");
  }

  for (const [packIndex, pack] of catalog.entries()) {
    const base = `$[${packIndex}]`;
    if (!isRecord(pack)) {
      fail(base, "must be an object");
      continue;
    }
    if (pack.schemaVersion !== "3")
      fail(`${base}.schemaVersion`, 'must equal "3"');
    if (!/^\d+\.\d+\.\d+$/.test(pack.packVersion ?? "")) {
      fail(`${base}.packVersion`, "must be a semantic version");
    }
    if (pack.status !== "ACTIVE") fail(`${base}.status`, "must be ACTIVE");
    if (!AREAS.includes(pack.area)) fail(`${base}.area`, "is unsupported");
    if (!isTimestamp(pack.generatedAt)) {
      fail(`${base}.generatedAt`, "must be a strict JST timestamp");
    }
    if (!isTimestamp(pack.validThrough)) {
      fail(`${base}.validThrough`, "must be a strict JST timestamp");
    } else if (isTimestamp(pack.generatedAt)) {
      const validity =
        Date.parse(pack.validThrough) - Date.parse(pack.generatedAt);
      if (validity <= 0 || validity > 14 * 86_400_000) {
        fail(
          `${base}.validThrough`,
          "must be after generatedAt and within 14 days",
        );
      }
    }
    if (!isRecord(pack.dataLicense) || !isHttps(pack.dataLicense.licenseUrl)) {
      fail(`${base}.dataLicense`, "must include an HTTPS license URL");
    }
    if (
      !isRecord(pack.station) ||
      typeof pack.station.name !== "string" ||
      !validCoordinates(pack.station.coordinates) ||
      !Array.isArray(pack.station.sourceIds) ||
      pack.station.sourceIds.length === 0
    ) {
      fail(
        `${base}.station`,
        "must include a named, sourced coordinate anchor",
      );
    }

    const sources = Array.isArray(pack.sources) ? pack.sources : [];
    const sourceById = new Map();
    for (const [sourceIndex, source] of sources.entries()) {
      const path = `${base}.sources[${sourceIndex}]`;
      if (!isRecord(source) || typeof source.sourceId !== "string") {
        fail(path, "must be a source object with sourceId");
        continue;
      }
      if (sourceById.has(source.sourceId)) {
        fail(`${path}.sourceId`, "must be unique within the pack");
      }
      sourceById.set(source.sourceId, source);
      if (!SOURCE_KINDS.includes(source.sourceKind)) {
        fail(`${path}.sourceKind`, "is unsupported");
      }
      if (!isHttps(source.url)) fail(`${path}.url`, "must be HTTPS");
      if (/tabelog\.com$/i.test(safeHostname(source.url))) {
        fail(
          `${path}.url`,
          "Tabelog content is outside the v3 source contract",
        );
      }
      if (!isTimestamp(source.checkedAt)) {
        fail(`${path}.checkedAt`, "must be a strict JST timestamp");
      } else if (
        isTimestamp(pack.generatedAt) &&
        (Date.parse(pack.generatedAt) - Date.parse(source.checkedAt)) /
          86_400_000 >
          7
      ) {
        fail(`${path}.checkedAt`, "must be within seven days of generatedAt");
      }
      if (!isRecord(source.usage)) {
        fail(`${path}.usage`, "must declare a use basis");
      } else if (source.usage.mode === "OPEN_LICENSE") {
        if (!isHttps(source.usage.licenseUrl)) {
          fail(`${path}.usage.licenseUrl`, "must be HTTPS");
        }
      } else if (source.usage.mode === "OFFICIAL_FACT_REFERENCE") {
        if (
          !Array.isArray(source.usage.factScope) ||
          source.usage.factScope.length === 0
        ) {
          fail(`${path}.usage.factScope`, "must not be empty");
        } else if (
          source.usage.factScope.some((fact) => !FACTS.includes(fact))
        ) {
          fail(`${path}.usage.factScope`, "contains an unsupported fact scope");
        }
        if (!["OFFICIAL_SITE", "OFFICIAL_MENU"].includes(source.sourceKind)) {
          fail(
            `${path}.sourceKind`,
            "official facts require an official source",
          );
        }
      } else if (source.usage.mode !== "OFFICIAL_LINK_ONLY") {
        fail(`${path}.usage.mode`, "is unsupported");
      }
      if (
        source.sourceKind === "OFFICIAL_MENU" &&
        source.usage?.mode !== "OFFICIAL_FACT_REFERENCE"
      ) {
        fail(`${path}.usage`, "official menus must declare factual use scope");
      }
    }

    for (const sourceId of pack.station?.sourceIds ?? []) {
      if (!sourceById.has(sourceId))
        fail(`${base}.station.sourceIds`, `missing ${sourceId}`);
    }

    const places = Array.isArray(pack.places) ? pack.places : [];
    const activityCount = places.filter(
      (place) => place?.role === "ACTIVITY",
    ).length;
    const mealCount = places.filter((place) => place?.role === "MEAL").length;
    if (activityCount < 4)
      fail(`${base}.places`, "requires at least four activities");
    if (mealCount < 3)
      fail(`${base}.places`, "ACTIVE packs require at least three meals");
    const placeIds = new Set();
    for (const [placeIndex, place] of places.entries()) {
      const path = `${base}.places[${placeIndex}]`;
      if (!isRecord(place) || typeof place.placeId !== "string") {
        fail(path, "must be a place object with placeId");
        continue;
      }
      if (placeIds.has(place.placeId))
        fail(`${path}.placeId`, "must be unique");
      placeIds.add(place.placeId);
      if (
        !/[A-Za-z]/.test(place.summary ?? "") ||
        String(place.summary).length > 180
      ) {
        fail(`${path}.summary`, "must be a concise original English summary");
      }
      if (!["ACTIVITY", "MEAL"].includes(place.role))
        fail(`${path}.role`, "is unsupported");
      if (!CATEGORIES.includes(place.category))
        fail(`${path}.category`, "is unsupported");
      if (!validCoordinates(place.coordinates))
        fail(`${path}.coordinates`, "is invalid");
      if (
        !Array.isArray(place.tags) ||
        place.tags.some((tag) => !TAGS.includes(tag))
      ) {
        fail(`${path}.tags`, "contains an unsupported tag");
      }
      if (!isHttps(place.officialUrl))
        fail(`${path}.officialUrl`, "must be HTTPS");
      if (
        place.googlePlaceId !== null &&
        (typeof place.googlePlaceId !== "string" ||
          !/^ChIJ[A-Za-z0-9_-]{10,}$/.test(place.googlePlaceId))
      ) {
        fail(
          `${path}.googlePlaceId`,
          "must be null or an authoritative ChIJ Place ID",
        );
      }
      if (
        !Number.isInteger(place.recommendedVisitMinutes) ||
        place.recommendedVisitMinutes < 20
      ) {
        fail(
          `${path}.recommendedVisitMinutes`,
          "must be an integer of at least 20",
        );
      }
      if (!Array.isArray(place.weeklyHours) || place.weeklyHours.length === 0) {
        fail(`${path}.weeklyHours`, "must publish at least one weekly window");
      } else {
        place.weeklyHours.forEach((window, index) => {
          if (
            !isRecord(window) ||
            !Array.isArray(window.days) ||
            window.days.length === 0 ||
            window.days.some(
              (day) => !Number.isInteger(day) || day < 0 || day > 6,
            ) ||
            !isTime(window.opens) ||
            !isTime(window.closes) ||
            window.opens >= window.closes
          ) {
            fail(
              `${path}.weeklyHours[${index}]`,
              "must be a same-day valid window",
            );
          }
        });
      }
      for (const [exceptionIndex, exception] of (
        place.dateExceptions ?? []
      ).entries()) {
        if (
          !isRecord(exception) ||
          !isDate(exception.date) ||
          typeof exception.closed !== "boolean"
        ) {
          fail(
            `${path}.dateExceptions[${exceptionIndex}]`,
            "must be a strict dated exception",
          );
        }
      }
      if (
        !isRecord(place.price) ||
        !["FREE", "PER_PERSON", "PER_GROUP"].includes(place.price.kind)
      ) {
        fail(`${path}.price`, "has an unsupported price contract");
      } else if (
        !Number.isInteger(place.price.minYen) ||
        !Number.isInteger(place.price.maxYen) ||
        place.price.minYen < 0 ||
        place.price.maxYen < place.price.minYen ||
        (place.price.kind === "FREE" &&
          (place.price.minYen !== 0 || place.price.maxYen !== 0))
      ) {
        fail(`${path}.price`, "has an invalid yen range");
      }

      if (!isRecord(place.evidence)) {
        fail(`${path}.evidence`, "must be present");
        continue;
      }
      for (const claimName of [
        "identity",
        "address",
        "coordinates",
        "hours",
        "price",
        "publicAccess",
        "officialLink",
      ]) {
        auditClaim(
          place.evidence[claimName],
          claimName,
          `${path}.evidence.${claimName}`,
          sourceById,
          fail,
        );
      }
      if (place.role === "MEAL") {
        if (place.price?.kind !== "PER_PERSON") {
          fail(`${path}.price.kind`, "meals require a PER_PERSON budget basis");
        }
        auditClaim(
          place.evidence.menu,
          "menu",
          `${path}.evidence.menu`,
          sourceById,
          fail,
        );
        const menuSource = sourceById.get(place.evidence.menu?.sourceId);
        if (menuSource?.sourceKind !== "OFFICIAL_MENU") {
          fail(
            `${path}.evidence.menu`,
            "must point to an OFFICIAL_MENU source",
          );
        }
        if (place.googlePlaceId === null) {
          warn(
            `${path}.googlePlaceId`,
            "Google enrichment will be unavailable for this meal",
          );
        }
      } else if (place.evidence.menu !== null) {
        fail(
          `${path}.evidence.menu`,
          "activities must not claim restaurant-menu evidence",
        );
      }
      const officialSource = sourceById.get(
        place.evidence.officialLink?.sourceId,
      );
      if (officialSource?.url !== place.officialUrl) {
        fail(
          `${path}.officialUrl`,
          "must equal its reviewed official-link source URL",
        );
      }
    }

    const ledger = options.reviewedLedgers?.[pack.area];
    if (ledger !== undefined) {
      const claim = ledger?.[pack.packVersion];
      if (
        !isRecord(claim) ||
        claim.schemaVersion !== "3" ||
        claim.packVersion !== pack.packVersion ||
        claim.area !== pack.area ||
        !sameJson(claim.pack, pack)
      ) {
        fail(
          `${base}.reviewedClaims`,
          "does not exactly match the reviewed pack snapshot",
        );
      }
    }
  }

  rejectForbidden(catalog, "$", fail);
  return { errors, warnings };
};

const validCoordinates = (value) =>
  isRecord(value) &&
  typeof value.latitude === "number" &&
  value.latitude >= 35 &&
  value.latitude <= 36 &&
  typeof value.longitude === "number" &&
  value.longitude >= 139 &&
  value.longitude <= 140;

const safeHostname = (value) => {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
};

const auditClaim = (claim, claimName, path, sourceById, fail) => {
  if (
    !isRecord(claim) ||
    typeof claim.sourceId !== "string" ||
    !isTimestamp(claim.checkedAt)
  ) {
    fail(path, "must be a strict source pointer");
    return;
  }
  const source = sourceById.get(claim.sourceId);
  if (!source) {
    fail(path, `references missing source ${claim.sourceId}`);
    return;
  }
  if (claim.checkedAt !== source.checkedAt) {
    fail(`${path}.checkedAt`, "must equal the reviewed source check time");
  }
  if (claimName === "officialLink") return;
  const requiredFact = CLAIM_FACT[claimName];
  if (
    source.usage?.mode === "OFFICIAL_LINK_ONLY" ||
    (source.usage?.mode === "OFFICIAL_FACT_REFERENCE" &&
      !source.usage.factScope.includes(requiredFact))
  ) {
    fail(path, `source is not reviewed for ${requiredFact}`);
  }
};

const rejectForbidden = (value, path, fail) => {
  if (typeof value === "string") {
    if (/<\/?(?:script|iframe|img|svg)\b/i.test(value))
      fail(path, "must not contain raw markup");
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) =>
      rejectForbidden(child, `${path}[${index}]`, fail),
    );
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (
      /^(?:rating|review|reviewCount|photo|image|liveAvailability|reservation|inventory)$/i.test(
        key,
      )
    ) {
      fail(`${path}.${key}`, "is outside the v3 source-backed contract");
    }
    rejectForbidden(child, `${path}.${key}`, fail);
  }
};

const loadReviewedLedgers = (catalog) =>
  Object.fromEntries(
    catalog.map((pack) => {
      const path = resolve(
        repositoryRoot,
        `apps/hub/data/planner-v3/${pack.area}.reviewed-claims.v3.json`,
      );
      if (!existsSync(path))
        throw new Error(`missing reviewed ledger: ${path}`);
      return [pack.area, JSON.parse(readFileSync(path, "utf8"))];
    }),
  );

const runLiveAudit = async (catalog) => {
  const urls = [
    ...new Set(
      catalog
        .flatMap((pack) => [
          pack.dataLicense.licenseUrl,
          ...pack.sources.flatMap((source) => [
            source.url,
            source.usage?.licenseUrl,
          ]),
          ...pack.places.map((place) => place.officialUrl),
        ])
        .filter(Boolean),
    ),
  ];
  const failures = [];
  for (let index = 0; index < urls.length; index += 6) {
    const chunk = urls.slice(index, index + 6);
    const results = await Promise.all(
      chunk.map(async (url) => {
        try {
          const response = await globalThis.fetch(url, {
            redirect: "follow",
            signal: globalThis.AbortSignal.timeout(10_000),
            headers: { "user-agent": "SerendipitySourceAudit/3.0" },
          });
          return response.status >= 200 && response.status < 400
            ? null
            : `${url}: HTTP ${response.status}`;
        } catch (error) {
          return `${url}: ${error instanceof Error ? error.message : "request failed"}`;
        }
      }),
    );
    failures.push(...results.filter(Boolean));
  }
  return { checked: urls.length, failures };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const catalogPath = resolve(
    process.cwd(),
    process.argv.slice(2).find((argument) => !argument.startsWith("--")) ??
      defaultCatalogPath,
  );
  let catalog;
  try {
    catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  } catch (error) {
    console.error(
      `v3 source audit failed: ${error instanceof Error ? error.message : "read error"}`,
    );
    process.exit(1);
  }
  const result = auditV3Catalog(catalog, {
    reviewedLedgers: loadReviewedLedgers(catalog),
  });
  if (result.errors.length > 0) {
    console.error(`v3 source audit failed (${result.errors.length} errors):`);
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }
  result.warnings.forEach((warning) => console.warn(`warning: ${warning}`));
  if (process.argv.includes("--live")) {
    const live = await runLiveAudit(catalog);
    if (live.failures.length > 0) {
      console.error(
        `v3 live source audit failed (${live.failures.length}/${live.checked}):`,
      );
      live.failures.forEach((failure) => console.error(`- ${failure}`));
      process.exit(1);
    }
    console.log(`v3 live source audit passed: ${live.checked} URLs.`);
  }
  const counts = Object.fromEntries(
    catalog.map((pack) => [
      pack.area,
      {
        activities: pack.places.filter((place) => place.role === "ACTIVITY")
          .length,
        meals: pack.places.filter((place) => place.role === "MEAL").length,
        sources: pack.sources.length,
      },
    ]),
  );
  console.log(`v3 source audit passed: ${JSON.stringify(counts)}.`);
}
