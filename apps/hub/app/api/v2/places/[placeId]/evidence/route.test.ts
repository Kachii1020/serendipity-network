import { afterEach, describe, expect, it, vi } from "vitest";

import { SHIBUYA_ACTIVE_PACK_V2 } from "../../../../../../data/shibuya-v2";
import { GET } from "./route";

const get = (placeId: string) =>
  GET(
    new Request(
      `https://hub.test/api/v2/places/${encodeURIComponent(placeId)}/evidence`,
    ),
    { params: Promise.resolve({ placeId }) },
  );

describe("GET /api/v2/places/[placeId]/evidence", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns only bundled source evidence with no external fetch", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await get("kyu-asakura-house");
    const body = (await response.json()) as {
      data?: {
        evidence?: {
          claims?: { coordinates?: { sourceUrl?: string } | null };
          sources?: unknown[];
        };
      };
      ok?: boolean;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.ok).toBe(true);
    expect(body.data?.evidence?.sources?.length).toBeGreaterThan(0);
    expect(body.data?.evidence?.claims?.coordinates?.sourceUrl).toMatch(
      /^https:\/\//,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns normalized failures for missing and malformed place IDs", async () => {
    const missing = await get("missing-place");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({
      ok: false,
      error: { code: "PLACE_NOT_FOUND" },
    });

    const malformed = await get("../../secret");
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("does not expose the removed no-set-hours fixture as schedulable evidence", async () => {
    const response = await get("nabeshima-shoto-park");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "PLACE_NOT_FOUND" },
    });
  });

  it("returns STALE_DATA_PACK after the audited pack horizon", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(
      new Date(Date.parse(SHIBUYA_ACTIVE_PACK_V2.validThrough) + 1),
    );
    const response = await get("kyu-asakura-house");

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "STALE_DATA_PACK", retryable: false },
    });
  });
});
