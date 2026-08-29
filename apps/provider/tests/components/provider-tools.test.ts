import {
  createProviderToolDefinitions,
  registerProviderTools,
  tokenStorageKey,
  type ProviderToolDependencies,
} from "../../lib/tools/provider-tools";
import type { ModelContextLike, ToolDefinition } from "@serendipity/webmcp";
import { describe, expect, it, vi } from "vitest";

const browserSessionId = "20000000-0000-4000-8000-000000000001";
const clientRequestId = "30000000-0000-4000-8000-000000000001";
const slotId = "10000000-0000-4000-8000-000000000001";
const holdToken = "private-hold-token-with-at-least-32-bytes";

const meta = {
  completedAt: "2030-05-17T09:00:00.000Z",
  correlationId: "50000000-0000-4000-8000-000000000001",
  origin: "http://localhost:3101",
};

const success = (data: unknown, headers?: HeadersInit) =>
  Response.json(
    { data, meta, ok: true, schemaVersion: "1" },
    { ...(headers ? { headers } : {}), status: 200 },
  );

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
};

const dependencies = (
  fetcher: ProviderToolDependencies["fetcher"],
  storage = memoryStorage(),
): ProviderToolDependencies => ({
  accessToken: "provider-page-access-token",
  browserSessionId,
  fetcher,
  now: () => new Date("2030-05-17T09:00:00.000Z"),
  onEvent: vi.fn(),
  origin: "http://localhost:3101",
  provider: "kiln",
  storage,
  uuid: () => "50000000-0000-4000-8000-000000000001",
});

const findTool = (
  definitions: readonly ToolDefinition[],
  name: string,
): ToolDefinition => {
  const definition = definitions.find((candidate) => candidate.name === name);
  if (!definition) throw new Error(`Missing tool ${name}`);
  return definition;
};

