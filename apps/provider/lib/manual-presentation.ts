import type { Provider } from "@serendipity/contracts";

import type { ProviderPresentation } from "../app/embed/provider-card-view";

export type ManualPresentationContext = {
  browserSessionId: string;
  frameInstanceId: string;
  hubOrigin: string;
  provider: Provider;
  sourceIsParent: boolean;
};

type BindMessage = {
  browserSessionId: string;
  frameInstanceId: string;
  provider: Provider;
  schemaVersion: "1";
  type: "serendipity.bind-session.v1";
};

export type ProviderPresentationMessage = {
  action: "CONFIRM" | "HOLD" | "RELEASE" | "RESET" | "SEARCH";
  browserSessionId: string;
  correlationId: string;
  expiresAt?: string;
  frameInstanceId: string;
  provider: Provider;
  schemaVersion: "1";
  source: "manual" | "site-tool";
  status:
    "AVAILABLE" | "CONFIRMED" | "ERROR" | "HELD" | "QUERYING" | "RELEASED";
  type: "serendipity.provider-state.v1";
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions = ["SEARCH", "HOLD", "CONFIRM", "RELEASE", "RESET"] as const;
const statuses = [
  "QUERYING",
  "AVAILABLE",
  "HELD",
  "CONFIRMED",
  "RELEASED",
  "ERROR",
] as const;
const sources = ["manual", "site-tool"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const baseMatches = (
  value: Record<string, unknown>,
  context: ManualPresentationContext,
): boolean =>
  context.sourceIsParent &&
  value.schemaVersion === "1" &&
  value.provider === context.provider &&
  value.frameInstanceId === context.frameInstanceId &&
  value.browserSessionId === context.browserSessionId;

export const acceptManualBind = (
  value: unknown,
  eventOrigin: string,
  context: ManualPresentationContext,
): value is BindMessage =>
  eventOrigin === context.hubOrigin &&
  isRecord(value) &&
  value.type === "serendipity.bind-session.v1" &&
  baseMatches(value, context) &&
  Object.keys(value).every((key) =>
    [
      "type",
      "schemaVersion",
      "provider",
      "frameInstanceId",
      "browserSessionId",
    ].includes(key),
  );

export const acceptManualPresentation = (
  value: unknown,
  eventOrigin: string,
  context: ManualPresentationContext,
): ProviderPresentation | null => {
  if (
    eventOrigin !== context.hubOrigin ||
    !isRecord(value) ||
    value.type !== "serendipity.provider-state.v1" ||
    !baseMatches(value, context) ||
    !actions.includes(value.action as (typeof actions)[number]) ||
    !statuses.includes(value.status as (typeof statuses)[number]) ||
    !sources.includes(value.source as (typeof sources)[number]) ||
    typeof value.correlationId !== "string" ||
    value.correlationId.length < 1 ||
    value.correlationId.length > 128 ||
    (value.expiresAt !== undefined && typeof value.expiresAt !== "string") ||
    Object.keys(value).some(
      (key) =>
        ![
          "type",
          "schemaVersion",
          "provider",
          "frameInstanceId",
          "browserSessionId",
          "action",
          "source",
          "status",
          "expiresAt",
          "correlationId",
        ].includes(key),
    )
  ) {
    return null;
  }
  const manualPresentations: Record<
    (typeof statuses)[number],
    ProviderPresentation
  > = {
    AVAILABLE: {
      connectionLabel: "Manual connection",
      latestAction: "Found activities through the manual connection",
      operationLabel: "Found",
    },
    CONFIRMED: {
      connectionLabel: "Manual connection",
      latestAction: "Demo reservation confirmed",
      operationLabel: "Confirmed",
    },
    ERROR: {
      connectionLabel: "Manual connection",
      latestAction: "Manual request needs attention",
      operationLabel: "Needs attention",
    },
    HELD: {
      connectionLabel: "Manual connection",
      latestAction: "Activity held for the current session",
      operationLabel: "Held",
    },
    QUERYING: {
      connectionLabel: "Manual connection",
      latestAction: "Checking through the manual connection",
      operationLabel: "Checking",
    },
    RELEASED: {
      connectionLabel: "Manual connection",
      latestAction: "Hold released",
      operationLabel: "Released",
    },
  };
  const siteToolPresentations: Record<
    (typeof statuses)[number],
    ProviderPresentation
  > = {
    AVAILABLE: {
      connectionLabel: "Live site",
      latestAction: "Hub Site Tool found activities through the Provider API",
      operationLabel: "Found",
    },
    CONFIRMED: {
      connectionLabel: "Live site",
      latestAction: "Hub Site Tool requested Provider API confirmation",
      operationLabel: "Confirmed",
    },
    ERROR: {
      connectionLabel: "Live site",
      latestAction: "Hub Site Tool Provider API request needs attention",
      operationLabel: "Needs attention",
    },
    HELD: {
      connectionLabel: "Live site",
      latestAction: "Hub Site Tool requested a Provider API hold",
      operationLabel: "Held",
    },
    QUERYING: {
      connectionLabel: "Live site",
      latestAction: "Hub Site Tool requested the Provider API",
      operationLabel: "Checking",
    },
    RELEASED: {
      connectionLabel: "Live site",
      latestAction: "Hub Site Tool requested Provider API release",
      operationLabel: "Released",
    },
  };
  const status = value.status as (typeof statuses)[number];
  return value.source === "site-tool"
    ? siteToolPresentations[status]
    : manualPresentations[status];
};

export const createProviderReadyMessage = (
  provider: Provider,
  frameInstanceId: string,
) => {
  if (!UUID_PATTERN.test(frameInstanceId)) {
    throw new Error("frameInstanceId must be a UUID");
  }
  return {
    frameInstanceId,
    provider,
    schemaVersion: "1" as const,
    type: "serendipity.provider-ready.v1" as const,
  };
};
