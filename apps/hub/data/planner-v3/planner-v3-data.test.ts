import { describe, expect, it } from "vitest";

import {
  AREA_REGISTRY_V3,
  TOKYO_AREA_PACKS_V3,
  getAreaDataPackV3,
  getPlaceEvidenceV3,
  getReviewedPackClaimsV3,
} from "./index";
import {
  PLANNER_V3_AREAS,
  validateAreaDataPackV3,
  validateReviewedPackClaimsV3,
} from "@serendipity/contracts/planner-v3";

describe("planner v3 reviewed area packs", () => {
  it("loads one reviewed ACTIVE pack for every supported hub", () => {
    expect(TOKYO_AREA_PACKS_V3.map(({ area }) => area).sort()).toEqual(
      [...PLANNER_V3_AREAS].sort(),
    );
    for (const area of PLANNER_V3_AREAS) {
      const pack = getAreaDataPackV3(area);
      expect(validateAreaDataPackV3(pack).ok).toBe(true);
      expect(
        validateReviewedPackClaimsV3(pack, getReviewedPackClaimsV3(area)).ok,
      ).toBe(true);
      expect(pack.status).toBe("ACTIVE");
      expect(
        pack.places.filter(({ role }) => role === "ACTIVITY"),
      ).toHaveLength(4);
      expect(pack.places.filter(({ role }) => role === "MEAL")).toHaveLength(3);
    }
  });

  it("binds every meal to an official menu without inventing Place IDs", () => {
    for (const { pack } of Object.values(AREA_REGISTRY_V3)) {
      const sourceById = new Map(
        pack.sources.map((source) => [source.sourceId, source]),
      );
      const meals = pack.places.filter(({ role }) => role === "MEAL");
      expect(
        meals.filter(({ googlePlaceId }) => googlePlaceId !== null),
      ).toHaveLength(2);
      for (const meal of meals) {
        expect(meal.price.kind).toBe("PER_PERSON");
        if (meal.googlePlaceId !== null) {
          expect(meal.googlePlaceId).toMatch(/^ChIJ[A-Za-z0-9_-]{10,}$/);
        }
        expect(meal.evidence.menu).not.toBeNull();
        expect(sourceById.get(meal.evidence.menu!.sourceId)?.sourceKind).toBe(
          "OFFICIAL_MENU",
        );
      }
    }
  });

  it("projects reviewed evidence without importing ratings or reviews", () => {
    for (const pack of TOKYO_AREA_PACKS_V3) {
      for (const place of pack.places) {
        const evidence = getPlaceEvidenceV3(pack.area, place.placeId);
        expect(evidence?.placeId).toBe(place.placeId);
        expect(evidence?.claims.officialLink.value).toBe(place.officialUrl);
        expect(evidence?.claims.menu === null).toBe(place.role === "ACTIVITY");
        expect(JSON.stringify(evidence)).not.toMatch(
          /"(?:rating|reviewCount|review|photo|image)"\s*:|tabelog\.com/i,
        );
      }
    }
  });

  it("returns null evidence for an unknown place", () => {
    expect(getPlaceEvidenceV3("shibuya", "does-not-exist")).toBeNull();
  });
});
