import { createScopedAccessToken } from "../../lib/server/security";
import { createHubInterserviceHeaders } from "../../lib/server/interservice";
import {
  createProviderApi,
  type ProviderDatabase,
} from "../../lib/server/provider-api";
import type { Slot } from "@serendipity/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const accessSecret = "access-secret-with-at-least-thirty-two-bytes";
const holdSecret = "hold-secret-with-at-least-thirty-two-bytes";
const interserviceSecret = "interservice-secret-with-at-least-thirty-two-bytes";
const browserSessionId = "20000000-0000-4000-8000-000000000001";
const clientRequestId = "30000000-0000-4000-8000-000000000001";
const holdId = "40000000-0000-4000-8000-000000000001";
const slotId = "10000000-0000-4000-8000-000000000001";

const slot: Slot = {
  capacityRemaining: 2,
  category: "workshop",
  endsAt: "2030-05-17T10:15:00Z",
  inventoryVersion: "1",
  location: {
    addressShort: "Shibuya",
    locationId: "kiln.main",
    mapX: 12,
    mapY: 18,
    name: "Kiln Studio",
  },
  noveltyScore: 0.9,
  originalPriceYen: 2500,
  priceYen: 1500,
  provider: "kiln",
  slotId,
  startsAt: "2030-05-17T09:15:00Z",
  tags: ["creative", "hands-on", "beginner"],
  title: "Beginner pottery",
};

const searchInput = {
  schemaVersion: "1",
  startAt: "2030-05-17T09:00:00Z",
  endAt: "2030-05-17T13:30:00Z",
  maxPriceYen: 5000,
  partySize: 1,
  preferredTags: ["creative"],
  excludedTags: [],
} as const;

const holdInput = {
  schemaVersion: "1",
  slotId,
  inventoryVersion: "1",
  quantity: 1,
  browserSessionId,
  clientRequestId,
  idempotencyKey: "create-idempotency-key-0001",
} as const;

const profile = {
  category: "workshop" as const,
  id: "00000000-0000-4000-8000-000000000001",
  provider: "kiln" as const,
};

const createDatabase = (): ProviderDatabase => ({
  cancelDemoSlot: vi.fn(),
  confirmHold: vi.fn(),
  createHold: vi.fn(),
  getHoldStatus: vi.fn(),
  getProviderProfile: vi.fn(),
  releaseHold: vi.fn(),
  searchSlots: vi.fn(),
});

const accessToken = (
  provider: "kiln" | "nori" | "loop" = "kiln",
  expiresAt = 2_000,
): string =>
  createScopedAccessToken(
    {
      audience: "provider-api",
      browserSessionId,
      expiresAt,
      provider,
    },
    accessSecret,
  );

const request = (
  path: string,
  body: unknown,
  options: {
    access?: string | null;
    holdToken?: string;
    interserviceTimestamp?: number;
    operatorSecret?: string;
    origin?: string | null;
  } = {},
): Request => {
  const headers = new Headers({ "content-type": "application/json" });
  const access = options.access === undefined ? accessToken() : options.access;
  if (access) headers.set("authorization", `Bearer ${access}`);
  const origin =
    options.origin === undefined ? "https://kiln.test" : options.origin;
  if (origin) headers.set("origin", origin);
  if (options.holdToken) {
    headers.set("x-serendipity-hold-token", options.holdToken);
  }
  if (options.operatorSecret) {
    headers.set("x-serendipity-operator-secret", options.operatorSecret);
  }
  if (options.interserviceTimestamp !== undefined) {
    headers.delete("authorization");
    headers.delete("origin");
    const signed = createHubInterserviceHeaders(
      {
        method: "POST",
        nonce: "provider-api-test-nonce",
        path,
        provider: "kiln",
        timestamp: options.interserviceTimestamp,
      },
      interserviceSecret,
    );
    for (const [name, value] of Object.entries(signed)) {
      headers.set(name, value);
    }
  }
  return new Request(`https://kiln.test${path}`, {
    body: JSON.stringify(body),
    headers,
    method: "POST",
  });
};

const responseJson = async (
  response: Response,
): Promise<Record<string, unknown>> =>
  (await response.json()) as Record<string, unknown>;

