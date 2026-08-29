import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { Provider } from "@serendipity/contracts";

type InterserviceRequest = {
  method: string;
  nonce: string;
  path: string;
  provider: Provider;
  timestamp: number;
};

const requireSecret = (secret: string): void => {
  if (Buffer.byteLength(secret) < 32) {
    throw new Error("HUB_INTERSERVICE_SECRET must contain at least 32 bytes");
  }
};

const canonicalRequest = (request: InterserviceRequest): string =>
  [
    request.provider,
    request.method.toUpperCase(),
    request.path,
    String(request.timestamp),
    request.nonce,
  ].join("\n");

const sign = (request: InterserviceRequest, secret: string): string =>
  createHmac("sha256", secret)
    .update(canonicalRequest(request))
    .digest("base64url");

export const createHubInterserviceHeaders = (
  request: InterserviceRequest,
  secret: string,
): Record<string, string> => {
  requireSecret(secret);
  return {
    authorization: `Serendipity-HMAC ${sign(request, secret)}`,
    "x-serendipity-nonce": request.nonce,
    "x-serendipity-provider": request.provider,
    "x-serendipity-timestamp": String(request.timestamp),
  };
};

const safeEqual = (left: string, right: string): boolean => {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
};

export const verifyHubInterserviceRequest = (
  request: Request,
  options: {
    maxClockSkewSeconds: number;
    now: number;
    provider: Provider;
    secret: string;
  },
): boolean => {
  requireSecret(options.secret);
  const authorization = request.headers.get("authorization");
  const nonce = request.headers.get("x-serendipity-nonce");
  const provider = request.headers.get("x-serendipity-provider");
  const rawTimestamp = request.headers.get("x-serendipity-timestamp");
  if (
    !authorization?.startsWith("Serendipity-HMAC ") ||
    !nonce ||
    nonce.length > 128 ||
    provider !== options.provider ||
    !rawTimestamp
  ) {
    return false;
  }
  const timestamp = Number(rawTimestamp);
  if (
    !Number.isInteger(timestamp) ||
    Math.abs(options.now - timestamp) > options.maxClockSkewSeconds
  ) {
    return false;
  }
  const expected = sign(
    {
      method: request.method,
      nonce,
      path: new URL(request.url).pathname,
      provider: options.provider,
      timestamp,
    },
    options.secret,
  );
  return safeEqual(authorization.slice("Serendipity-HMAC ".length), expected);
};
