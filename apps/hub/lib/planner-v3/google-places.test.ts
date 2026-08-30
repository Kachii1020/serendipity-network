import { describe, expect, it, vi } from "vitest";

import { fetchGooglePlaceEnrichmentV3 } from "./google-places";

const base = {
  allowedPlaceIds: new Set(["google-place-1"]),
  apiKey: "test-key",
  clock: () => new Date("2026-08-30T08:00:00.000Z"),
  enabled: true,
  endsAt: "2026-08-30T20:00:00+09:00",
  placeId: "google-place-1",
  startsAt: "2026-08-30T18:00:00+09:00",
} as const;

describe("planner v3 Google Places adapter", () => {
  it("normalizes safe transient JPY enrichment", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            attributions: [
              { provider: "Google", providerUri: "https://maps.google.com/" },
            ],
            businessStatus: "OPERATIONAL",
            currentOpeningHours: {
              periods: [
                {
                  close: { day: 0, hour: 23, minute: 0 },
                  open: { day: 0, hour: 11, minute: 0 },
                },
              ],
            },
            googleMapsUri: "https://maps.google.com/?cid=1",
            id: "google-place-1",
            priceLevel: "PRICE_LEVEL_MODERATE",
            priceRange: {
              endPrice: { currencyCode: "JPY", units: "3000" },
              startPrice: { currencyCode: "JPY", units: "1500" },
            },
          }),
        ),
      ),
    );
    const result = await fetchGooglePlaceEnrichmentV3({ ...base, fetchImpl });
    expect(result).toMatchObject({
      openForRequestedWindow: true,
      placeId: "google-place-1",
      priceRange: {
        endPrice: { currencyCode: "JPY", units: "3000" },
        startPrice: { currencyCode: "JPY", units: "1500" },
      },
      status: "ENRICHED",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("never calls Google for an undeclared ID or disabled integration", async () => {
    const fetchImpl = vi.fn();
    expect(
      await fetchGooglePlaceEnrichmentV3({
        ...base,
        allowedPlaceIds: new Set(),
        fetchImpl,
      }),
    ).toMatchObject({ status: "UNAVAILABLE" });
    expect(
      await fetchGooglePlaceEnrichmentV3({
        ...base,
        enabled: false,
        fetchImpl,
      }),
    ).toMatchObject({ status: "DISABLED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("drops non-JPY and markup-bearing fields", async () => {
    const result = await fetchGooglePlaceEnrichmentV3({
      ...base,
      fetchImpl: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              attributions: [{ provider: "<script>unsafe</script>" }],
              googleMapsUri: "javascript:alert(1)",
              id: "google-place-1",
              priceRange: {
                startPrice: { currencyCode: "USD", units: "10" },
              },
            }),
          ),
        ),
    });
    expect(result).toMatchObject({ attributions: [], status: "ENRICHED" });
    expect(result).not.toHaveProperty("googleMapsUri");
    expect(result).not.toHaveProperty("priceRange");
  });
});
