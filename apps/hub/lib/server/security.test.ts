import { describe, expect, it } from "vitest";

import {
  decryptHoldToken,
  encryptHoldToken,
  parseBundleEncryptionKey,
} from "./encryption";
import {
  createInterserviceHeaders,
  verifyInterserviceHeaders,
} from "./interservice";
import {
  assertBrowserSessionOwnership,
  createBrowserSessionId,
} from "./session";
import { readHubServerEnv } from "./supabase";

const key = Buffer.alloc(32, 7).toString("base64url");

describe("Hub server security", () => {
  it("encrypts active tokens with contextual AES-256-GCM", () => {
    const context = {
      bundleSessionId: "50000000-0000-4000-8000-000000000001",
      provider: "kiln" as const,
    };
    const one = encryptHoldToken("private-token", key, context);
    const two = encryptHoldToken("private-token", key, context);
    expect(one).not.toBe(two);
    expect(one).not.toContain("private-token");
    expect(decryptHoldToken(one, key, context)).toBe("private-token");
    expect(() =>
      decryptHoldToken(one, key, { ...context, provider: "nori" }),
    ).toThrow();
  });

  it("requires exactly 32 bytes of bundle encryption key material", () => {
    expect(parseBundleEncryptionKey(key)).toHaveLength(32);
    expect(() => parseBundleEncryptionKey("too-short")).toThrow("32 bytes");
  });

  it("creates bounded inter-service credentials without exposing the secret", () => {
    const secret = "interservice-secret-with-at-least-thirty-two-bytes";
    const request = {
      method: "POST",
      nonce: "nonce-1",
      path: "/api/holds",
      provider: "nori" as const,
      timestamp: 2_000,
    };
    const headers = createInterserviceHeaders(request, secret);
    expect(JSON.stringify(headers)).not.toContain(secret);
    expect(
      verifyInterserviceHeaders(headers, {
        ...request,
        maxClockSkewSeconds: 30,
        now: 2_010,
        secret,
      }),
    ).toBe(true);
    expect(
      verifyInterserviceHeaders(headers, {
        ...request,
        maxClockSkewSeconds: 5,
        now: 2_010,
        secret,
      }),
    ).toBe(false);
  });

  it("binds bundle sessions to opaque browser session IDs", () => {
    expect(createBrowserSessionId()).toMatch(/^[0-9a-f-]{36}$/);
    expect(assertBrowserSessionOwnership("session-a", "session-a")).toBe(true);
    expect(assertBrowserSessionOwnership("session-a", "session-b")).toBe(false);
  });

  it("loads Hub-only database and encryption configuration", () => {
    expect(
      readHubServerEnv({
        BUNDLE_ENCRYPTION_KEY: key,
        HUB_INTERSERVICE_SECRET: "interservice-secret",
        SUPABASE_SECRET_KEY: "test-secret",
        SUPABASE_URL: "https://project.supabase.co",
      }),
    ).toEqual({
      bundleEncryptionKey: key,
      interserviceSecret: "interservice-secret",
      secretKey: "test-secret",
      url: "https://project.supabase.co",
    });
  });
});
