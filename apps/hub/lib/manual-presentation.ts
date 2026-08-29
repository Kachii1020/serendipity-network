import type { Provider } from "@serendipity/contracts";
import { parseExactOrigin } from "@serendipity/provider-config";

export type ProviderReady = {
  frameInstanceId: string;
  provider: Provider;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const readProviderReady = (
  value: unknown,
  eventOrigin: string,
  expected: { origin: string; provider: Provider },
): ProviderReady | null => {
  if (
    eventOrigin !== parseExactOrigin(expected.origin) ||
    !isRecord(value) ||
    value.type !== "serendipity.provider-ready.v1" ||
    value.schemaVersion !== "1" ||
    value.provider !== expected.provider ||
    typeof value.frameInstanceId !== "string" ||
    !UUID_PATTERN.test(value.frameInstanceId)
  ) {
    return null;
  }
  return {
    frameInstanceId: value.frameInstanceId,
    provider: expected.provider,
  };
};

export const createManualBindMessage = (
  ready: ProviderReady,
  browserSessionId: string,
) => ({
  browserSessionId,
  frameInstanceId: ready.frameInstanceId,
  provider: ready.provider,
  schemaVersion: "1" as const,
  type: "serendipity.bind-session.v1" as const,
});

export const createManualProviderStateMessage = (input: {
  action: "CONFIRM" | "HOLD" | "RELEASE" | "RESET" | "SEARCH";
  browserSessionId: string;
  correlationId: string;
  expiresAt?: string;
  ready: ProviderReady;
  source: "manual" | "site-tool";
  status:
    "AVAILABLE" | "CONFIRMED" | "ERROR" | "HELD" | "QUERYING" | "RELEASED";
}) => ({
  action: input.action,
  browserSessionId: input.browserSessionId,
  correlationId: input.correlationId,
  ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
  frameInstanceId: input.ready.frameInstanceId,
  provider: input.ready.provider,
  schemaVersion: "1" as const,
  source: input.source,
  status: input.status,
  type: "serendipity.provider-state.v1" as const,
});
