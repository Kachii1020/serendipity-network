import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { auditV3Catalog, defaultCatalogPath } from "./audit-v3-sources.mjs";

const catalog = JSON.parse(readFileSync(defaultCatalogPath, "utf8"));
const clone = () => globalThis.structuredClone(catalog);

test("accepts the reviewed three-hub walking skeleton", () => {
  const result = auditV3Catalog(clone());
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 3);
});

test("requires four activities and three meals in every ACTIVE area", () => {
  const mutated = clone();
  mutated[1].places = mutated[1].places.filter(
    (place) => place.placeId !== "shinjuku-copabowl",
  );
  mutated[2].places = mutated[2].places.filter(
    (place) => place.placeId !== "ichiran-ikebukuro",
  );
  const result = auditV3Catalog(mutated);
  assert(result.errors.some((error) => error.includes("four activities")));
  assert(result.errors.some((error) => error.includes("at least three meals")));
});

test("fails closed when a meal loses official menu evidence", () => {
  const mutated = clone();
  mutated[0].places.find((place) => place.role === "MEAL").evidence.menu = null;
  const result = auditV3Catalog(mutated);
  assert(result.errors.some((error) => error.includes("evidence.menu")));
});

test("rejects Tabelog as a factual data source", () => {
  const mutated = clone();
  mutated[0].sources[1].url = "https://tabelog.com/example";
  const result = auditV3Catalog(mutated);
  assert(result.errors.some((error) => error.includes("Tabelog")));
});

test("rejects fabricated or malformed Google Place IDs", () => {
  const mutated = clone();
  mutated[0].places.find((place) => place.role === "MEAL").googlePlaceId =
    "not-a-place-id";
  const result = auditV3Catalog(mutated);
  assert(result.errors.some((error) => error.includes("authoritative ChIJ")));
});

test("rejects impossible source check dates", () => {
  const mutated = clone();
  mutated[1].sources[0].checkedAt = "2026-02-30T10:00:00+09:00";
  const result = auditV3Catalog(mutated);
  assert(result.errors.some((error) => error.includes("strict JST timestamp")));
});

test("requires the visible official URL to equal its source pointer", () => {
  const mutated = clone();
  mutated[2].places[0].officialUrl = "https://example.com/not-official";
  const result = auditV3Catalog(mutated);
  assert(
    result.errors.some((error) => error.includes("reviewed official-link")),
  );
});

test("rejects reviews, ratings, photos, and live-state claims", () => {
  const mutated = clone();
  mutated[2].places[0].rating = 4.9;
  const result = auditV3Catalog(mutated);
  assert(result.errors.some((error) => error.includes("outside the v3")));
});

test("detects reviewed snapshot drift", () => {
  const mutated = clone();
  const reviewedLedgers = Object.fromEntries(
    catalog.map((pack) => [
      pack.area,
      {
        [pack.packVersion]: {
          schemaVersion: "3",
          packVersion: pack.packVersion,
          area: pack.area,
          pack: globalThis.structuredClone(pack),
        },
      },
    ]),
  );
  mutated[0].places[0].summary = "Unreviewed drift.";
  const result = auditV3Catalog(mutated, { reviewedLedgers });
  assert(
    result.errors.some((error) => error.includes("reviewed pack snapshot")),
  );
});
