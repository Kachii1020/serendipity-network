import {
  SCHEMA_VERSION,
  confirmBundleInputSchema,
  contractValidators,
  findOptionsInputSchema,
  holdBundleInputSchema,
  releaseBundleInputSchema,
  showBundleInputSchema,
  type PublicError,
} from "@serendipity/contracts";
import { canonicalIntent } from "@serendipity/test-fixtures";
import type { ModelContextLike, ToolDefinition } from "@serendipity/webmcp";
import { describe, expect, it, vi } from "vitest";

import {
  PRODUCT_TOOL_NAMES,
  createProductToolDefinitions,
  registerProductTools,
  type ProductToolDependencies,
} from "./product-tools";

const bundleSelection = {
  schemaVersion: SCHEMA_VERSION,
  bundleSessionId: "bundle-session-1",
  bundleId: "bundle-1",
  bundleVersion: 1,
} as const;

const confirmInput = {
  schemaVersion: SCHEMA_VERSION,
  bundleSessionId: bundleSelection.bundleSessionId,
  bundleHoldId: "bundle-hold-1",
} as const;

const releaseInput = {
  ...confirmInput,
  reason: "USER_CANCELLED" as const,
};

const failureEnvelope = (
  error: PublicError = {
    code: "NO_VALID_BUNDLE",
    message: "No route matched.",
    retryable: true,
  },
) => ({
  schemaVersion: SCHEMA_VERSION,
  ok: false as const,
  error,
  meta: {
    correlationId: "correlation-1",
    origin: "https://hub.test",
    completedAt: "2030-05-17T09:00:00.000Z",
  },
});

const actions = () => ({
  confirmBundle: vi.fn(() => failureEnvelope()),
  findOptions: vi.fn(() => failureEnvelope()),
  holdBundle: vi.fn(() => failureEnvelope()),
  releaseBundle: vi.fn(() => failureEnvelope()),
  showBundle: vi.fn(() => failureEnvelope()),
});

const dependencies = (
  overrides: Partial<ProductToolDependencies> = {},
): ProductToolDependencies => ({
  ...actions(),
  clock: () => new Date("2030-05-17T09:00:00.000Z"),
  correlationId: () => "tool-correlation-1",
  hubOrigin: "https://hub.test",
  ...overrides,
});

const findDefinition = (
  definitions: readonly ToolDefinition[],
  name: string,
): ToolDefinition => {
  const definition = definitions.find((candidate) => candidate.name === name);
  if (!definition) throw new Error(`missing definition: ${name}`);
  return definition;
};

