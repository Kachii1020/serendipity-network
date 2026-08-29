import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const auditPath = resolve(repositoryRoot, "scripts/audit-v2-sources.mjs");
const sourcePack = JSON.parse(
  readFileSync(
    resolve(repositoryRoot, "apps/hub/data/shibuya.places.v2.json"),
    "utf8",
  ),
);

const temporaryDirectory = mkdtempSync(
  join(tmpdir(), "serendipity-v2-source-audit-"),
);
let fixtureIndex = 0;

const runAudit = (pack) => {
  const fixturePath = join(temporaryDirectory, `pack-${fixtureIndex++}.json`);
  writeFileSync(fixturePath, JSON.stringify(pack));
  return spawnSync(process.execPath, [auditPath, fixturePath], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
};

test.after(() => {
  rmSync(temporaryDirectory, { force: true, recursive: true });
});

test("active release audit accepts nine fully routable places", () => {
  const result = runAudit(sourcePack);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /9 places \(9 routable\)/);
});

test("standalone release audit rejects candidate status", () => {
  const candidate = globalThis.structuredClone(sourcePack);
  candidate.status = "CANDIDATE";
  const result = runAudit(candidate);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /standalone release audit requires ACTIVE/);
});

test("audit requires field-level public-access evidence", () => {
  const missing = globalThis.structuredClone(sourcePack);
  delete missing.places[0].evidence.publicAccess;
  const result = runAudit(missing);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /evidence\.publicAccess/);
});

test("reviewed claims reject unreviewed scheduling-value drift", () => {
  const mutations = [
    (pack) => {
      pack.places[0].address = "Unreviewed address";
    },
    (pack) => {
      pack.places[0].coordinates.latitude += 0.01;
    },
    (pack) => {
      pack.places[0].weeklyHours[0].closes = "17:55";
    },
    (pack) => {
      pack.places[0].price.minYen += 100;
      pack.places[0].price.maxYen += 100;
    },
    (pack) => {
      pack.places[0].routeEligibility = {
        kind: "REFERENCE_ONLY",
        reasons: ["RESTRICTED_ACCESS"],
        note: "Unreviewed access change",
      };
    },
    (pack) => {
      pack.places[0].officialUrl =
        "https://www.city.shibuya.tokyo.jp/unreviewed";
    },
    (pack) => {
      pack.sources.find(
        ({ sourceId }) => sourceId === "shibuya-city-asakura",
      ).url = "https://www.city.shibuya.tokyo.jp/unreviewed-source";
    },
    (pack) => {
      pack.sources.find(
        ({ sourceId }) => sourceId === "shibuya-library-opening-calendar",
      ).url = "https://www.lib.city.shibuya.tokyo.jp/unreviewed-calendar";
    },
  ];
  for (const mutate of mutations) {
    const changed = globalThis.structuredClone(sourcePack);
    mutate(changed);
    const result = runAudit(changed);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must exactly match canonical hours, prices/);
  }
});

test("active release audit fails closed when one place becomes reference-only", () => {
  const blocked = globalThis.structuredClone(sourcePack);
  blocked.places[0].routeEligibility = {
    kind: "REFERENCE_ONLY",
    reasons: ["UNSOURCED_PRICE"],
    note: "Focused audit fixture.",
  };
  const result = runAudit(blocked);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /at least nine routable places; found 8/);
});

test("audit rejects inferred all-day hours", () => {
  const candidate = globalThis.structuredClone(sourcePack);
  candidate.status = "CANDIDATE";
  const gallery = candidate.places.find(
    ({ placeId }) => placeId === "kawamoto-puppet-gallery",
  );
  assert.ok(gallery);
  gallery.weeklyHours = [
    { days: [0, 1, 2, 3, 4, 5, 6], opens: "00:00", closes: "23:59" },
  ];
  gallery.hoursProvenance.publishedAllDay = false;
  const result = runAudit(candidate);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /00:00-23:59 is forbidden/);
});

