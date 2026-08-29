import { randomUUID } from "node:crypto";

import { PROVIDERS, type Provider } from "@serendipity/contracts";
import { canonicalTravelTimes } from "@serendipity/test-fixtures";

import {
  createHubFailureEnvelope,
  createHubSuccessEnvelope,
} from "../../../../lib/hub-envelope";
import { discoverAndCompose } from "../../../../lib/orchestrator/discover";
import { readHubProviderGatewayEnv } from "../../../../lib/provider-gateways/config";
import { HttpProviderGateway } from "../../../../lib/provider-gateways/http";
import {
  browserSessionCookie,
  readBrowserSession,
  type BrowserSession,
} from "../../../../lib/server/browser-session";

const MAX_BODY_BYTES = 32_768;

export const dynamic = "force-dynamic";

const requestCorrelationId = (request: Request): string => {
  const value = request.headers.get("x-correlation-id")?.trim();
  return value && value.length <= 128 ? value : randomUUID();
};

const response = (
  body: unknown,
  status: number,
  correlationId: string,
  session: BrowserSession,
): Response => {
  const headers = new Headers({
    "cache-control": "no-store",
    "x-correlation-id": correlationId,
  });
  const cookie = browserSessionCookie(session);
  if (cookie) headers.set("set-cookie", cookie);
  return Response.json(body, {
    headers,
    status,
  });
};

export async function POST(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  const browserSession = readBrowserSession(request);
  let environment: ReturnType<typeof readHubProviderGatewayEnv>;
  try {
    environment = readHubProviderGatewayEnv();
  } catch {
    return response(
      createHubFailureEnvelope(
        {
          code: "INTERNAL_ERROR",
          message: "Manual Provider connections are not configured.",
          retryable: false,
        },
        {
          correlationId: () => correlationId,
          origin: new URL(request.url).origin,
        },
      ),
      500,
      correlationId,
      browserSession,
    );
  }
  const envelopeContext = {
    correlationId: () => correlationId,
    origin: environment.hubOrigin,
  };
  const serialized = await request.text();
  if (Buffer.byteLength(serialized) > MAX_BODY_BYTES) {
    return response(
      createHubFailureEnvelope(
        {
          code: "VALIDATION_ERROR",
          message: "The manual search request was too large.",
          retryable: false,
        },
        envelopeContext,
      ),
      400,
      correlationId,
      browserSession,
    );
  }
  let input: unknown;
  try {
    input = JSON.parse(serialized) as unknown;
  } catch {
    return response(
      createHubFailureEnvelope(
        {
          code: "VALIDATION_ERROR",
          message: "The manual search request was not valid JSON.",
          retryable: false,
        },
        envelopeContext,
      ),
      400,
      correlationId,
      browserSession,
    );
  }
  try {
    const gateways = Object.fromEntries(
      PROVIDERS.map((provider) => [
        provider,
        new HttpProviderGateway({
          interserviceSecret: environment.interserviceSecret,
          origin: environment.providerOrigins[provider],
          provider,
        }),
      ]),
    ) as Record<Provider, HttpProviderGateway>;
    const result = await discoverAndCompose(
      input,
      {
        bundleSessionId: randomUUID,
        bundleVersion: 1,
        gateways,
        travelTimes: canonicalTravelTimes,
      },
      request.signal,
    );
    if (!result.ok) {
      const status = ["PROVIDER_OFFLINE", "PROVIDER_TIMEOUT"].includes(
        result.error.code,
      )
        ? 503
        : result.error.code === "NO_VALID_BUNDLE"
          ? 200
          : 400;
      return response(
        createHubFailureEnvelope(result.error, envelopeContext),
        status,
        correlationId,
        browserSession,
      );
    }
    return response(
      createHubSuccessEnvelope(result.data, envelopeContext),
      200,
      correlationId,
      browserSession,
    );
  } catch {
    return response(
      createHubFailureEnvelope(
        {
          code: "INTERNAL_ERROR",
          message: "The manual Provider search could not be completed.",
          retryable: true,
        },
        envelopeContext,
      ),
      500,
      correlationId,
      browserSession,
    );
  }
}
