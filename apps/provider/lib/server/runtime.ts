import "server-only";

import { randomUUID } from "node:crypto";

import {
  PROVIDERS,
  SCHEMA_VERSION,
  contractValidators,
  type Provider,
} from "@serendipity/contracts";

import { createProviderApi } from "./provider-api";
import { createSupabaseProviderDatabase } from "./provider-database";
import { createProviderSupabaseClient } from "./supabase";

type ProviderApi = ReturnType<typeof createProviderApi>;

const requireSecret = (
  source: Record<string, string | undefined>,
  name: string,
): string => {
  const value = source[name]?.trim();
  if (!value || Buffer.byteLength(value) < 32) {
    throw new Error(`${name} must contain at least 32 bytes`);
  }
  return value;
};

const readProvider = (source: Record<string, string | undefined>): Provider => {
  const value = source.PROVIDER_SLUG ?? source.NEXT_PUBLIC_PROVIDER_SLUG;
  for (const provider of PROVIDERS) {
    if (value === provider) return provider;
  }
  throw new Error("PROVIDER_SLUG must be kiln, nori, or loop");
};

export const readProviderApiEnv = (
  source: Record<string, string | undefined> = process.env,
) => {
  const demoMode = source.DEMO_MODE === "true";
  return {
    accessSecret: requireSecret(source, "PROVIDER_ACCESS_TOKEN_SECRET"),
    demoMode,
    demoOperatorSecret: demoMode
      ? requireSecret(source, "DEMO_OPERATOR_SECRET")
      : null,
    holdSecret: requireSecret(source, "HOLD_TOKEN_SECRET"),
    ...(source.HUB_INTERSERVICE_SECRET?.trim()
      ? {
          interserviceSecret: requireSecret(source, "HUB_INTERSERVICE_SECRET"),
        }
      : {}),
    provider: readProvider(source),
  };
};

let providerApi: ProviderApi | undefined;

export const createUnavailableProviderApi = (): ProviderApi => {
  const failure = (request: Request): Promise<Response> => {
    const suppliedCorrelationId = request.headers
      .get("x-correlation-id")
      ?.trim();
    const correlationId =
      suppliedCorrelationId && suppliedCorrelationId.length <= 128
        ? suppliedCorrelationId
        : randomUUID();
    const envelope = {
      error: {
        code: "INTERNAL_ERROR" as const,
        message: "The Provider could not complete the request.",
        retryable: true,
      },
      meta: {
        completedAt: new Date().toISOString(),
        correlationId,
        origin: new URL(request.url).origin,
      },
      ok: false as const,
      schemaVersion: SCHEMA_VERSION,
    };
    if (!contractValidators.failureEnvelope(envelope)) {
      throw new Error("Provider failure envelope violated the shared contract");
    }
    return Promise.resolve(
      Response.json(envelope, {
        headers: {
          "cache-control": "no-store",
          "x-correlation-id": correlationId,
        },
        status: 500,
      }),
    );
  };

  return {
    cancelDemoSlot: failure,
    confirm: failure,
    hold: failure,
    release: failure,
    search: failure,
    status: failure,
  };
};

export const getProviderApi = (): ProviderApi => {
  if (providerApi) return providerApi;
  try {
    const environment = readProviderApiEnv();
    const database = createSupabaseProviderDatabase(
      createProviderSupabaseClient(),
    );
    providerApi = createProviderApi({
      ...environment,
      clock: () => new Date(),
      database,
      uuid: randomUUID,
    });
  } catch {
    console.error("Provider runtime configuration failed");
    providerApi = createUnavailableProviderApi();
  }
  return providerApi;
};
