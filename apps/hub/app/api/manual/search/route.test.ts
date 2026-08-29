import {
  SCHEMA_VERSION,
  contractValidators,
  type Provider,
} from "@serendipity/contracts";
import {
  canonicalIntent,
  canonicalSlotsByProvider,
} from "@serendipity/test-fixtures";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const providerFromUrl = (url: string): Provider => {
  const hostname = new URL(url).hostname;
  if (hostname.startsWith("kiln")) return "kiln";
  if (hostname.startsWith("nori")) return "nori";
  return "loop";
};

describe("POST /api/manual/search", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses all three signed HTTP gateways and returns the shared candidate contract", async () => {
    vi.stubEnv("NEXT_PUBLIC_HUB_ORIGIN", "https://hub.test");
    vi.stubEnv(
      "NEXT_PUBLIC_PROVIDER_ORIGINS",
      "https://kiln.test,https://nori.test,https://loop.test",
    );
    vi.stubEnv(
      "HUB_INTERSERVICE_SECRET",
      "manual-route-secret-with-at-least-thirty-two-bytes",
    );
    const fetch = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url =
        input instanceof Request
          ? input.url
          : input instanceof URL
            ? input.href
            : input;
      const provider = providerFromUrl(url);
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toMatch(/^Serendipity-HMAC /);
      expect(headers.get("x-serendipity-provider")).toBe(provider);
      return Promise.resolve(
        Response.json({
          schemaVersion: SCHEMA_VERSION,
          ok: true,
          data: {
            inventoryAsOf: "2030-05-17T08:00:00Z",
            provider,
            slots: canonicalSlotsByProvider[provider],
          },
          meta: {
            completedAt: "2030-05-17T08:00:00Z",
            correlationId: `manual-${provider}`,
            origin: `https://${provider}.test`,
          },
        }),
      );
    });
    vi.stubGlobal("fetch", fetch);

    const result = await POST(
      new Request("https://hub.test/api/manual/search", {
        body: JSON.stringify(canonicalIntent),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    const envelope = (await result.json()) as {
      data?: unknown;
      ok?: boolean;
    };

    expect(result.status).toBe(200);
    expect(envelope.ok).toBe(true);
    expect(contractValidators.findOptionsData(envelope.data)).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("fails closed when the exact three-origin manual mode is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_HUB_ORIGIN", "https://hub.test");
    vi.stubEnv(
      "NEXT_PUBLIC_PROVIDER_ORIGINS",
      "https://kiln.test,https://nori.test",
    );
    vi.stubEnv(
      "HUB_INTERSERVICE_SECRET",
      "manual-route-secret-with-at-least-thirty-two-bytes",
    );

    const result = await POST(
      new Request("https://hub.test/api/manual/search", {
        body: JSON.stringify(canonicalIntent),
        method: "POST",
      }),
    );
    const envelope = (await result.json()) as {
      error?: { code?: string };
      ok?: boolean;
    };

    expect(result.status).toBe(500);
    expect(envelope).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR" },
    });
  });
});
