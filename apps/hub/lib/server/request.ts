import "server-only";

import { randomUUID } from "node:crypto";

const MAX_BODY_BYTES = 32_768;

export const requestCorrelationId = (request: Request): string => {
  const value = request.headers.get("x-correlation-id")?.trim();
  return value && value.length <= 128 ? value : randomUUID();
};

export const parseBoundedJson = async (
  request: Request,
): Promise<
  | { ok: true; value: unknown }
  | { ok: false; reason: "INVALID_JSON" | "TOO_LARGE" }
> => {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return { ok: false, reason: "TOO_LARGE" };
  }
  const serialized = await request.text();
  if (Buffer.byteLength(serialized) > MAX_BODY_BYTES) {
    return { ok: false, reason: "TOO_LARGE" };
  }
  try {
    return { ok: true, value: JSON.parse(serialized) as unknown };
  } catch {
    return { ok: false, reason: "INVALID_JSON" };
  }
};
