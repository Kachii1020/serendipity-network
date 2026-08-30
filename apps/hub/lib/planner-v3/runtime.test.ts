import { describe, expect, it, vi } from "vitest";

import type {
  PlannerAreaV3,
  PlannerIntentV3,
  SwapPlanInputV3,
} from "@serendipity/contracts/planner-v3";

import { AREA_REGISTRY_V3 } from "../../data/planner-v3";
import type { GooglePlaceEnrichmentV3 } from "./google-places";
import { PlannerV3Runtime } from "./runtime";

const clock = () => new Date("2026-08-30T13:00:00+09:00");
const intent = (area: PlannerAreaV3): PlannerIntentV3 => ({
  schemaVersion: "3",
  area,
  partySize: 2,
  startAt: "2026-08-30T17:00:00+09:00",
  endAt: "2026-08-30T22:00:00+09:00",
  budgetPerPersonYen: 7_000,
  includeMeal: true,
  interestPreset: "SURPRISE",
  maxWalkMinutesPerLeg: 30,
  excludedTags: [],
});

const googleResult = (
  placeId: string,
  status: GooglePlaceEnrichmentV3["status"] = "DISABLED",
): GooglePlaceEnrichmentV3 => ({
  attributions: [],
  checkedAt: "2026-08-30T13:00:00+09:00",
  openForRequestedWindow: status === "ENRICHED" ? true : null,
  placeId,
  status,
});

