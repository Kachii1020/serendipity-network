import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { PROVIDERS, type Provider } from "@serendipity/contracts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENSITIVE_KEY_PATTERN =
  /(?:token|secret|password|idempotency|rawprompt|servicerole|databaseurl|sql|stack)/i;

const requireSigningSecret = (secret: string): void => {
  if (Buffer.byteLength(secret) < 32) {
    throw new Error("Signing secret must contain at least 32 bytes");
  }
};

const sign = (payload: string, secret: string): string =>
  createHmac("sha256", secret).update(payload).digest("base64url");

const safeEqual = (left: string, right: string): boolean => {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
};

const isProvider = (value: unknown): value is Provider =>
  typeof value === "string" && PROVIDERS.some((provider) => provider === value);

const encodeSignedJson = (value: unknown, secret: string): string => {
  requireSigningSecret(secret);
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
};

const decodeSignedJson = (token: string, secret: string): unknown => {
  requireSigningSecret(secret);
  const segments = token.split(".");
  if (segments.length !== 2) return null;
  const [payload, signature] = segments;
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) {
    return null;
  }
  try {
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as unknown;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const hashSecret = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const secretsEqual = (left: string, right: string): boolean =>
  safeEqual(hashSecret(left), hashSecret(right));

export const createHoldToken = (
  input: { holdId: string; provider: Provider },
  secret: string,
): string => {
  if (!UUID_PATTERN.test(input.holdId))
    throw new Error("holdId must be a UUID");
  requireSigningSecret(secret);
  const payload = Buffer.from(`${input.provider}.${input.holdId}`).toString(
    "base64url",
  );
  return `${payload}.${sign(payload, secret)}`;
};

export const verifyHoldToken = (
  token: string,
  expectedProvider: Provider,
  secret: string,
): { holdId: string; provider: Provider; tokenHash: string } | null => {
  requireSigningSecret(secret);
  const segments = token.split(".");
  if (segments.length !== 2) return null;
  const [payload, signature] = segments;
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) {
    return null;
  }
  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const separator = decoded.indexOf(".");
  const provider = decoded.slice(0, separator);
  const holdId = decoded.slice(separator + 1);
  if (
    separator < 1 ||
    provider !== expectedProvider ||
    !isProvider(provider) ||
    !UUID_PATTERN.test(holdId)
  )
    return null;
  return {
    holdId,
    provider,
    tokenHash: hashSecret(token),
  };
};

export type ScopedAccessTokenClaims = {
  audience: "provider-api";
  browserSessionId: string;
  expiresAt: number;
  provider: Provider;
};

export const createScopedAccessToken = (
  claims: ScopedAccessTokenClaims,
  secret: string,
): string => {
  if (!UUID_PATTERN.test(claims.browserSessionId)) {
    throw new Error("browserSessionId must be a UUID");
  }
  if (!Number.isInteger(claims.expiresAt)) {
    throw new Error("expiresAt must be an integer timestamp");
  }
  return encodeSignedJson({ ...claims, version: 1 }, secret);
};

export const verifyScopedAccessToken = (
  token: string,
  expected: {
    audience: "provider-api";
    now: number;
    provider: Provider;
    secret: string;
  },
): ScopedAccessTokenClaims | null => {
  const decoded = decodeSignedJson(token, expected.secret);
  if (
    !isRecord(decoded) ||
    decoded.version !== 1 ||
    decoded.audience !== expected.audience ||
    decoded.provider !== expected.provider ||
    !isProvider(decoded.provider) ||
    typeof decoded.browserSessionId !== "string" ||
    !UUID_PATTERN.test(decoded.browserSessionId) ||
    typeof decoded.expiresAt !== "number" ||
    !Number.isInteger(decoded.expiresAt) ||
    decoded.expiresAt <= expected.now
  ) {
    return null;
  }
  return {
    audience: "provider-api",
    browserSessionId: decoded.browserSessionId,
    expiresAt: decoded.expiresAt,
    provider: decoded.provider,
  };
};

export const redactSensitiveValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactSensitiveValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key)
        ? "[REDACTED]"
        : redactSensitiveValue(nested),
    ]),
  );
};
