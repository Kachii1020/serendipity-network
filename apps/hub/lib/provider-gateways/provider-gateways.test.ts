import {
  SCHEMA_VERSION,
  type Provider,
  type ProviderSearchData,
  type ProviderSearchInput,
} from "@serendipity/contracts";
import {
  canonicalIntent,
  canonicalSlotsByProvider,
  canonicalTravelTimes,
} from "@serendipity/test-fixtures";
import type { ModelContextLike, RegisteredTool } from "@serendipity/webmcp";
import { describe, expect, it, vi } from "vitest";

import { createInterserviceHeaders } from "../server/interservice";
import { discoverAndCompose } from "../orchestrator/discover";
import { HttpProviderGateway } from "./http";
import type { ProviderGatewayResult } from "./types";
import { WebMcpProviderGateway } from "./webmcp";

const origin = "https://kiln.test";
const completedAt = "2030-05-17T08:00:00Z";
const searchInput: ProviderSearchInput = {
  schemaVersion: SCHEMA_VERSION,
  startAt: "2030-05-17T18:00:00+09:00",
  endAt: "2030-05-17T22:30:00+09:00",
  maxPriceYen: 5000,
  partySize: 1,
  preferredTags: ["creative"],
  excludedTags: [],
};

const searchData: ProviderSearchData = {
  inventoryAsOf: completedAt,
  provider: "kiln",
  slots: canonicalSlotsByProvider.kiln,
};

const successEnvelope = JSON.stringify({
  schemaVersion: SCHEMA_VERSION,
  ok: true,
  data: searchData,
  meta: {
    correlationId: "gateway-test",
    origin,
    completedAt,
  },
});

const createDocument = (
  tools: readonly RegisteredTool[],
  result = successEnvelope,
) => {
  const context = new EventTarget() as ModelContextLike;
  const getTools = vi.fn(() => Promise.resolve(tools));
  const executeTool = vi.fn<ModelContextLike["executeTool"]>(() =>
    Promise.resolve(result),
  );
  context.getTools = getTools;
  context.executeTool = executeTool;
  context.registerTool = vi.fn(() => undefined);
  return {
    document: { modelContext: context } as unknown as Document,
    executeTool,
    getTools,
  };
};

const expectSuccess = (
  result: ProviderGatewayResult<ProviderSearchData>,
): ProviderSearchData => {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected gateway success");
  return result.data;
};

