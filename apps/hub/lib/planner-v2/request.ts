import "server-only";

import { randomUUID } from "node:crypto";

export const PLANNER_V2_MAX_REQUEST_BYTES = 16_384;

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export const plannerRequestCorrelationId = (request: Request): string => {
  const candidate = request.headers.get("x-correlation-id")?.trim();
  return candidate && CORRELATION_ID_PATTERN.test(candidate)
    ? candidate
    : randomUUID();
};

export const parsePlannerJson = async (
  request: Request,
): Promise<
  | { ok: true; value: unknown }
  | { ok: false; reason: "INVALID_JSON" | "TOO_LARGE" }
> => {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const bytes = Number(declaredLength);
    if (Number.isFinite(bytes) && bytes > PLANNER_V2_MAX_REQUEST_BYTES) {
      return { ok: false, reason: "TOO_LARGE" };
    }
  }

  const serialized = await request.text();
  if (
    new TextEncoder().encode(serialized).byteLength >
    PLANNER_V2_MAX_REQUEST_BYTES
  ) {
    return { ok: false, reason: "TOO_LARGE" };
  }

  try {
    return { ok: true, value: JSON.parse(serialized) as unknown };
  } catch {
    return { ok: false, reason: "INVALID_JSON" };
  }
};
