import {
  PLANNER_SCHEMA_VERSION,
  SWAP_PREFERENCES,
  validateEveningPlanV2,
  type PlannerIntentV2,
  type SwapPlanInputV2,
} from "@serendipity/contracts/planner-v2";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SHIBUYA_ACTIVE_PACK_V2 } from "../../data/shibuya-v2";

import {
  PLANNER_V2_PACK_VERSION,
  isPlannerPackEligibleV2,
  isPlannerPackCurrentV2,
  isSearchPlanEvidenceEligibleV2,
  readPlaceEvidenceAgainstPackV2,
  readPlaceEvidenceV2,
  searchEveningPlanAgainstPackV2,
  searchEveningPlanV2,
  swapEveningPlanV2,
} from "./runtime";

const intent: PlannerIntentV2 = {
  schemaVersion: PLANNER_SCHEMA_VERSION,
  area: "shibuya",
  partySize: 1,
  startAt: "2026-08-30T13:00:00+09:00",
  endAt: "2026-08-30T22:00:00+09:00",
  totalBudgetYen: 8_000,
  stopCount: "AUTO",
  maxWalkMinutesPerLeg: 20,
  preferredTags: ["art", "hands-on", "lively", "quiet"],
  excludedTags: [],
};

const swapIntent: PlannerIntentV2 = {
  ...intent,
  startAt: "2026-08-30T13:00:00+09:00",
  endAt: "2026-08-30T22:00:00+09:00",
  maxWalkMinutesPerLeg: 30,
  preferredTags: [],
};