describe("Provider WebMCP tools", () => {
  it("PA-010 exposes exactly the five Provider-scoped production tools", () => {
    const definitions = createProviderToolDefinitions(
      dependencies(vi.fn<typeof fetch>()),
    );

    expect(definitions.map(({ name }) => name)).toEqual([
      "kiln_search_slots",
      "kiln_hold_slot",
      "kiln_get_hold_status",
      "kiln_confirm_hold",
      "kiln_release_hold",
    ]);
    expect(definitions.map(({ annotations }) => annotations)).toEqual([
      { readOnlyHint: true, untrustedContentHint: true },
      { readOnlyHint: false, untrustedContentHint: true },
      { readOnlyHint: true, untrustedContentHint: true },
      { readOnlyHint: false, untrustedContentHint: true },
      { readOnlyHint: false, untrustedContentHint: true },
    ]);
  });

  it("PA-010 leaves no duplicate registration after a Strict Mode-style remount", async () => {
    const active = new Set<string>();
    const registerTool = vi.fn(
      (definition: ToolDefinition, options?: { signal?: AbortSignal }) => {
        active.add(definition.name);
        options?.signal?.addEventListener(
          "abort",
          () => active.delete(definition.name),
          { once: true },
        );
      },
    );
    const modelContext = Object.assign(new EventTarget(), {
      executeTool: vi.fn(),
      getTools: vi.fn(),
      registerTool,
    }) as unknown as ModelContextLike;
    const source = { modelContext } as Document;
    const definitions = createProviderToolDefinitions(
      dependencies(vi.fn<typeof fetch>()),
    );

    const first = registerProviderTools(definitions, {
      exposedTo: ["http://localhost:3100"],
      source,
    });
    await first.ready;
    expect(active.size).toBe(5);
    first.dispose();
    expect(active.size).toBe(0);

    const second = registerProviderTools(definitions, {
      exposedTo: ["http://localhost:3100"],
      source,
    });
    await second.ready;
    expect(active.size).toBe(5);
    second.dispose();
    expect(active.size).toBe(0);
    expect(registerTool).toHaveBeenCalledTimes(10);
  });

  it("PA-005 stores the private hold token but returns only the public envelope", async () => {
    const storage = memoryStorage();
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        success({
          holdToken,
          publicResult: {
            expiresAt: "2030-05-17T09:01:30.000Z",
            holdSafeReference: clientRequestId,
            provider: "kiln",
            slotId,
            status: "HELD",
          },
        }),
      ),
    );
    const tool = findTool(
      createProviderToolDefinitions(dependencies(fetcher, storage)),
      "kiln_hold_slot",
    );

    const result = JSON.parse(
      await tool.execute({
        browserSessionId,
        clientRequestId,
        inventoryVersion: "1",
        quantity: 1,
        schemaVersion: "1",
        slotId,
      }),
    ) as Record<string, unknown>;

    expect(JSON.stringify(result)).not.toContain(holdToken);
    expect(result).not.toHaveProperty("data.holdToken");
    const [, request] = fetcher.mock.calls[0] ?? [];
    if (typeof request?.body !== "string") {
      throw new Error("expected serialized private request body");
    }
    const privateBody = JSON.parse(request.body) as Record<string, unknown>;
    expect(privateBody.idempotencyKey).toMatch(/^[a-f0-9]{64}$/);
    await tool.execute({
      browserSessionId,
      clientRequestId,
      inventoryVersion: "1",
      quantity: 1,
      schemaVersion: "1",
      slotId,
    });
    const secondRequest = fetcher.mock.calls[1]?.[1];
    if (typeof secondRequest?.body !== "string") {
      throw new Error("expected replay private request body");
    }
    const replayBody = JSON.parse(secondRequest.body) as Record<
      string,
      unknown
    >;
    expect(replayBody.idempotencyKey).toBe(privateBody.idempotencyKey);
    expect(
      storage.values.get(
        tokenStorageKey("kiln", browserSessionId, clientRequestId),
      ),
    ).toBe(holdToken);
  });

  it("PA-006 recovers an active hold token from a private response header", async () => {
    const storage = memoryStorage();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      success(
        {
          expiresAt: "2030-05-17T09:01:30.000Z",
          holdSafeReference: clientRequestId,
          provider: "kiln",
          slotId,
          status: "HELD",
        },
        { "x-serendipity-recovered-hold-token": holdToken },
      ),
    );
    const tool = findTool(
      createProviderToolDefinitions(dependencies(fetcher, storage)),
      "kiln_get_hold_status",
    );

    const result = await tool.execute({
      browserSessionId,
      clientRequestId,
      schemaVersion: "1",
    });

    expect(result).not.toContain(holdToken);
    expect(
      storage.values.get(
        tokenStorageKey("kiln", browserSessionId, clientRequestId),
      ),
    ).toBe(holdToken);
  });

  it("PA-007 sends the owned token only in the private header and clears it after confirm", async () => {
    const storage = memoryStorage();
    storage.setItem(
      tokenStorageKey("kiln", browserSessionId, clientRequestId),
      holdToken,
    );
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      success({
        confirmedAt: "2030-05-17T09:00:20.000Z",
        holdSafeReference: clientRequestId,
        provider: "kiln",
        reservationRef: "reservation-kiln-001",
        status: "CONFIRMED",
      }),
    );
    const tool = findTool(
      createProviderToolDefinitions(dependencies(fetcher, storage)),
      "kiln_confirm_hold",
    );

    const result = await tool.execute({
      browserSessionId,
      holdSafeReference: clientRequestId,
      schemaVersion: "1",
    });

    const [, request] = fetcher.mock.calls[0] ?? [];
    expect(new Headers(request?.headers).get("x-serendipity-hold-token")).toBe(
      holdToken,
    );
    expect(result).not.toContain(holdToken);
    expect(storage.values.size).toBe(0);
    if (typeof request?.body !== "string") {
      throw new Error("expected serialized private request body");
    }
    const privateBody = JSON.parse(request.body) as Record<string, unknown>;
    expect(privateBody.idempotencyKey).toMatch(/^[a-f0-9]{64}$/);
  });
});