describe("top-level product Site Tools", () => {
  it("exposes exactly two read-only and three mutating shared-contract tools", () => {
    const definitions = createProductToolDefinitions(dependencies());

    expect(definitions.map(({ name }) => name)).toEqual(PRODUCT_TOOL_NAMES);
    expect(definitions.map(({ inputSchema }) => inputSchema)).toEqual([
      findOptionsInputSchema,
      showBundleInputSchema,
      holdBundleInputSchema,
      confirmBundleInputSchema,
      releaseBundleInputSchema,
    ]);
    expect(
      definitions.slice(0, 2).map(({ annotations }) => annotations),
    ).toEqual(
      Array.from({ length: 2 }, () => ({
        readOnlyHint: true,
        untrustedContentHint: true,
      })),
    );
    expect(definitions.slice(2).map(({ annotations }) => annotations)).toEqual(
      Array.from({ length: 3 }, () => ({
        readOnlyHint: false,
        untrustedContentHint: true,
      })),
    );
  });

  it("rejects every invalid input before state or action callbacks", async () => {
    const actionCallbacks = actions();
    const checkState = vi.fn(() => ({ ok: true as const }));
    const definitions = createProductToolDefinitions(
      dependencies({ ...actionCallbacks, checkState }),
    );

    for (const definition of definitions) {
      const result = JSON.parse(await definition.execute({})) as {
        error?: { code?: string };
        ok?: boolean;
      };
      expect(result).toMatchObject({
        error: { code: "VALIDATION_ERROR" },
        ok: false,
      });
      expect(contractValidators.providerResultEnvelope(result)).toBe(true);
    }

    expect(checkState).not.toHaveBeenCalled();
    for (const callback of Object.values(actionCallbacks)) {
      expect(callback).not.toHaveBeenCalled();
    }
  });

  it("fails closed without calling an action when current UI state rejects it", async () => {
    const holdBundle = vi.fn(() => failureEnvelope());
    const definitions = createProductToolDefinitions(
      dependencies({
        checkState: (name) =>
          name === "hold_bundle"
            ? {
                ok: false,
                error: {
                  code: "STALE_BUNDLE",
                  message: "Select a current route before holding.",
                  retryable: false,
                },
              }
            : { ok: true },
        holdBundle,
      }),
    );

    const result = JSON.parse(
      await findDefinition(definitions, "hold_bundle").execute(bundleSelection),
    ) as { error?: { code?: string }; ok?: boolean };

    expect(result).toMatchObject({
      error: { code: "STALE_BUNDLE" },
      ok: false,
    });
    expect(holdBundle).not.toHaveBeenCalled();
  });

  it("propagates the execution signal and preserves valid JSON envelopes", async () => {
    const controller = new AbortController();
    const serialized = JSON.stringify(failureEnvelope());
    const callbacks = {
      confirmBundle: vi.fn(() => serialized),
      findOptions: vi.fn(() => serialized),
      holdBundle: vi.fn(() => serialized),
      releaseBundle: vi.fn(() => serialized),
      showBundle: vi.fn(() => serialized),
    };
    const definitions = createProductToolDefinitions(dependencies(callbacks));
    const executions = [
      ["find_serendipity_options", canonicalIntent, callbacks.findOptions],
      ["show_bundle", bundleSelection, callbacks.showBundle],
      ["hold_bundle", bundleSelection, callbacks.holdBundle],
      ["confirm_bundle", confirmInput, callbacks.confirmBundle],
      ["release_bundle", releaseInput, callbacks.releaseBundle],
    ] as const;

    for (const [name, input, callback] of executions) {
      const result = await findDefinition(definitions, name).execute(input, {
        signal: controller.signal,
      });
      expect(result).toBe(serialized);
      expect(callback).toHaveBeenCalledWith(input, controller.signal);
    }
  });

  it("replaces malformed, semantically invalid, or unsafe action output", async () => {
    const definitions = createProductToolDefinitions(
      dependencies({
        findOptions: () => "not-json",
        holdBundle: () => ({
          ...failureEnvelope(),
          ok: true,
          error: undefined,
          data: { secret: "must-not-cross-the-tool-boundary" },
        }),
        showBundle: () => ({
          ...failureEnvelope(),
          ok: true,
          error: undefined,
          data: {},
        }),
      }),
    );

    const results = await Promise.all([
      findDefinition(definitions, "find_serendipity_options").execute(
        canonicalIntent,
      ),
      findDefinition(definitions, "show_bundle").execute(bundleSelection),
      findDefinition(definitions, "hold_bundle").execute(bundleSelection),
    ]);

    for (const serialized of results) {
      expect(JSON.parse(serialized)).toMatchObject({
        error: { code: "INTERNAL_ERROR" },
        ok: false,
      });
      expect(serialized).not.toContain("must-not-cross-the-tool-boundary");
    }
  });

  it("registers exactly five tools and aborts every registration on disposal", async () => {
    const registrationSignals: AbortSignal[] = [];
    const registerTool = vi.fn<ModelContextLike["registerTool"]>(
      (_definition, options) => {
        if (options?.signal) registrationSignals.push(options.signal);
      },
    );
    const context = Object.assign(new EventTarget(), {
      executeTool: vi.fn<ModelContextLike["executeTool"]>(),
      getTools: vi.fn<ModelContextLike["getTools"]>(() => Promise.resolve([])),
      registerTool,
    }) as ModelContextLike;
    const source = { modelContext: context } as unknown as Document;

    const registration = registerProductTools(dependencies(), source);
    await registration.ready;

    expect(registerTool).toHaveBeenCalledTimes(5);
    expect(
      registerTool.mock.calls.map(([definition]) => definition.name),
    ).toEqual(PRODUCT_TOOL_NAMES);
    expect(registrationSignals).toHaveLength(5);
    expect(registrationSignals.every(({ aborted }) => !aborted)).toBe(true);

    registration.dispose();
    expect(registrationSignals.every(({ aborted }) => aborted)).toBe(true);
  });
});