describe("Provider Route Handler boundary", () => {
  let database: ProviderDatabase;

  beforeEach(() => {
    database = createDatabase();
    vi.mocked(database.getProviderProfile).mockResolvedValue(profile);
    vi.mocked(database.searchSlots).mockResolvedValue([slot]);
  });

  const api = (overrides: { demoMode?: boolean; now?: number } = {}) =>
    createProviderApi({
      accessSecret,
      clock: () => new Date((overrides.now ?? 1_000) * 1_000),
      database,
      demoMode: overrides.demoMode ?? false,
      demoOperatorSecret: "operator-secret-with-at-least-thirty-two-bytes",
      holdSecret,
      interserviceSecret,
      provider: "kiln",
      uuid: () => holdId,
    });

  it("accepts a current Hub HMAC request and rejects a stale signature", async () => {
    const accepted = await api().search(
      request("/api/slots", searchInput, { interserviceTimestamp: 1_000 }),
    );
    expect(accepted.status).toBe(200);
    expect(await responseJson(accepted)).toMatchObject({
      ok: true,
      data: { provider: "kiln" },
    });

    vi.mocked(database.searchSlots).mockClear();
    const rejected = await api().search(
      request("/api/slots", searchInput, { interserviceTimestamp: 900 }),
    );
    expect(rejected.status).toBe(401);
    expect(await responseJson(rejected)).toMatchObject({
      ok: false,
      error: { code: "WEBMCP_PERMISSION_DENIED" },
    });
    expect(database.searchSlots).not.toHaveBeenCalled();
  });

  it("PA-002 rejects missing, expired, wrong-Provider, and cross-origin credentials before DB access", async () => {
    const responses = await Promise.all([
      api().search(request("/api/slots", searchInput, { access: null })),
      api({ now: 2_000 }).search(
        request("/api/slots", searchInput, {
          access: accessToken("kiln", 2_000),
        }),
      ),
      api().search(
        request("/api/slots", searchInput, { access: accessToken("nori") }),
      ),
      api().search(
        request("/api/slots", searchInput, { origin: "https://attacker.test" }),
      ),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([401, 403, 403, 403]);
    for (const response of responses) {
      expect(await responseJson(response)).toMatchObject({ ok: false });
    }
    expect(database.getProviderProfile).not.toHaveBeenCalled();
  });

  it("PA-003 rejects malformed input after auth and before DB access", async () => {
    const response = await api().search(
      request("/api/slots", { ...searchInput, partySize: 2 }),
    );
    expect(response.status).toBe(400);
    expect(await responseJson(response)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(database.getProviderProfile).not.toHaveBeenCalled();
  });

  it("PA-001/004 returns validated sorted slots without a mutation call", async () => {
    vi.mocked(database.searchSlots).mockResolvedValue([
      { ...slot, slotId: "10000000-0000-4000-8000-000000000002" },
      slot,
    ]);
    const response = await api().search(request("/api/slots", searchInput));
    const body = await responseJson(response);
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      data: { provider: "kiln" },
    });
    expect(
      (body.data as { slots: Slot[] }).slots.map(({ slotId: id }) => id),
    ).toEqual([slotId, "10000000-0000-4000-8000-000000000002"]);
    expect(database.createHold).not.toHaveBeenCalled();
  });

  it("fails closed when the database adapter produces invalid public data", async () => {
    vi.mocked(database.searchSlots).mockResolvedValue([
      { ...slot, provider: "nori" },
    ]);
    const response = await api().search(request("/api/slots", searchInput));
    expect(response.status).toBe(500);
    expect(await responseJson(response)).toMatchObject({
      error: { code: "INTERNAL_ERROR" },
    });
  });

  it("PA-005 returns the same private token and safe reference on hold replay", async () => {
    vi.mocked(database.createHold).mockResolvedValue({
      errorCode: null,
      expiresAt: "2030-05-17T09:01:30Z",
      holdId,
      inventoryVersion: "2",
      ok: true,
      slotId,
      status: "HELD",
    });

    const first = await api().hold(request("/api/holds", holdInput));
    const second = await api().hold(request("/api/holds", holdInput));
    const firstBody = await responseJson(first);
    const secondBody = await responseJson(second);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(firstBody.data).toEqual(secondBody.data);
    expect(firstBody).toMatchObject({
      data: {
        publicResult: { holdSafeReference: clientRequestId },
      },
    });
    expect((firstBody.data as { holdToken: string }).holdToken).not.toContain(
      holdId,
    );
  });

  it("PA-006 recovers a committed hold by client request ID", async () => {
    vi.mocked(database.getHoldStatus).mockResolvedValue({
      errorCode: null,
      expiresAt: "2030-05-17T09:01:30Z",
      holdId,
      ok: true,
      reservationRef: null,
      slotId,
      status: "HELD",
    });
    const response = await api().status(
      request("/api/holds/status", {
        schemaVersion: "1",
        browserSessionId,
        clientRequestId,
      }),
    );
    expect(response.status).toBe(200);
    expect(
      response.headers.get("x-serendipity-recovered-hold-token"),
    ).toBeTruthy();
    expect(await responseJson(response)).toMatchObject({
      data: { holdSafeReference: clientRequestId, status: "HELD" },
    });
  });

  it("PA-007 confirms with token/reference ownership and reconciles by status", async () => {
    vi.mocked(database.createHold).mockResolvedValue({
      errorCode: null,
      expiresAt: "2030-05-17T09:01:30Z",
      holdId,
      inventoryVersion: "2",
      ok: true,
      slotId,
      status: "HELD",
    });
    vi.mocked(database.getHoldStatus).mockResolvedValue({
      errorCode: null,
      expiresAt: "2030-05-17T09:01:30Z",
      holdId,
      ok: true,
      reservationRef: null,
      slotId,
      status: "HELD",
    });
    vi.mocked(database.confirmHold).mockResolvedValue({
      confirmedAt: "2030-05-17T09:00:20Z",
      errorCode: null,
      holdId,
      ok: true,
      reservationRef: "RSV-KILN-4000",
      status: "CONFIRMED",
    });
    const holdResponse = await api().hold(request("/api/holds", holdInput));
    const holdBody = await responseJson(holdResponse);
    const holdToken = (holdBody.data as { holdToken?: string }).holdToken;
    if (!holdToken) throw new Error("hold token should be returned privately");

    const response = await api().confirm(
      request(
        `/api/holds/${clientRequestId}/confirm`,
        {
          schemaVersion: "1",
          browserSessionId,
          holdSafeReference: clientRequestId,
          idempotencyKey: "confirm-idempotency-key-001",
        },
        { holdToken },
      ),
      clientRequestId,
    );
    expect(response.status).toBe(200);
    expect(await responseJson(response)).toMatchObject({
      data: { status: "CONFIRMED", reservationRef: "RSV-KILN-4000" },
    });
    expect(database.getHoldStatus).toHaveBeenCalledTimes(2);
  });

  it("PA-008 makes release terminal replay visible without duplicate restoration", async () => {
    vi.mocked(database.getHoldStatus).mockResolvedValue({
      errorCode: null,
      expiresAt: "2030-05-17T09:01:30Z",
      holdId,
      ok: true,
      reservationRef: null,
      slotId,
      status: "HELD",
    });
    vi.mocked(database.releaseHold)
      .mockResolvedValueOnce({
        capacityRestored: true,
        errorCode: null,
        holdId,
        ok: true,
        slotId,
        status: "RELEASED",
      })
      .mockResolvedValueOnce({
        capacityRestored: false,
        errorCode: null,
        holdId,
        ok: true,
        slotId,
        status: "RELEASED",
      });
    vi.mocked(database.createHold).mockResolvedValue({
      errorCode: null,
      expiresAt: "2030-05-17T09:01:30Z",
      holdId,
      inventoryVersion: "2",
      ok: true,
      slotId,
      status: "HELD",
    });
    const held = await responseJson(
      await api().hold(request("/api/holds", holdInput)),
    );
    const holdToken = (held.data as { holdToken?: string }).holdToken;
    if (!holdToken) throw new Error("hold token should be returned privately");
    const releaseRequest = () =>
      request(
        `/api/holds/${clientRequestId}/release`,
        {
          schemaVersion: "1",
          browserSessionId,
          holdSafeReference: clientRequestId,
          idempotencyKey: "release-idempotency-key-001",
          reason: "USER_CANCELLED",
        },
        { holdToken },
      );

    const first = await api().release(releaseRequest(), clientRequestId);
    const second = await api().release(releaseRequest(), clientRequestId);
    expect(await responseJson(first)).toMatchObject({
      data: { capacityRestored: true, status: "RELEASED" },
    });
    expect(await responseJson(second)).toMatchObject({
      data: { capacityRestored: false, status: "RELEASED" },
    });
  });

  it("PA-013 hides demo cancellation when disabled and protects enabled replay", async () => {
    vi.mocked(database.cancelDemoSlot).mockResolvedValue({
      errorCode: null,
      inventoryVersion: "2",
      ok: true,
      status: "CANCELLED",
    });
    const body = { schemaVersion: "1", slotId };

    const hidden = await api().cancelDemoSlot(
      request("/api/demo/cancel-slot", body),
    );
    const forbidden = await api({ demoMode: true }).cancelDemoSlot(
      request("/api/demo/cancel-slot", body, { operatorSecret: "wrong" }),
    );
    const first = await api({ demoMode: true }).cancelDemoSlot(
      request("/api/demo/cancel-slot", body, {
        operatorSecret: "operator-secret-with-at-least-thirty-two-bytes",
      }),
    );
    const second = await api({ demoMode: true }).cancelDemoSlot(
      request("/api/demo/cancel-slot", body, {
        operatorSecret: "operator-secret-with-at-least-thirty-two-bytes",
      }),
    );

    expect(hidden.status).toBe(404);
    expect(forbidden.status).toBe(403);
    expect(first.status).toBe(200);
    expect(await responseJson(second)).toMatchObject({
      data: { inventoryVersion: "2", status: "CANCELLED" },
    });
    expect(database.cancelDemoSlot).toHaveBeenCalledTimes(2);
  });
});
