import {
  PLANNER_SCHEMA_VERSION,
  PLANNER_TAGS,
  SWAP_PREFERENCES,
  type PlannerIntentV2,
} from "@serendipity/contracts/planner-v2";
import type { ModelContextLike, ToolDefinition } from "@serendipity/webmcp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PLANNER_V2_TOOL_NAMES,
  createPlannerV2ToolDefinitions,
  registerPlannerV2Tools,
  type PlannerV2ToolDependencies,
} from "./planner-v2-tools";

const intent: PlannerIntentV2 = {
  schemaVersion: PLANNER_SCHEMA_VERSION,
  area: "shibuya",
  partySize: 1,
  startAt: "2026-08-29T17:00:00+09:00",
  endAt: "2026-08-29T22:00:00+09:00",
  totalBudgetYen: 5_000,
  stopCount: "AUTO",
  maxWalkMinutesPerLeg: 20,
  preferredTags: [PLANNER_TAGS[0]],
  excludedTags: [],
};

const evidenceInput = {
  schemaVersion: PLANNER_SCHEMA_VERSION,
  candidateSetId: "candidate-set-1",
  planId: "plan-1",
  placeId: "place-1",
} as const;

const swapInput = {
  schemaVersion: PLANNER_SCHEMA_VERSION,
  candidateSetId: "candidate-set-1",
  planId: "plan-1",
  targetPlaceId: "place-1",
  preference: SWAP_PREFERENCES[0],
} as const;

const saveInput = {
  schemaVersion: PLANNER_SCHEMA_VERSION,
  candidateSetId: "candidate-set-1",
  planId: "plan-1",
} as const;

const deleteInput = {
  schemaVersion: PLANNER_SCHEMA_VERSION,
  planId: "saved-plan-1",
} as const;

const envelope = (data: unknown = { status: "ok" }) => ({
  schemaVersion: PLANNER_SCHEMA_VERSION,
  ok: true as const,
  data,
  meta: {
    correlationId: "correlation-1",
    origin: "https://hub.test",
    completedAt: "2026-08-29T08:00:00.000Z",
    packVersion: "1.0.0",
  },
});

const actions = () => ({
  deleteSaved: vi.fn(() => envelope({ deleted: true })),
  find: vi.fn(() => envelope({ candidateSetId: "candidate-set-1" })),
  save: vi.fn(() => envelope({ savedPlanId: "saved-plan-1" })),
  showEvidence: vi.fn(() => envelope({ placeId: "place-1" })),
  swap: vi.fn(() => envelope({ planId: "plan-2" })),
});

const dependencies = (
  overrides: Partial<PlannerV2ToolDependencies> = {},
): PlannerV2ToolDependencies => ({
  ...actions(),
  checkState: () => ({ ok: true }),
  clock: () => new Date("2026-08-29T08:00:00.000Z"),
  correlationId: () => "tool-correlation-1",
  hubOrigin: "https://hub.test",
  packVersion: "1.0.0",
  ...overrides,
});

