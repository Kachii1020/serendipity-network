import {
  PROVIDERS,
  SCHEMA_VERSION,
  contractValidators,
  type Provider,
} from "@serendipity/contracts";
import {
  canonicalIntent,
  canonicalSlotsByProvider,
  canonicalTravelTimes,
} from "@serendipity/test-fixtures";
import type { ToolDefinition } from "@serendipity/webmcp";
import { describe, expect, it, vi } from "vitest";

import { createProviderToolDefinitions } from "../../../provider/lib/tools/provider-tools";
import { CandidateSessionStore } from "../../lib/selection";
import { createDirectHubToolDefinitions } from "../../lib/tools/direct/direct-tools";
import { DirectWorkflowStore } from "../../lib/tools/direct/workflow-store";

const origins: Record<Provider, string> = {
  kiln: "https://kiln.test",
  nori: "https://nori.test",
  loop: "https://loop.test",
};

const privateToken = (provider: Provider) =>
  `private-hold-token-${provider}-with-at-least-32-bytes`;

type Operation = {
  input: Record<string, unknown>;
  provider: Provider;
  toolName: string;
};

type Envelope = {
  data?: Record<string, unknown>;
  ok: boolean;
};

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
};

const find = (tools: readonly ToolDefinition[], name: string) => {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing ${name}`);
  return tool;
};

const invoke = async (
  tools: readonly ToolDefinition[],
  name: string,
  input: unknown,
): Promise<Envelope> =>
  JSON.parse(await find(tools, name).execute(input)) as Envelope;

const dataOf = (envelope: Envelope): Record<string, unknown> => {
  if (!envelope.ok || !envelope.data) throw new Error("expected success data");
  return envelope.data;
};

const operationsOf = (envelope: Envelope): Operation[] => {
  const operations = dataOf(envelope).operations;
  if (!Array.isArray(operations)) throw new Error("expected operations");
  return operations as Operation[];
};

const createProvider = (provider: Provider) => {
  const origin = origins[provider];
  const storage = memoryStorage();
  const privateBodies: Record<string, unknown>[] = [];
  const fetcher = vi.fn<typeof fetch>((request, init) => {
    const url = new URL(request instanceof Request ? request.url : request);
    const body =
      typeof init?.body === "string"
        ? (JSON.parse(init.body) as Record<string, unknown>)
        : {};
    const meta = {
      completedAt: "2030-05-17T09:00:00Z",
      correlationId: `provider-${provider}`,
      origin,
    };
    if (url.pathname === "/api/slots") {
      return Promise.resolve(
        Response.json({
          data: {
            inventoryAsOf: "2030-05-17T08:59:00Z",
            provider,
            slots: canonicalSlotsByProvider[provider],
          },
          meta,
          ok: true,
          schemaVersion: SCHEMA_VERSION,
        }),
      );
    }
    privateBodies.push(body);
    if (url.pathname === "/api/holds") {
      const clientRequestId = String(body.clientRequestId);
      const slotId = String(body.slotId);
      return Promise.resolve(
        Response.json({
          data: {
            holdToken: privateToken(provider),
            publicResult: {
              expiresAt: "2030-05-17T09:01:30Z",
              holdSafeReference: clientRequestId,
              provider,
              slotId,
              status: "HELD",
            },
          },
          meta,
          ok: true,
          schemaVersion: SCHEMA_VERSION,
        }),
      );
    }
    if (url.pathname.endsWith("/confirm")) {
      const parts = url.pathname.split("/");
      const holdSafeReference = decodeURIComponent(parts[3] ?? "");
      expect(new Headers(init?.headers).get("x-serendipity-hold-token")).toBe(
        privateToken(provider),
      );
      return Promise.resolve(
        Response.json({
          data: {
            confirmedAt: "2030-05-17T09:00:20Z",
            holdSafeReference,
            provider,
            reservationRef: `reservation-${provider}`,
            status: "CONFIRMED",
          },
          meta,
          ok: true,
          schemaVersion: SCHEMA_VERSION,
        }),
      );
    }
    throw new Error(`unexpected Provider request ${url.pathname}`);
  });
  const tools = createProviderToolDefinitions({
    accessToken: `page-access-${provider}`,
    browserSessionId: "browser-direct-e2e",
    fetcher,
    now: () => new Date("2030-05-17T09:00:00Z"),
    onEvent: vi.fn(),
    origin,
    provider,
    storage,
    uuid: () => `correlation-${provider}`,
  });
  return { privateBodies, storage, tools };
};

describe("direct-mode in-process E2E", () => {
  it("T067 executes Provider tools explicitly while Hub coordinates a secret-free receipt", async () => {
    const providers = Object.fromEntries(
      PROVIDERS.map((provider) => [provider, createProvider(provider)]),
    ) as Record<Provider, ReturnType<typeof createProvider>>;
    const hubTools = createDirectHubToolDefinitions({
      browserSessionId: "browser-direct-e2e",
      bundleHoldId: () => "bundle-hold-direct-e2e",
      bundleSessionId: () => "bundle-session-direct-e2e",
      bundleVersion: 1,
      candidates: new CandidateSessionStore(),
      clientRequestId: (provider) => `hold-request-${provider}`,
      clock: () => new Date("2030-05-17T09:00:00Z"),
      correlationId: () => "hub-correlation-direct-e2e",
      expectedOrigins: origins,
      hubOrigin: "https://hub.test",
      now: () => new Date("2030-05-17T09:00:20Z"),
      travelTimes: canonicalTravelTimes,
      workflows: new DirectWorkflowStore(),
    });

    const searchInput = {
      endAt: canonicalIntent.endAt,
      excludedTags: canonicalIntent.excludedTags,
      maxPriceYen: canonicalIntent.totalBudgetYen,
      partySize: canonicalIntent.partySize,
      preferredTags: canonicalIntent.preferredTags,
      schemaVersion: SCHEMA_VERSION,
      startAt: canonicalIntent.startAt,
    };
    const searchResults = await Promise.all(
      PROVIDERS.map(async (provider) => ({
        provider,
        result: JSON.parse(
          await find(
            providers[provider].tools,
            `${provider}_search_slots`,
          ).execute(searchInput),
        ) as unknown,
      })),
    );
    const composed = await invoke(hubTools, "hub_compose_provider_results", {
      intent: canonicalIntent,
      providerResults: searchResults,
      schemaVersion: SCHEMA_VERSION,
    });
    const composedData = dataOf(composed);
    const selected = composedData.selectedBundle as {
      bundleId: string;
      bundleVersion: number;
    };

    const holdPlan = await invoke(hubTools, "hub_prepare_bundle_hold", {
      bundleId: selected.bundleId,
      bundleSessionId: composedData.bundleSessionId,
      bundleVersion: selected.bundleVersion,
      schemaVersion: SCHEMA_VERSION,
    });
    const holdOperations = operationsOf(holdPlan);
    expect(JSON.stringify(holdPlan)).not.toMatch(/idempotencyKey|holdToken/i);
    const providerHoldResults = await Promise.all(
      holdOperations.map(async (operation) => ({
        provider: operation.provider,
        result: JSON.parse(
          await find(
            providers[operation.provider].tools,
            operation.toolName,
          ).execute(operation.input),
        ) as unknown,
      })),
    );
    const held = await invoke(hubTools, "hub_record_bundle_hold_results", {
      bundleHoldId: dataOf(holdPlan).bundleHoldId,
      bundleSessionId: composedData.bundleSessionId,
      providerResults: providerHoldResults,
      schemaVersion: SCHEMA_VERSION,
    });
    expect(dataOf(held).status).toBe("HELD");

    const confirmPlan = await invoke(
      hubTools,
      "hub_prepare_bundle_confirmation",
      {
        bundleHoldId: dataOf(holdPlan).bundleHoldId,
        bundleSessionId: composedData.bundleSessionId,
        schemaVersion: SCHEMA_VERSION,
      },
    );
    const providerConfirmResults = await Promise.all(
      operationsOf(confirmPlan).map(async (operation) => ({
        provider: operation.provider,
        result: JSON.parse(
          await find(
            providers[operation.provider].tools,
            operation.toolName,
          ).execute(operation.input),
        ) as unknown,
      })),
    );
    const confirmed = await invoke(
      hubTools,
      "hub_record_confirmation_results",
      {
        bundleHoldId: dataOf(holdPlan).bundleHoldId,
        bundleSessionId: composedData.bundleSessionId,
        providerResults: providerConfirmResults,
        schemaVersion: SCHEMA_VERSION,
      },
    );
    const receipt = dataOf(confirmed);
    expect(receipt.status).toBe("CONFIRMED");
    expect(receipt.reservations).toHaveLength(3);
    expect(contractValidators.confirmBundleData(receipt)).toBe(true);
    expect(JSON.stringify(confirmed)).not.toMatch(/idempotencyKey|holdToken/i);

    for (const provider of PROVIDERS) {
      expect(providers[provider].storage.values.size).toBe(0);
      expect(
        providers[provider].privateBodies.every((body) =>
          Object.hasOwn(body, "idempotencyKey"),
        ),
      ).toBe(true);
    }
  });
});