describe("Provider gateway parity", () => {
  it("returns the same validated public search data over WebMCP and HTTP", async () => {
    const registered: RegisteredTool = {
      description: "Search Kiln",
      inputSchema: {},
      name: "kiln_search_slots",
      origin,
    };
    const { document, getTools } = createDocument([registered]);
    const webmcp = new WebMcpProviderGateway({
      document,
      origin,
      provider: "kiln",
    });

    const fetch = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      void input;
      void init;
      return Promise.resolve(
        new Response(successEnvelope, {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
      );
    });
    const http = new HttpProviderGateway({
      fetch,
      interserviceSecret:
        "gateway-interservice-secret-with-at-least-thirty-two-bytes",
      nonce: () => "nonce-1",
      now: () => 1_900_000_000,
      origin,
      provider: "kiln",
    });

    const [webResult, httpResult] = await Promise.all([
      webmcp.search(searchInput, {}),
      http.search(searchInput, {}),
    ]);

    expect(expectSuccess(webResult)).toEqual(expectSuccess(httpResult));
    expect(getTools).toHaveBeenCalledWith({ fromOrigins: [origin] });
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(`${origin}/api/slots`);
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toMatch(/^Serendipity-HMAC /);
    expect(headers.get("x-serendipity-provider")).toBe("kiln");
  });

  it("applies a five-second internal deadline as PROVIDER_TIMEOUT", async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(
        (input: string | URL | Request, init?: RequestInit) => {
          void input;
          return new Promise<Response>((resolve, reject) => {
            void resolve;
            init?.signal?.addEventListener(
              "abort",
              () => {
                reject(new Error("transport aborted"));
              },
              { once: true },
            );
          });
        },
      );
      const gateway = new HttpProviderGateway({
        fetch,
        interserviceSecret:
          "gateway-interservice-secret-with-at-least-thirty-two-bytes",
        origin,
        provider: "kiln",
      });

      let settled = false;
      const resultPromise = gateway.search(searchInput, {}).then((result) => {
        settled = true;
        return result;
      });
      await vi.advanceTimersByTimeAsync(4_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      await expect(resultPromise).resolves.toMatchObject({
        error: {
          code: "PROVIDER_TIMEOUT",
          provider: "kiln",
          retryable: true,
        },
        failureType: "offline",
        ok: false,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps caller cancellation distinct from the internal deadline", async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(() => new Promise<Response>(() => undefined));
      const gateway = new HttpProviderGateway({
        fetch,
        interserviceSecret:
          "gateway-interservice-secret-with-at-least-thirty-two-bytes",
        origin,
        provider: "kiln",
      });
      const controller = new AbortController();

      const resultPromise = gateway.search(searchInput, {
        signal: controller.signal,
      });
      controller.abort();

      await expect(resultPromise).resolves.toMatchObject({
        error: {
          code: "CANCELLED",
          provider: "kiln",
          retryable: false,
        },
        failureType: "offline",
        ok: false,
      });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails closed on missing, duplicate, or malformed exact-origin tools", async () => {
    const missing = createDocument([
      {
        description: "Wrong origin",
        inputSchema: {},
        name: "kiln_search_slots",
        origin: "https://attacker.test",
      },
    ]);
    const missingGateway = new WebMcpProviderGateway({
      document: missing.document,
      origin,
      provider: "kiln",
    });
    await expect(missingGateway.search(searchInput, {})).resolves.toMatchObject(
      {
        ok: false,
        failureType: "offline",
        error: { code: "TOOL_NOT_FOUND" },
      },
    );

    const duplicate = createDocument([
      {
        description: "First",
        inputSchema: {},
        name: "kiln_search_slots",
        origin,
      },
      {
        description: "Second",
        inputSchema: {},
        name: "kiln_search_slots",
        origin,
      },
    ]);
    const duplicateGateway = new WebMcpProviderGateway({
      document: duplicate.document,
      origin,
      provider: "kiln",
    });
    await expect(
      duplicateGateway.search(searchInput, {}),
    ).resolves.toMatchObject({
      ok: false,
      failureType: "invalid",
      error: { code: "ORIGIN_MISMATCH" },
    });

    const malformed = createDocument(
      [
        {
          description: "Search",
          inputSchema: {},
          name: "kiln_search_slots",
          origin,
        },
      ],
      JSON.stringify({ ok: true, data: { provider: "kiln", slots: [] } }),
    );
    const malformedGateway = new WebMcpProviderGateway({
      document: malformed.document,
      origin,
      provider: "kiln",
    });
    await expect(
      malformedGateway.search(searchInput, {}),
    ).resolves.toMatchObject({
      ok: false,
      failureType: "invalid",
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("rediscovers a WebMCP mutation tool before every execution", async () => {
    const holdData = {
      provider: "kiln",
      holdSafeReference: "30000000-0000-4000-8000-000000000001",
      slotId: "10000000-0000-4000-8000-000000000001",
      status: "HELD",
      expiresAt: "2030-05-17T09:01:30Z",
    } as const;
    const holdEnvelope = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      ok: true,
      data: holdData,
      meta: {
        correlationId: "hold-test",
        origin,
        completedAt,
      },
    });
    const { document, executeTool, getTools } = createDocument(
      [
        {
          description: "Hold",
          inputSchema: {},
          name: "kiln_hold_slot",
          origin,
        },
      ],
      holdEnvelope,
    );
    const gateway = new WebMcpProviderGateway({
      document,
      origin,
      provider: "kiln",
    });
    const input = {
      schemaVersion: SCHEMA_VERSION,
      slotId: holdData.slotId,
      inventoryVersion: "1",
      quantity: 1,
      browserSessionId: "20000000-0000-4000-8000-000000000001",
      clientRequestId: holdData.holdSafeReference,
      idempotencyKey: "hold-idempotency-key-0000001",
    } as const;

    await gateway.hold(input, {});
    await gateway.hold(input, {});

    expect(getTools).toHaveBeenCalledTimes(2);
    const encodedInput = executeTool.mock.calls[0]?.[1];
    if (typeof encodedInput !== "string") {
      throw new Error("expected json-string WebMCP encoding");
    }
    expect(JSON.parse(encodedInput)).not.toHaveProperty("idempotencyKey");
  });

  it("creates signatures compatible with the shared interservice canonical request", () => {
    const secret = "gateway-interservice-secret-with-at-least-thirty-two-bytes";
    const headers = createInterserviceHeaders(
      {
        method: "POST",
        nonce: "nonce-1",
        path: "/api/slots",
        provider: "kiln",
        timestamp: 1_900_000_000,
      },
      secret,
    );
    expect(headers.authorization).toMatch(/^Serendipity-HMAC /);
  });

  it("produces equivalent candidate ordering and public output through both gateway modes", async () => {
    const providers: readonly Provider[] = ["kiln", "nori", "loop"];
    const webGateways = Object.fromEntries(
      providers.map((provider) => {
        const providerOrigin = `https://${provider}.test`;
        const serialized = JSON.stringify({
          schemaVersion: SCHEMA_VERSION,
          ok: true,
          data: {
            inventoryAsOf: completedAt,
            provider,
            slots: canonicalSlotsByProvider[provider],
          },
          meta: {
            correlationId: `web-${provider}`,
            origin: providerOrigin,
            completedAt,
          },
        });
        const source = createDocument(
          [
            {
              description: "Search",
              inputSchema: {},
              name: `${provider}_search_slots`,
              origin: providerOrigin,
            },
          ],
          serialized,
        );
        return [
          provider,
          new WebMcpProviderGateway({
            document: source.document,
            origin: providerOrigin,
            provider,
          }),
        ];
      }),
    ) as Record<Provider, WebMcpProviderGateway>;
    const httpGateways = Object.fromEntries(
      providers.map((provider) => {
        const providerOrigin = `https://${provider}.test`;
        return [
          provider,
          new HttpProviderGateway({
            fetch: () =>
              Promise.resolve(
                Response.json({
                  schemaVersion: SCHEMA_VERSION,
                  ok: true,
                  data: {
                    inventoryAsOf: completedAt,
                    provider,
                    slots: canonicalSlotsByProvider[provider],
                  },
                  meta: {
                    correlationId: `http-${provider}`,
                    origin: providerOrigin,
                    completedAt,
                  },
                }),
              ),
            interserviceSecret:
              "gateway-interservice-secret-with-at-least-thirty-two-bytes",
            origin: providerOrigin,
            provider,
          }),
        ];
      }),
    ) as Record<Provider, HttpProviderGateway>;

    const [webResult, httpResult] = await Promise.all([
      discoverAndCompose(canonicalIntent, {
        bundleSessionId: () => "bundle-session-parity",
        bundleVersion: 1,
        gateways: webGateways,
        travelTimes: canonicalTravelTimes,
      }),
      discoverAndCompose(canonicalIntent, {
        bundleSessionId: () => "bundle-session-parity",
        bundleVersion: 1,
        gateways: httpGateways,
        travelTimes: canonicalTravelTimes,
      }),
    ]);

    expect(webResult).toEqual(httpResult);
  });
});
