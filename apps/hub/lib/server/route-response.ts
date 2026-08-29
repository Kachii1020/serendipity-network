import "server-only";

import type { PublicError } from "@serendipity/contracts";

import {
  createHubFailureEnvelope,
  createHubSuccessEnvelope,
} from "../hub-envelope";
import type { BrowserSession } from "./browser-session";
import { browserSessionCookie } from "./browser-session";

export type RouteResponseContext = {
  correlationId: string;
  hubOrigin: string;
  session?: BrowserSession;
};

const headers = (context: RouteResponseContext): Headers => {
  const value = new Headers({
    "cache-control": "no-store",
    "x-correlation-id": context.correlationId,
  });
  if (context.session) {
    const cookie = browserSessionCookie(context.session);
    if (cookie) value.set("set-cookie", cookie);
  }
  return value;
};

export const routeSuccess = (
  data: unknown,
  context: RouteResponseContext,
): Response =>
  Response.json(
    createHubSuccessEnvelope(data, {
      correlationId: () => context.correlationId,
      origin: context.hubOrigin,
    }),
    { headers: headers(context), status: 200 },
  );

export const routeFailure = (
  error: PublicError,
  status: number,
  context: RouteResponseContext,
): Response =>
  Response.json(
    createHubFailureEnvelope(error, {
      correlationId: () => context.correlationId,
      origin: context.hubOrigin,
    }),
    { headers: headers(context), status },
  );
