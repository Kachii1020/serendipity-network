import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { Provider } from "@serendipity/contracts";

export type InterserviceRequest = {
  method: string;
  nonce: string;
  path: string;
  provider: Provider;
  timestamp: number;
};

export type InterserviceHeaders = Record<string, string>;

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

const requestSignature = (
  request: InterserviceRequest,
  secret: string,
): string =>
  createHmac("sha256", secret)
    .update(canonicalRequest(request))
    .digest("base64url");

export const createInterserviceHeaders = (
  request: InterserviceRequest,
  secret: string,
): InterserviceHeaders => {
  requireSecret(secret);
  return {
    authorization: `Serendipity-HMAC ${requestSignature(request, secret)}`,
    "x-serendipity-nonce": request.nonce,
    "x-serendipity-provider": request.provider,
    "x-serendipity-timestamp": String(request.timestamp),
  };
};

export const verifyInterserviceHeaders = (
  headers: InterserviceHeaders,
  expected: InterserviceRequest & {
    maxClockSkewSeconds: number;
    now: number;
    secret: string;
  },
): boolean => {
  requireSecret(expected.secret);
  if (
    Math.abs(expected.now - expected.timestamp) >
      expected.maxClockSkewSeconds ||
    headers["x-serendipity-provider"] !== expected.provider ||
    headers["x-serendipity-timestamp"] !== String(expected.timestamp) ||
    headers["x-serendipity-nonce"] !== expected.nonce
  ) {
    return false;
  }
  const signature = headers.authorization?.replace(/^Serendipity-HMAC /, "");
  if (!signature) return false;
  const calculated = requestSignature(expected, expected.secret);
  const receivedBytes = Buffer.from(signature);
  const calculatedBytes = Buffer.from(calculated);
  return (
    receivedBytes.length === calculatedBytes.length &&
    timingSafeEqual(receivedBytes, calculatedBytes)
  );
};