describe("planner v2 server runtime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T12:00:00+09:00"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("builds a validated source-backed plan without external I/O", async () => {
    const result = await searchEveningPlanV2(
      intent,
      new AbortController().signal,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.candidateSetId).toBe(result.data.plan.candidateSetId);
    expect(result.data.plan.packVersion).toBe(PLANNER_V2_PACK_VERSION);
    expect(validateEveningPlanV2(result.data.plan).ok).toBe(true);
    expect(result.data.plan.stops).toHaveLength(3);
    expect(result.data.plan.disclaimer).toContain("not live availability");
    expect(
      isSearchPlanEvidenceEligibleV2(result.data.plan, SHIBUYA_ACTIVE_PACK_V2),
    ).toBe(true);
  });

  it("returns an honest no-result when every place tag is excluded", async () => {
    const result = await searchEveningPlanV2(
      {
        ...intent,
        preferredTags: [],
        excludedTags: ["art", "books", "hands-on", "outdoors"],
      },
      new AbortController().signal,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "NO_VALID_PLAN" },
    });
  });

  it("fails closed before composition when a pack is not ACTIVE or valid", async () => {
    const candidate = structuredClone(SHIBUYA_ACTIVE_PACK_V2);
    candidate.status = "CANDIDATE";
    expect(isPlannerPackEligibleV2(candidate)).toBe(false);
    await expect(
      searchEveningPlanAgainstPackV2(
        intent,
        candidate,
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR", retryable: false },
    });

    const underPromoted = structuredClone(SHIBUYA_ACTIVE_PACK_V2);
    for (const [index, place] of underPromoted.places.entries()) {
      if (index < 5) continue;
      place.routeEligibility = {
        kind: "REFERENCE_ONLY",
        reasons: ["RESTRICTED_ACCESS"],
        note: "Excluded by the promotion-gate test fixture.",
      };
    }
    expect(isPlannerPackEligibleV2(underPromoted)).toBe(false);
    await expect(
      searchEveningPlanAgainstPackV2(
        intent,
        underPromoted,
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR", retryable: false },
    });

    const invalid = structuredClone(SHIBUYA_ACTIVE_PACK_V2);
    invalid.places[0]!.evidence.hours.sourceId = "missing-hours-source";
    expect(isPlannerPackEligibleV2(invalid)).toBe(false);
    await expect(
      searchEveningPlanAgainstPackV2(
        intent,
        invalid,
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR", retryable: false },
    });
  });

  it("rejects source values that drift from the reviewed claim ledger", async () => {
    const tampered = structuredClone(SHIBUYA_ACTIVE_PACK_V2);
    tampered.places[0]!.price = {
      kind: "EXACT",
      label: "Tampered amount",
      maxYen: 777,
      minYen: 777,
    };

    expect(isPlannerPackEligibleV2(tampered)).toBe(false);
    await expect(
      searchEveningPlanAgainstPackV2(
        intent,
        tampered,
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR", retryable: false },
    });
  });

  it("enforces validThrough against both request time and requested end time", () => {
    const validThrough = new Date(SHIBUYA_ACTIVE_PACK_V2.validThrough);
    expect(
      isPlannerPackCurrentV2(
        SHIBUYA_ACTIVE_PACK_V2,
        new Date(validThrough.getTime() - 1),
        intent,
      ),
    ).toBe(true);
    expect(
      isPlannerPackCurrentV2(
        SHIBUYA_ACTIVE_PACK_V2,
        new Date(validThrough.getTime() + 1),
        intent,
      ),
    ).toBe(false);
    expect(
      isPlannerPackCurrentV2(
        SHIBUYA_ACTIVE_PACK_V2,
        new Date("2026-08-30T00:00:00+09:00"),
        {
          ...intent,
          startAt: "2026-09-07T17:00:00+09:00",
          endAt: "2026-09-07T22:00:00+09:00",
        },
      ),
    ).toBe(false);
  });

  it("fails evidence closed after validThrough before reading a place", () => {
    const getEvidence = vi.fn(() => {
      throw new Error("Evidence lookup must not run after validThrough");
    });
    const result = readPlaceEvidenceAgainstPackV2(
      "kyu-asakura-house",
      SHIBUYA_ACTIVE_PACK_V2,
      getEvidence,
      new Date(Date.parse(SHIBUYA_ACTIVE_PACK_V2.validThrough) + 1),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "STALE_DATA_PACK", retryable: false },
    });
    expect(getEvidence).not.toHaveBeenCalled();
  });

  it("fails evidence closed for a non-ACTIVE pack", () => {
    const candidate = structuredClone(SHIBUYA_ACTIVE_PACK_V2);
    candidate.status = "CANDIDATE";
    const getEvidence = vi.fn();
    const result = readPlaceEvidenceAgainstPackV2(
      "kyu-asakura-house",
      candidate,
      getEvidence,
      new Date("2026-08-30T12:00:00+09:00"),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR", retryable: false },
    });
    expect(getEvidence).not.toHaveBeenCalled();
  });

  it("replaces one stop while preserving a stateless validated plan snapshot", async () => {
    const found = await searchEveningPlanV2(
      swapIntent,
      new AbortController().signal,
    );
    expect(found.ok).toBe(true);
    if (!found.ok) return;

    let replacement: Awaited<ReturnType<typeof swapEveningPlanV2>> | undefined;
    let selectedInput: SwapPlanInputV2 | undefined;
    for (const stop of found.data.plan.stops) {
      for (const preference of SWAP_PREFERENCES) {
        const input: SwapPlanInputV2 = {
          schemaVersion: PLANNER_SCHEMA_VERSION,
          candidateSetId: found.data.candidateSetId,
          planId: found.data.plan.planId,
          intent: swapIntent,
          plan: found.data.plan,
          stopIndex: stop.position,
          preference,
        };
        const candidate = await swapEveningPlanV2(
          input,
          new AbortController().signal,
        );
        if (candidate.ok) {
          replacement = candidate;
          selectedInput = input;
          break;
        }
      }
      if (replacement?.ok) break;
    }

    expect(replacement?.ok).toBe(true);
    expect(selectedInput).toBeDefined();
    if (!replacement?.ok || !selectedInput) return;
    expect(validateEveningPlanV2(replacement.data.plan).ok).toBe(true);
    const unchangedPositions = found.data.plan.stops
      .map((stop) => stop.position)
      .filter((position) => position !== selectedInput.stopIndex);
    for (const position of unchangedPositions) {
      expect(replacement.data.plan.stops[position]?.place.placeId).toBe(
        found.data.plan.stops[position]?.place.placeId,
      );
    }
  });

  it("recomputes source warnings for the replacement plan", async () => {
    vi.setSystemTime(new Date("2026-09-16T12:00:00+09:00"));
    const warningIntent: PlannerIntentV2 = {
      ...swapIntent,
      endAt: "2026-09-16T22:00:00+09:00",
      startAt: "2026-09-16T13:00:00+09:00",
    };
    const found = await searchEveningPlanV2(
      warningIntent,
      new AbortController().signal,
    );
    expect(found.ok).toBe(true);
    if (!found.ok) return;

    let replacement: Awaited<ReturnType<typeof swapEveningPlanV2>> | undefined;
    for (const stop of found.data.plan.stops) {
      for (const preference of SWAP_PREFERENCES) {
        const candidate = await swapEveningPlanV2(
          {
            candidateSetId: found.data.candidateSetId,
            intent: warningIntent,
            plan: found.data.plan,
            planId: found.data.plan.planId,
            preference,
            schemaVersion: PLANNER_SCHEMA_VERSION,
            stopIndex: stop.position,
          },
          new AbortController().signal,
        );
        if (candidate.ok) {
          replacement = candidate;
          break;
        }
      }
      if (replacement) break;
    }

    expect(replacement?.ok).toBe(true);
    if (!replacement?.ok) return;
    expect([...replacement.data.warnings].sort()).toEqual(
      replacement.data.plan.stops
        .map(({ place }) => `SOURCE_RECHECK_RECOMMENDED:${place.placeId}`)
        .sort(),
    );
  });

  it("rejects swap after the audited pack horizon", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-30T12:00:00+09:00"));
      const found = await searchEveningPlanV2(
        intent,
        new AbortController().signal,
      );
      expect(found.ok).toBe(true);
      if (!found.ok) return;

      vi.setSystemTime(
        new Date(Date.parse(SHIBUYA_ACTIVE_PACK_V2.validThrough) + 1),
      );
      await expect(
        swapEveningPlanV2(
          {
            schemaVersion: PLANNER_SCHEMA_VERSION,
            candidateSetId: found.data.candidateSetId,
            planId: found.data.plan.planId,
            intent: found.data.plan.intent,
            plan: found.data.plan,
            stopIndex: 0,
            preference: "LESS_WALKING",
          },
          new AbortController().signal,
        ),
      ).resolves.toMatchObject({
        ok: false,
        error: { code: "STALE_DATA_PACK", retryable: false },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns source evidence and a normalized missing-place error", () => {
    const found = readPlaceEvidenceV2("kyu-asakura-house");
    expect(found).toMatchObject({
      ok: true,
      data: {
        evidence: {
          packVersion: PLANNER_V2_PACK_VERSION,
          placeId: "kyu-asakura-house",
        },
      },
    });
    expect(readPlaceEvidenceV2("missing-place")).toMatchObject({
      ok: false,
      error: { code: "PLACE_NOT_FOUND" },
    });
  });

  it("returns only schedulable published-window stops with field-level evidence", async () => {
    const found = await searchEveningPlanV2(
      intent,
      new AbortController().signal,
    );
    expect(found.ok).toBe(true);
    if (!found.ok) return;

    const sourceById = new Map(
      SHIBUYA_ACTIVE_PACK_V2.sources.map((source) => [source.sourceId, source]),
    );
    for (const stop of found.data.plan.stops) {
      const place = SHIBUYA_ACTIVE_PACK_V2.places.find(
        ({ placeId }) => placeId === stop.place.placeId,
      );
      expect(place?.routeEligibility.kind).toBe("ROUTABLE");
      expect(place?.hoursProvenance.kind).toBe("PUBLISHED_WINDOWS");
      expect(place?.priceProvenance.kind).toBe("PUBLISHED_AMOUNT");
      expect(stop.openingFit).toMatch(/published .* hours/i);
      expect(stop.travelMethod).toBe("COORDINATE_ESTIMATE");
      expect(place).toBeDefined();
      if (!place) continue;
      expect(stop.priceProvenance).toEqual(place.priceProvenance);
      expect(place.evidence.coordinates).not.toBeNull();
      if (!place.evidence.coordinates) continue;

      for (const reference of [
        place.evidence.identity,
        place.evidence.address,
        place.evidence.coordinates,
        place.evidence.hours,
        place.evidence.price,
        place.evidence.officialLink,
      ]) {
        expect(sourceById.has(reference.sourceId)).toBe(true);
      }
      const evidence = readPlaceEvidenceV2(place.placeId);
      expect(evidence.ok).toBe(true);
      if (!evidence.ok) continue;
      expect(evidence.data.evidence.claims.identity.value).toBe(place.name);
      expect(evidence.data.evidence.claims.address.value).toBe(place.address);
      expect(evidence.data.evidence.claims.coordinates?.sourceUrl).toBe(
        sourceById.get(place.evidence.coordinates.sourceId)?.url,
      );
      expect(evidence.data.evidence.claims.hours.sourceUrl).toBe(
        sourceById.get(place.evidence.hours.sourceId)?.url,
      );
      expect(evidence.data.evidence.claims.price.sourceUrl).toBe(
        sourceById.get(place.evidence.price.sourceId)?.url,
      );
    }
    for (const sourceId of SHIBUYA_ACTIVE_PACK_V2.station.sourceIds) {
      expect(sourceById.has(sourceId)).toBe(true);
    }
  });

  it("does not expose the removed no-set-hours fixture through the active runtime", () => {
    expect(readPlaceEvidenceV2("nabeshima-shoto-park")).toMatchObject({
      ok: false,
      error: { code: "PLACE_NOT_FOUND" },
    });
  });

  it("honors an already aborted request before composition", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      searchEveningPlanV2(intent, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