const definition = (
  definitions: readonly ToolDefinition[],
  name: string,
): ToolDefinition => {
  const found = definitions.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing tool definition: ${name}`);
  return found;
};

describe("planner v2 Site Tools", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T08:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes exactly three read-only and two browser-storage mutations", () => {
    const definitions = createPlannerV2ToolDefinitions(dependencies());

    expect(definitions.map(({ name }) => name)).toEqual(PLANNER_V2_TOOL_NAMES);
    expect(
      definitions.slice(0, 3).map(({ annotations }) => annotations),
    ).toEqual(
      Array.from({ length: 3 }, () => ({
        readOnlyHint: true,
        untrustedContentHint: true,
      })),
    );
    expect(definitions.slice(3).map(({ annotations }) => annotations)).toEqual(
      Array.from({ length: 2 }, () => ({
        readOnlyHint: false,
        untrustedContentHint: true,
      })),
    );
  });

  it("rejects invalid and extra input before the state guard or action", async () => {
    const callbacks = actions();
    const checkState = vi.fn(() => ({ ok: true as const }));
    const definitions = createPlannerV2ToolDefinitions(
      dependencies({ ...callbacks, checkState }),
    );

    for (const candidate of definitions) {
      const parsed = JSON.parse(
        await candidate.execute({
          schemaVersion: PLANNER_SCHEMA_VERSION,
          unexpected: true,
        }),
      ) as { error?: { code?: string }; ok?: boolean };
      expect(parsed).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_ERROR" },
      });
    }
    expect(checkState).not.toHaveBeenCalled();
    for (const callback of Object.values(callbacks)) {
      expect(callback).not.toHaveBeenCalled();
    }
  });

  it("fails closed when the current UI state rejects a tool", async () => {
    const find = vi.fn(() => envelope());
    const definitions = createPlannerV2ToolDefinitions(
      dependencies({
        checkState: (name) =>
          name === "find_evening_plan"
            ? {
                ok: false,
                error: {
                  code: "CANCELLED",
                  message: "Another planner operation is active.",
                  retryable: true,
                },
              }
            : { ok: true },
        find,
      }),
    );

    const parsed = JSON.parse(
      await definition(definitions, "find_evening_plan").execute(intent),
    ) as { error?: { code?: string }; ok?: boolean };
    expect(parsed).toMatchObject({
      ok: false,
      error: { code: "CANCELLED" },
    });
    expect(find).not.toHaveBeenCalled();
  });

  it("sanitizes a malformed or private state-guard error", async () => {
    const definitions = createPlannerV2ToolDefinitions(
      dependencies({
        checkState: () =>
          ({
            ok: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Unsafe state detail.",
              retryable: true,
              secret: "must-not-cross",
            },
          }) as unknown as ReturnType<PlannerV2ToolDependencies["checkState"]>,
      }),
    );

    const result = await definition(definitions, "find_evening_plan").execute(
      intent,
    );
    expect(JSON.parse(result)).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR" },
    });
    expect(result).not.toContain("must-not-cross");
    expect(result).not.toContain("Unsafe state detail");
  });

  it("passes compact refs, site-tool provenance, and AbortSignal to shared callbacks", async () => {
    const controller = new AbortController();
    const callbacks = actions();
    const definitions = createPlannerV2ToolDefinitions(dependencies(callbacks));
    const executions = [
      ["find_evening_plan", intent, callbacks.find],
      ["show_place_evidence", evidenceInput, callbacks.showEvidence],
      ["swap_plan_stop", swapInput, callbacks.swap],
      ["save_plan", saveInput, callbacks.save],
      ["delete_saved_plan", deleteInput, callbacks.deleteSaved],
    ] as const;

    for (const [name, input, callback] of executions) {
      const result = await definition(definitions, name).execute(input, {
        signal: controller.signal,
      });
      expect(JSON.parse(result)).toMatchObject({ ok: true });
      expect(callback).toHaveBeenCalledWith(
        input,
        "site-tool",
        controller.signal,
      );
    }
  });

  it("replaces malformed, oversized, and private action output", async () => {
    const definitions = createPlannerV2ToolDefinitions(
      dependencies({
        find: () => "not-json",
        save: () => envelope({ secret: "must-not-cross" }),
        swap: () => envelope({ value: "x".repeat(66_000) }),
      }),
    );

    const results = await Promise.all([
      definition(definitions, "find_evening_plan").execute(intent),
      definition(definitions, "save_plan").execute(saveInput),
      definition(definitions, "swap_plan_stop").execute(swapInput),
    ]);
    for (const result of results) {
      expect(JSON.parse(result)).toMatchObject({
        ok: false,
        error: { code: "INTERNAL_ERROR" },
      });
      expect(result).not.toContain("must-not-cross");
    }
  });

  it("normalizes an aborted shared callback", async () => {
    const controller = new AbortController();
    const definitions = createPlannerV2ToolDefinitions(
      dependencies({
        find: () => {
          throw new DOMException("Aborted", "AbortError");
        },
      }),
    );
    controller.abort();

    const result = await definition(definitions, "find_evening_plan").execute(
      intent,
      { signal: controller.signal },
    );
    expect(JSON.parse(result)).toMatchObject({
      ok: false,
      error: { code: "CANCELLED" },
    });
  });

  it("registers five tools and aborts every registration on disposal", async () => {
    const registrationSignals: AbortSignal[] = [];
    const registerTool = vi.fn<ModelContextLike["registerTool"]>(
      (_tool, options) => {
        if (options?.signal) registrationSignals.push(options.signal);
      },
    );
    const context = Object.assign(new EventTarget(), {
      executeTool: vi.fn<ModelContextLike["executeTool"]>(),
      getTools: vi.fn<ModelContextLike["getTools"]>(() => Promise.resolve([])),
      registerTool,
    }) as ModelContextLike;
    const source = { modelContext: context } as unknown as Document;

    const registration = registerPlannerV2Tools(dependencies(), source);
    await registration.ready;

    expect(registerTool).toHaveBeenCalledTimes(5);
    expect(registerTool.mock.calls.map(([tool]) => tool.name)).toEqual(
      PLANNER_V2_TOOL_NAMES,
    );
    expect(registrationSignals).toHaveLength(5);
    expect(registrationSignals.every((signal) => !signal.aborted)).toBe(true);

    registration.dispose();
    expect(registrationSignals.every((signal) => signal.aborted)).toBe(true);
  });
});
