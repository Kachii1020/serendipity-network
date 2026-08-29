import { describe, expect, it } from "vitest";

import {
  createHoldToken,
  createScopedAccessToken,
  hashSecret,
  redactSensitiveValue,
  verifyHoldToken,
  verifyScopedAccessToken,
} from "./security";
import { readProviderServerEnv } from "./supabase";
import { createUnavailableProviderApi, readProviderApiEnv } from "./runtime";

const holdSecret = "hold-secret-with-at-least-thirty-two-bytes";
const accessSecret = "access-secret-with-at-least-thirty-two-bytes";

describe("Provider server security", () => {
  it("signs deterministic Provider-owned hold tokens and hashes them", () => {
    const token = createHoldToken(
      {
        provider: "kiln",
        holdId: "40000000-0000-4000-8000-000000000001",
      },
      holdSecret,
    );
    expect(
      createHoldToken(
        {
          provider: "kiln",
          holdId: "40000000-0000-4000-8000-000000000001",
        },
        holdSecret,
      ),
    ).toBe(token);
    expect(
      Buffer.from(token.split(".")[0] ?? "", "base64url").toString("utf8"),
    ).toBe("kiln.40000000-0000-4000-8000-000000000001");
    expect(hashSecret(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyHoldToken(token, "kiln", holdSecret)).toEqual({
      provider: "kiln",
      holdId: "40000000-0000-4000-8000-000000000001",
      tokenHash: hashSecret(token),
    });
  });

  it("fails closed for tampering and wrong Provider ownership", () => {
    const token = createHoldToken(
      {
        provider: "nori",
        holdId: "40000000-0000-4000-8000-000000000002",
      },
      holdSecret,
    );
    expect(verifyHoldToken(`${token}x`, "nori", holdSecret)).toBeNull();
    expect(verifyHoldToken(token, "loop", holdSecret)).toBeNull();
  });

  it("verifies short-lived Provider-scoped access tokens", () => {
    const token = createScopedAccessToken(
      {
        audience: "provider-api",
        browserSessionId: "20000000-0000-4000-8000-000000000001",
        expiresAt: 2_000,
        provider: "loop",
      },
      accessSecret,
    );
    expect(
      verifyScopedAccessToken(token, {
        audience: "provider-api",
        now: 1_999,
        provider: "loop",
        secret: accessSecret,
      }),
    ).toMatchObject({ provider: "loop", expiresAt: 2_000 });
    expect(
      verifyScopedAccessToken(token, {
        audience: "provider-api",
        now: 2_000,
        provider: "loop",
        secret: accessSecret,
      }),
    ).toBeNull();
    expect(
      verifyScopedAccessToken(token, {
        audience: "provider-api",
        now: 1_999,
        provider: "kiln",
        secret: accessSecret,
      }),
    ).toBeNull();
  });

  it("redacts nested secret-shaped fields without changing safe facts", () => {
    expect(
      redactSensitiveValue({
        correlationId: "corr-1",
        nested: {
          holdToken: "private",
          idempotencyKey: "private",
          slotCount: 3,
        },
      }),
    ).toEqual({
      correlationId: "corr-1",
      nested: {
        holdToken: "[REDACTED]",
        idempotencyKey: "[REDACTED]",
        slotCount: 3,
      },
    });
  });

  it("reads only explicit server-side Supabase configuration", () => {
    expect(
      readProviderServerEnv({
        SUPABASE_SECRET_KEY: "test-secret",
        SUPABASE_URL: "https://project.supabase.co",
      }),
    ).toEqual({
      secretKey: "test-secret",
      url: "https://project.supabase.co",
    });
    expect(() =>
      readProviderServerEnv({ SUPABASE_URL: "https://x.test" }),
    ).toThrow("SUPABASE_SECRET_KEY");
  });

  it("loads Provider API secrets and requires the operator secret only in demo mode", () => {
    expect(
      readProviderApiEnv({
        DEMO_MODE: "false",
        HOLD_TOKEN_SECRET: holdSecret,
        PROVIDER_ACCESS_TOKEN_SECRET: accessSecret,
        PROVIDER_SLUG: "loop",
      }),
    ).toEqual({
      accessSecret,
      demoMode: false,
      demoOperatorSecret: null,
      holdSecret,
      provider: "loop",
    });
    expect(() =>
      readProviderApiEnv({
        DEMO_MODE: "true",
        HOLD_TOKEN_SECRET: holdSecret,
        PROVIDER_ACCESS_TOKEN_SECRET: accessSecret,
        PROVIDER_SLUG: "kiln",
      }),
    ).toThrow("DEMO_OPERATOR_SECRET");
  });

  it("returns a normalized INTERNAL_ERROR when Provider configuration is unavailable", async () => {
    const correlationId = "provider-config-test";
    const request = new Request("https://kiln.test/api/slots", {
      headers: { "x-correlation-id": correlationId },
      method: "POST",
    });

    const response = await createUnavailableProviderApi().search(request);

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toBe(correlationId);
    expect(await response.json()).toMatchObject({
      error: {
        code: "INTERNAL_ERROR",
        message: "The Provider could not complete the request.",
        retryable: true,
      },
      meta: {
        correlationId,
        origin: "https://kiln.test",
      },
      ok: false,
      schemaVersion: "1",
    });
  });
});
