import { describe, expect, it } from "vitest";

import {
  canonicalIntent,
  canonicalSlotsByProvider,
  canonicalTravelTimes,
} from "@serendipity/test-fixtures";

import { composeBundles, isBundleFeasible } from "./index";

const cloneSlots = () => structuredClone(canonicalSlotsByProvider);

describe("bundle engine", () => {
  it("BE-001 composes the canonical winner and totals", async () => {
    const result = await composeBundles({
      bundleVersion: 1,
      intent: canonicalIntent,
      slotsByProvider: canonicalSlotsByProvider,
      travelTimes: canonicalTravelTimes,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const winner = result.candidates[0];
    expect(winner?.items.map((item) => item.slot.slotId)).toEqual([
      "kiln.beginner-pottery",
      "nori.seasonal-counter",
      "loop.experimental-listening",
    ]);
    expect(winner?.totalPriceYen).toBe(4500);
    expect(winner?.endsAt).toBe("2030-05-17T22:00:00+09:00");
    expect(winner?.totalTravelMinutes).toBe(38);
    expect(
      winner?.items.map((item) => item.spareGapFromPreviousMinutes),
    ).toEqual([null, 5, 12]);
  });

  it("BE-002 returns no partial bundle when one Provider is empty", async () => {
    const slots = cloneSlots();
    slots.nori = [];
    const result = await composeBundles({
      bundleVersion: 1,
      intent: canonicalIntent,
      slotsByProvider: slots,
      travelTimes: canonicalTravelTimes,
    });
    expect(result).toEqual({ ok: false, code: "NO_VALID_BUNDLE" });
  });

  it("BE-003–010 enforces time, travel, budget, exclusions, and matrix pairs", () => {
    const [kiln] = canonicalSlotsByProvider.kiln;
    const [nori] = canonicalSlotsByProvider.nori;
    const [loop] = canonicalSlotsByProvider.loop;
    expect(kiln && nori && loop).toBeTruthy();
    if (!kiln || !nori || !loop) return;

    expect(
      isBundleFeasible(
        [kiln, { ...nori, startsAt: kiln.endsAt }, loop],
        canonicalIntent,
        canonicalTravelTimes,
      ),
    ).toBe(false);

    expect(
      isBundleFeasible(
        [kiln, { ...nori, startsAt: "2030-05-17T19:35:00+09:00" }, loop],
        canonicalIntent,
        canonicalTravelTimes,
      ),
    ).toBe(true);

    expect(
      isBundleFeasible(
        [kiln, { ...nori, startsAt: "2030-05-17T19:34:00+09:00" }, loop],
        canonicalIntent,
        canonicalTravelTimes,
      ),
    ).toBe(false);

    expect(
      isBundleFeasible(
        [kiln, nori, { ...loop, priceYen: 1700, originalPriceYen: 2000 }],
        canonicalIntent,
        canonicalTravelTimes,
      ),
    ).toBe(true);

    expect(
      isBundleFeasible(
        [kiln, nori, { ...loop, priceYen: 1701, originalPriceYen: 2000 }],
        canonicalIntent,
        canonicalTravelTimes,
      ),
    ).toBe(false);

    expect(
      isBundleFeasible(
        [kiln, nori, loop],
        { ...canonicalIntent, excludedTags: ["food"] },
        canonicalTravelTimes,
      ),
    ).toBe(false);

    expect(isBundleFeasible([kiln, nori, loop], canonicalIntent, {})).toBe(
      false,
    );

    expect(
      isBundleFeasible(
        [{ ...kiln, startsAt: "2030-05-17T17:59:00+09:00" }, nori, loop],
        canonicalIntent,
        canonicalTravelTimes,
      ),
    ).toBe(false);
    expect(
      isBundleFeasible(
        [kiln, nori, { ...loop, endsAt: "2030-05-17T22:31:00+09:00" }],
        canonicalIntent,
        canonicalTravelTimes,
      ),
    ).toBe(false);
  });

  it("BE-011–015 limits, sorts, clamps, and explains deterministically", async () => {
    const result = await composeBundles({
      bundleVersion: 7,
      intent: canonicalIntent,
      slotsByProvider: canonicalSlotsByProvider,
      travelTimes: canonicalTravelTimes,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidates).toHaveLength(3);
    expect(
      result.candidates.every((bundle) => bundle.bundleVersion === 7),
    ).toBe(true);
    for (const candidate of result.candidates) {
      expect(candidate.score).toBeGreaterThanOrEqual(0);
      expect(candidate.score).toBeLessThanOrEqual(100);
      expect(candidate.reasonCodes.length).toBeLessThanOrEqual(3);
      expect(
        Object.values(candidate.scoreBreakdown).every(
          (component) => component >= 0 && component <= 1,
        ),
      ).toBe(true);
    }
    expect(result.candidates[0]?.reasonCodes).toEqual([
      "MATCHES_PREFERENCES",
      "HIGH_NOVELTY",
      "GOOD_VALUE",
    ]);
  });

  it("BE-012 applies price, final-end, then bundle-ID tie-breaks", async () => {
    const canonicalKiln = canonicalSlotsByProvider.kiln[0];
    const canonicalNori = canonicalSlotsByProvider.nori[0];
    const canonicalLoop = canonicalSlotsByProvider.loop[0];
    expect(canonicalKiln && canonicalNori && canonicalLoop).toBeTruthy();
    if (!canonicalKiln || !canonicalNori || !canonicalLoop) return;

    const byPrice = await composeBundles({
      bundleVersion: 1,
      intent: { ...canonicalIntent, totalBudgetYen: 10_000 },
      slotsByProvider: {
        kiln: [
          {
            ...canonicalKiln,
            slotId: "kiln.same-score-expensive",
            priceYen: 2000,
            originalPriceYen: 4000,
          },
          {
            ...canonicalKiln,
            slotId: "kiln.same-score-cheap",
            priceYen: 1000,
            originalPriceYen: 2000,
          },
        ],
        nori: [canonicalNori],
        loop: [canonicalLoop],
      },
      travelTimes: canonicalTravelTimes,
    });
    expect(byPrice.ok && byPrice.candidates[0]?.items[0]?.slot.slotId).toBe(
      "kiln.same-score-cheap",
    );

    const byEnd = await composeBundles({
      bundleVersion: 1,
      intent: canonicalIntent,
      slotsByProvider: {
        kiln: [canonicalKiln],
        nori: [canonicalNori],
        loop: [
          { ...canonicalLoop, slotId: "loop.same-score-late" },
          {
            ...canonicalLoop,
            slotId: "loop.same-score-early",
            startsAt: "2030-05-17T20:55:00+09:00",
            endsAt: "2030-05-17T21:55:00+09:00",
          },
        ],
      },
      travelTimes: canonicalTravelTimes,
    });
    expect(byEnd.ok && byEnd.candidates[0]?.items[2]?.slot.slotId).toBe(
      "loop.same-score-early",
    );

    const byId = await composeBundles({
      bundleVersion: 1,
      intent: canonicalIntent,
      slotsByProvider: {
        kiln: [canonicalKiln],
        nori: [canonicalNori],
        loop: [
          { ...canonicalLoop, slotId: "loop.same-score-id-a" },
          { ...canonicalLoop, slotId: "loop.same-score-id-b" },
        ],
      },
      travelTimes: canonicalTravelTimes,
    });
    expect(byId.ok).toBe(true);
    if (!byId.ok) return;
    const bundleIds = byId.candidates.map(({ bundleId }) => bundleId);
    expect(bundleIds).toEqual([...bundleIds].sort());
  });

  it("BE-014 clamps out-of-range source components", async () => {
    const slots = cloneSlots();
    const kiln = slots.kiln[0];
    const nori = slots.nori[0];
    const loop = slots.loop[0];
    expect(kiln && nori && loop).toBeTruthy();
    if (!kiln || !nori || !loop) return;
    kiln.noveltyScore = 9;
    nori.noveltyScore = -4;
    loop.noveltyScore = 9;
    slots.kiln = [kiln];
    slots.nori = [nori];
    slots.loop = [loop];

    const result = await composeBundles({
      bundleVersion: 1,
      intent: canonicalIntent,
      slotsByProvider: slots,
      travelTimes: canonicalTravelTimes,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidates[0]?.scoreBreakdown.novelty).toBe(1);
    expect(
      Object.values(result.candidates[0]?.scoreBreakdown ?? {}).every(
        (component) => component >= 0 && component <= 1,
      ),
    ).toBe(true);
  });

  it("BE-013 uses a neutral preference score when no tags are requested", async () => {
    const result = await composeBundles({
      bundleVersion: 1,
      intent: { ...canonicalIntent, preferredTags: [] },
      slotsByProvider: canonicalSlotsByProvider,
      travelTimes: canonicalTravelTimes,
    });
    expect(
      result.ok && result.candidates[0]?.scoreBreakdown.preferenceFit,
    ).toBe(0.5);
  });

  it("BE-016 keeps every generated returned bundle feasible", async () => {
    let seed = 0x5eed;
    const random = () => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed / 0x1_0000_0000;
    };

    for (let index = 0; index < 1000; index += 1) {
      const slots = cloneSlots();
      for (const providerSlots of Object.values(slots)) {
        for (const slot of providerSlots) {
          slot.capacityRemaining = random() < 0.15 ? 0 : 1;
          slot.priceYen = Math.floor(random() * 3000);
          slot.originalPriceYen = Math.max(
            slot.priceYen,
            Math.floor(random() * 3500),
          );
        }
      }
      const result = await composeBundles({
        bundleVersion: 1,
        intent: canonicalIntent,
        slotsByProvider: slots,
        travelTimes: canonicalTravelTimes,
      });
      if (!result.ok) continue;
      expect(
        result.candidates.every((bundle) =>
          isBundleFeasible(
            bundle.items.map((item) => item.slot),
            canonicalIntent,
            canonicalTravelTimes,
          ),
        ),
      ).toBe(true);
    }
  });

  it("BE-017 is byte-stable across 20 runs", async () => {
    const snapshots = await Promise.all(
      Array.from({ length: 20 }, () =>
        composeBundles({
          bundleVersion: 1,
          intent: canonicalIntent,
          slotsByProvider: canonicalSlotsByProvider,
          travelTimes: canonicalTravelTimes,
        }),
      ),
    );
    expect(new Set(snapshots.map((value) => JSON.stringify(value))).size).toBe(
      1,
    );
  });
});