describe("planner v3 runtime", () => {
  it("builds an official-source route for every hub when Google is disabled", async () => {
    const googleLookup = vi.fn(({ placeId }: { placeId: string }) =>
      Promise.resolve(googleResult(placeId)),
    );
    const runtime = new PlannerV3Runtime({ clock, googleLookup });

    for (const area of ["shibuya", "shinjuku", "ikebukuro"] as const) {
      const result = await runtime.search(intent(area));
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.data.plan.intent.area).toBe(area);
      expect(result.data.plan.stops.map(({ place }) => place.role)).toEqual([
        "ACTIVITY",
        "MEAL",
        "ACTIVITY",
      ]);
      expect(result.data.googleSignals).toEqual([]);
      expect(result.data.plan.totals.perPersonMaxYen).toBeLessThanOrEqual(
        result.data.plan.intent.budgetPerPersonYen,
      );
    }
    expect(googleLookup).toHaveBeenCalledTimes(3);
  });

  it("calls Google only for a selected predeclared meal ID and keeps it nonblocking", async () => {
    const googleLookup = vi.fn(
      (request: { allowedPlaceIds: ReadonlySet<string>; placeId: string }) => {
        expect(request.allowedPlaceIds.has(request.placeId)).toBe(true);
        expect(
          AREA_REGISTRY_V3.shinjuku.pack.places.some(
            ({ googlePlaceId }) => googlePlaceId === request.placeId,
          ),
        ).toBe(true);
        return Promise.resolve({
          ...googleResult(request.placeId, "ENRICHED"),
          attributions: [
            { provider: "Google", providerUri: "https://maps.google.com/" },
          ],
          businessStatus: "OPERATIONAL" as const,
          googleMapsUri: "https://maps.google.com/?cid=1",
        });
      },
    );
    const runtime = new PlannerV3Runtime({ clock, googleLookup });
    const result = await runtime.search(intent("shinjuku"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(googleLookup).toHaveBeenCalledOnce();
    expect(result.data.googleSignals).toHaveLength(1);
    expect(result.data.googleSignals[0]).toMatchObject({
      businessStatus: "OPERATIONAL",
      openNow: true,
    });

    const degraded = new PlannerV3Runtime({
      clock,
      googleLookup: ({ placeId }) =>
        Promise.resolve(googleResult(placeId, "UNAVAILABLE")),
    });
    const fallback = await degraded.search(intent("shinjuku"));
    expect(fallback.ok).toBe(true);
    if (!fallback.ok) return;
    expect(fallback.data.googleSignals).toEqual([]);
    expect(
      fallback.data.warnings.some((warning) =>
        warning.startsWith("GOOGLE_ENRICHMENT_UNAVAILABLE:"),
      ),
    ).toBe(true);
  });

  it("excludes a Google-listed closed meal and recomposes at most three times", async () => {
    const checkedIds: string[] = [];
    const googleLookup = vi.fn(({ placeId }: { placeId: string }) => {
      checkedIds.push(placeId);
      return Promise.resolve({
        ...googleResult(placeId, "ENRICHED"),
        businessStatus:
          checkedIds.length === 1
            ? ("CLOSED_TEMPORARILY" as const)
            : ("OPERATIONAL" as const),
        openForRequestedWindow: checkedIds.length === 1 ? false : true,
      });
    });
    const runtime = new PlannerV3Runtime({ clock, googleLookup });
    const result = await runtime.search(intent("shinjuku"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const selectedMeal = result.data.plan.stops.find(
      ({ place }) => place.role === "MEAL",
    )!;
    expect(selectedMeal.place.googlePlaceId).not.toBe(checkedIds[0]);
    expect(googleLookup.mock.calls.length).toBeLessThanOrEqual(3);
    expect(result.data.warnings).not.toContain(
      `GOOGLE_LISTS_CLOSED:${selectedMeal.place.placeId}`,
    );
  });

  it("supports a stateless same-kind swap", async () => {
    const runtime = new PlannerV3Runtime({
      clock,
      googleLookup: ({ placeId }) => Promise.resolve(googleResult(placeId)),
    });
    const found = await runtime.search(intent("shinjuku"));
    expect(found.ok).toBe(true);
    if (!found.ok) return;

    let swapped: Awaited<ReturnType<PlannerV3Runtime["swap"]>> | undefined;
    for (const stop of found.data.plan.stops) {
      for (const preference of [
        "CHEAPER",
        "LESS_WALKING",
        "DIFFERENT_INTEREST",
      ] as const) {
        const input: SwapPlanInputV3 = {
          schemaVersion: "3",
          candidateSetId: found.data.candidateSetId,
          planId: found.data.plan.planId,
          intent: found.data.plan.intent,
          plan: found.data.plan,
          stopIndex: stop.position,
          preference,
        };
        const candidate = await runtime.swap(input);
        if (candidate.ok) {
          swapped = candidate;
          break;
        }
      }
      if (swapped) break;
    }
    expect(swapped?.ok).toBe(true);
  });

  it("fails a swap safely when Google lists the replacement meal closed", async () => {
    const officialRuntime = new PlannerV3Runtime({
      clock,
      googleLookup: ({ placeId }) => Promise.resolve(googleResult(placeId)),
    });
    const found = await officialRuntime.search(intent("shinjuku"));
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    const meal = found.data.plan.stops.find(
      ({ place }) => place.role === "MEAL",
    )!;
    const googleLookup = vi.fn(({ placeId }: { placeId: string }) =>
      Promise.resolve({
        ...googleResult(placeId, "ENRICHED"),
        businessStatus: "CLOSED_TEMPORARILY" as const,
        openForRequestedWindow: false,
      }),
    );
    const runtime = new PlannerV3Runtime({ clock, googleLookup });
    let result: Awaited<ReturnType<PlannerV3Runtime["swap"]>> | undefined;
    for (const preference of [
      "CHEAPER",
      "LESS_WALKING",
      "DIFFERENT_INTEREST",
    ] as const) {
      const candidate = await runtime.swap({
        schemaVersion: "3",
        candidateSetId: found.data.candidateSetId,
        planId: found.data.plan.planId,
        intent: found.data.plan.intent,
        plan: found.data.plan,
        stopIndex: meal.position,
        preference,
      });
      if (googleLookup.mock.calls.length > 0) {
        result = candidate;
        break;
      }
    }
    expect(googleLookup).toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      error: { code: "NO_REPLACEMENT" },
    });
  });

  it("returns official evidence and adds optional Google context only for reviewed meals", async () => {
    const meal = AREA_REGISTRY_V3.ikebukuro.pack.places.find(
      ({ googlePlaceId, role }) => role === "MEAL" && googlePlaceId !== null,
    )!;
    const googleLookup = vi.fn(({ placeId }: { placeId: string }) =>
      Promise.resolve({
        ...googleResult(placeId, "ENRICHED"),
        businessStatus: "OPERATIONAL" as const,
      }),
    );
    const runtime = new PlannerV3Runtime({ clock, googleLookup });
    const official = await runtime.evidence("ikebukuro", meal.placeId);
    expect(official).toMatchObject({
      ok: true,
      data: { googleSignal: null },
    });
    expect(googleLookup).not.toHaveBeenCalled();

    const startsAt = "2026-08-30T18:00:00+09:00";
    const endsAt = `${new Date(
      Date.parse(startsAt) +
        meal.recommendedVisitMinutes * 60_000 +
        9 * 60 * 60_000,
    )
      .toISOString()
      .slice(0, -1)}+09:00`;
    const enriched = await runtime.evidence("ikebukuro", meal.placeId, {
      startsAt,
      endsAt,
    });
    expect(enriched).toMatchObject({
      ok: true,
      data: { googleSignal: { placeId: meal.placeId } },
    });
    expect(googleLookup).toHaveBeenCalledOnce();
  });
});