test("audit rejects schedulable windows for no-set hours", () => {
  const candidate = globalThis.structuredClone(sourcePack);
  candidate.status = "CANDIDATE";
  const place = candidate.places[0];
  assert.ok(place);
  place.hoursProvenance = {
    kind: "NO_SET_HOURS",
    sourceSummary: "The cited source publishes no set hours.",
  };
  place.routeEligibility = {
    kind: "REFERENCE_ONLY",
    reasons: ["NO_SET_HOURS"],
    note: "Focused no-set-hours fixture.",
  };
  place.weeklyHours = [
    { days: [0, 1, 2, 3, 4, 5, 6], opens: "09:00", closes: "18:00" },
  ];
  const result = runAudit(candidate);
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /NO_SET_HOURS must not create schedulable windows/,
  );
});

test("audit rejects a planner-zero value labelled Free", () => {
  const candidate = globalThis.structuredClone(sourcePack);
  candidate.status = "CANDIDATE";
  const place = candidate.places[0];
  assert.ok(place);
  place.price = { kind: "FREE", minYen: 0, maxYen: 0, label: "Free" };
  place.priceProvenance = {
    kind: "PLANNER_ZERO_NO_MANDATORY_PRICE_PUBLISHED",
    sourceSummary: "The cited source publishes no mandatory admission amount.",
  };
  place.routeEligibility = {
    kind: "REFERENCE_ONLY",
    reasons: ["UNSOURCED_PRICE"],
    note: "Focused planner-zero fixture.",
  };
  const result = runAudit(candidate);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be labelled as a planner reference/);
});

test("audit rejects a pack horizon beyond sixty Tokyo calendar days", () => {
  const candidate = globalThis.structuredClone(sourcePack);
  candidate.validThrough = "2026-10-30T23:59:59+09:00";
  const result = runAudit(candidate);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /within sixty Tokyo calendar days/);
});

test("audit rejects impossible calendar dates across pack and evidence fields", () => {
  const cases = [
    ["generatedAt", (pack) => (pack.generatedAt = "2026-09-31T12:00:00+09:00")],
    [
      "validThrough",
      (pack) => (pack.validThrough = "2026-09-31T23:59:59+09:00"),
    ],
    [
      "checkedAt",
      (pack) => (pack.sources[0].checkedAt = "2026-09-31T12:00:00+09:00"),
    ],
    [
      "publishedAt",
      (pack) => (pack.sources[0].publishedAt = "2026-09-31T12:00:00Z"),
    ],
    [
      "evidence.hours.checkedAt",
      (pack) =>
        (pack.places[0].evidence.hours.checkedAt = "2026-09-31T12:00:00+09:00"),
    ],
    [
      "dateExceptions",
      (pack) => (pack.places[0].dateExceptions[0].date = "2026-09-31"),
    ],
  ];

  for (const [field, mutate] of cases) {
    const candidate = globalThis.structuredClone(sourcePack);
    mutate(candidate);
    const result = runAudit(candidate);
    assert.notEqual(result.status, 0, `${field} must fail closed`);
    assert.match(result.stderr, new RegExp(String(field).replace(".", "\\.")));
  }
});

test("audit requires official calendar sources and horizon-safe exceptions", () => {
  const missingCalendar = globalThis.structuredClone(sourcePack);
  missingCalendar.calendarSourceIds = ["missing-calendar-source"];
  let result = runAudit(missingCalendar);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /calendarSourceIds/);

  const staleCalendar = globalThis.structuredClone(sourcePack);
  staleCalendar.sources.find(
    ({ sourceId }) => sourceId === "shibuya-library-opening-calendar",
  ).checkedAt = "2026-08-29T00:00:00+09:00";
  result = runAudit(staleCalendar);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /becomes hard-stale before validThrough/);

  const duplicateException = globalThis.structuredClone(sourcePack);
  duplicateException.places[0].dateExceptions.push(
    globalThis.structuredClone(duplicateException.places[0].dateExceptions[0]),
  );
  result = runAudit(duplicateException);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be unique within a place/);

  const outsideHorizon = globalThis.structuredClone(sourcePack);
  outsideHorizon.places[0].dateExceptions.push({
    date: "2026-10-29",
    closed: true,
    note: "Outside the audited horizon",
  });
  result = runAudit(outsideHorizon);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must stay inside the pack horizon/);
});
