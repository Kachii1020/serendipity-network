import {
  type EveningPlanV2,
  type PlaceEvidenceV2,
  PLANNER_SCHEMA_VERSION,
  PLANNER_TAGS,
  SWAP_PREFERENCES,
  type PlannerIntentV2,
} from "@serendipity/contracts/planner-v2";
import type { ModelContextLike, ToolDefinition } from "@serendipity/webmcp";
import { composeEveningPlan } from "@serendipity/bundle-engine/planner-v2";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  getPlaceEvidenceV2,
  SHIBUYA_ACTIVE_PACK_V2,
} from "../../data/shibuya-v2";
import reviewedClaimLedger from "../../data/shibuya-v2.reviewed-claims.json";

import {
  PLANNER_V2_TOOL_NAMES,
  createPlannerV2ToolDefinitions,
  registerPlannerV2Tools,
  validatePlannerV2EvidenceData,
  validatePlannerV2SearchData,
  validatePlannerV2SwapData,
  type PlannerV2ToolDependencies,
} from "./planner-v2-tools";

const intent: PlannerIntentV2 = {
  schemaVersion: PLANNER_SCHEMA_VERSION,
  area: "shibuya",
  partySize: 1,
  startAt: "2026-08-30T17:00:00+09:00",
  endAt: "2026-08-30T22:00:00+09:00",
  totalBudgetYen: 5_000,
  stopCount: "AUTO",
  maxWalkMinutesPerLeg: 20,
  preferredTags: [PLANNER_TAGS[0], "books", "quiet"],
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
  planId: "plan-1",
} as const;

let realisticPlan: EveningPlanV2;
let realisticEvidence: PlaceEvidenceV2;

const envelope = (data: unknown = { status: "ok" }) => ({
  schemaVersion: PLANNER_SCHEMA_VERSION,
  ok: true as const,
  data,
  meta: {
    correlationId: "correlation-1",
    origin: "https://hub.test",
    completedAt: "2026-08-30T08:00:00.000Z",
    packVersion: SHIBUYA_ACTIVE_PACK_V2.packVersion,
  },
});

const failureEnvelope = () => ({
  schemaVersion: PLANNER_SCHEMA_VERSION,
  ok: false as const,
  error: {
    code: "INTERNAL_ERROR" as const,
    message:
      "The planner source pack is not eligible for route planning. Try again after its evidence audit is complete.",
    retryable: false,
  },
  meta: {
    correlationId: "correlation-ineligible",
    origin: "https://hub.test",
    completedAt: "2026-08-30T08:00:00.000Z",
    packVersion: SHIBUYA_ACTIVE_PACK_V2.packVersion,
  },
});

const actions = () => ({
  deleteSaved: vi.fn(() => envelope({ deleted: true, savedPlanId: "plan-1" })),
  find: vi.fn(() =>
    envelope({
      candidateSetId: realisticPlan.candidateSetId,
      plan: realisticPlan,
      warnings: [],
    }),
  ),
  save: vi.fn(() =>
    envelope({
      savedAt: "2026-08-30T08:00:00.000Z",
      savedPlanId: "plan-1",
      status: "SAVED",
    }),
  ),
  showEvidence: vi.fn(() => envelope({ evidence: realisticEvidence })),
  swap: vi.fn(() =>
    envelope({
      candidateSetId: "candidate-set-1",
      plan: { ...realisticPlan, candidateSetId: "candidate-set-1" },
      preference: SWAP_PREFERENCES[0],
      replacedStopIndex: 0,
      warnings: [],
    }),
  ),
});

const dependencies = (
  overrides: Partial<PlannerV2ToolDependencies> = {},
): PlannerV2ToolDependencies => ({
  ...actions(),
  checkState: () => ({ ok: true }),
  clock: () => new Date("2026-08-30T08:00:00.000Z"),
  correlationId: () => "tool-correlation-1",
  hubOrigin: "https://hub.test",
  packVersion: SHIBUYA_ACTIVE_PACK_V2.packVersion,
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
  beforeAll(async () => {
    const composed = await composeEveningPlan({
      asOf: new Date("2026-08-30T08:00:00.000Z"),
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
      intent,
      reviewedClaims: reviewedClaimLedger,
    });
    if (!composed.ok) throw new Error("Expected realistic planner fixture");
    realisticPlan = composed.plan;
    const placeId = realisticPlan.stops[0]?.place.placeId;
    const evidence = placeId ? getPlaceEvidenceV2(placeId) : null;
    if (!evidence) throw new Error("Expected realistic evidence fixture");
    realisticEvidence = { ...evidence, placeId: evidenceInput.placeId };
  });
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T08:00:00.000Z"));
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

  it("describes one bounded multi-constraint scenario without adding tools", () => {
    const definitions = createPlannerV2ToolDefinitions(dependencies());
    const find = definition(definitions, "find_evening_plan");
    const evidence = definition(definitions, "show_place_evidence");
    const swap = definition(definitions, "swap_plan_stop");

    expect(definitions).toHaveLength(5);
    expect(find.description).toContain("13:00–22:00");
    expect(find.description).toContain("¥8,000");
    expect(find.description).toContain("exclude alcohol and smoking");
    expect(find.description).toContain("within 20 minutes");
    expect(find.description).toContain("no set hours");
    expect(find.description).toContain("unknown mandatory amount is excluded");
    expect(evidence.description).toContain("field-level");
    expect(evidence.description).toContain("coordinates");
    expect(evidence.description).toContain("opening-window");
    expect(swap.description).toContain(
      "rechecking time, total budget, walking",
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

    const impossible = await definition(
      definitions,
      "find_evening_plan",
    ).execute({
      ...intent,
      endAt: "2026-08-32T22:00:00+09:00",
      startAt: "2026-08-32T17:00:00+09:00",
    });
    expect(JSON.parse(impossible)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
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

  it("propagates a pack-ineligible search failure without fabricating success", async () => {
    const find = vi.fn(() => failureEnvelope());
    const definitions = createPlannerV2ToolDefinitions(dependencies({ find }));

    const result = JSON.parse(
      await definition(definitions, "find_evening_plan").execute(intent),
    ) as { error?: { code?: string }; ok?: boolean };
    expect(result).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR" },
    });
    expect(find).toHaveBeenCalledOnce();
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
              clientSecret: "must-not-cross",
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

  it("strips credential fields from malformed failure envelopes", async () => {
    const poisoned = {
      ...failureEnvelope(),
      error: {
        ...failureEnvelope().error,
        authorization: "Bearer must-not-cross",
      },
    };
    const definitions = createPlannerV2ToolDefinitions(
      dependencies({ find: () => poisoned }),
    );

    const result = await definition(definitions, "find_evening_plan").execute(
      intent,
    );
    expect(JSON.parse(result)).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR" },
    });
    expect(result).not.toContain("authorization");
    expect(result).not.toContain("must-not-cross");
  });

  it("validates the success data contract of each tool independently", async () => {
    const definitions = createPlannerV2ToolDefinitions(
      dependencies({
        deleteSaved: () =>
          envelope({ deleted: "yes", savedPlanId: deleteInput.planId }),
        find: () => envelope({ candidateSetId: realisticPlan.candidateSetId }),
        save: () => envelope({ savedPlanId: saveInput.planId }),
        showEvidence: () =>
          envelope({ evidence: { placeId: evidenceInput.placeId } }),
        swap: () =>
          envelope({
            candidateSetId: swapInput.candidateSetId,
            plan: realisticPlan,
            preference: swapInput.preference,
          }),
      }),
    );
    const executions = [
      ["find_evening_plan", intent],
      ["show_place_evidence", evidenceInput],
      ["swap_plan_stop", swapInput],
      ["save_plan", saveInput],
      ["delete_saved_plan", deleteInput],
    ] as const;

    for (const [name, input] of executions) {
      const result = await definition(definitions, name).execute(input);
      expect(JSON.parse(result)).toMatchObject({
        ok: false,
        error: { code: "INTERNAL_ERROR" },
      });
    }
  });

  it("rejects impossible calendar timestamps in every tool output", async () => {
    const impossiblePlan = structuredClone(realisticPlan);
    (impossiblePlan.stops[0] as { startsAt: string }).startsAt =
      "2026-09-31T17:00:00+09:00";
    const impossibleEvidence = structuredClone(realisticEvidence);
    (impossibleEvidence as { evidenceAsOf: string }).evidenceAsOf =
      "2026-09-31T12:00:00+09:00";
    (impossibleEvidence.sources[0] as { checkedAt: string }).checkedAt =
      "2026-09-31T12:00:00+09:00";
    (impossibleEvidence.claims.hours as { checkedAt: string }).checkedAt =
      "2026-09-31T12:00:00+09:00";
    const definitions = createPlannerV2ToolDefinitions(
      dependencies({
        find: () =>
          envelope({
            candidateSetId: impossiblePlan.candidateSetId,
            plan: impossiblePlan,
            warnings: [],
          }),
        save: () =>
          envelope({
            savedAt: "2026-09-31T08:00:00.000Z",
            savedPlanId: saveInput.planId,
            status: "SAVED",
          }),
        showEvidence: () => envelope({ evidence: impossibleEvidence }),
        swap: () =>
          envelope({
            candidateSetId: swapInput.candidateSetId,
            plan: {
              ...impossiblePlan,
              candidateSetId: swapInput.candidateSetId,
            },
            preference: swapInput.preference,
            replacedStopIndex: 0,
            warnings: [],
          }),
      }),
    );

    for (const [name, input] of [
      ["find_evening_plan", intent],
      ["show_place_evidence", evidenceInput],
      ["swap_plan_stop", swapInput],
      ["save_plan", saveInput],
    ] as const) {
      expect(
        JSON.parse(await definition(definitions, name).execute(input)),
      ).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR" } });
    }
  });

  it("requires public-payload safety in exported data validators", () => {
    const searchData = {
      candidateSetId: realisticPlan.candidateSetId,
      plan: realisticPlan,
      warnings: ["<script>unsafe</script>"],
    };
    expect(
      validatePlannerV2SearchData(
        searchData,
        intent,
        SHIBUYA_ACTIVE_PACK_V2.packVersion,
        new Date("2026-08-30T08:00:00.000Z"),
      ),
    ).toBe(false);

    const evidenceData = {
      evidence: {
        ...realisticEvidence,
        claims: {
          ...realisticEvidence.claims,
          hours: {
            ...realisticEvidence.claims.hours,
            value: "<strong>unsafe</strong>",
          },
        },
      },
    };
    expect(
      validatePlannerV2EvidenceData(
        evidenceData,
        evidenceInput.placeId,
        SHIBUYA_ACTIVE_PACK_V2.packVersion,
      ),
    ).toBe(false);

    const swapData = {
      candidateSetId: swapInput.candidateSetId,
      plan: { ...realisticPlan, candidateSetId: swapInput.candidateSetId },
      preference: swapInput.preference,
      replacedStopIndex: 0,
      warnings: ["<img src=x>"],
    };
    expect(
      validatePlannerV2SwapData(
        swapData,
        swapInput,
        SHIBUYA_ACTIVE_PACK_V2.packVersion,
        new Date("2026-08-30T08:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("rejects success data that answers a different compact reference", async () => {
    const definitions = createPlannerV2ToolDefinitions(
      dependencies({
        deleteSaved: () =>
          envelope({ deleted: true, savedPlanId: "different-plan" }),
        save: () =>
          envelope({
            savedAt: "2026-08-30T08:00:00.000Z",
            savedPlanId: "different-plan",
            status: "SAVED",
          }),
        showEvidence: () =>
          envelope({
            evidence: { ...realisticEvidence, placeId: "different-place" },
          }),
      }),
    );

    for (const [name, input] of [
      ["show_place_evidence", evidenceInput],
      ["save_plan", saveInput],
      ["delete_saved_plan", deleteInput],
    ] as const) {
      expect(
        JSON.parse(await definition(definitions, name).execute(input)),
      ).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR" } });
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

  it("rolls back earlier registrations when a later registration throws", () => {
    const registrationSignals: AbortSignal[] = [];
    let callCount = 0;
    const context = Object.assign(new EventTarget(), {
      executeTool: vi.fn<ModelContextLike["executeTool"]>(),
      getTools: vi.fn<ModelContextLike["getTools"]>(() => Promise.resolve([])),
      registerTool: vi.fn<ModelContextLike["registerTool"]>(
        (_tool, options) => {
          callCount += 1;
          if (options?.signal) registrationSignals.push(options.signal);
          if (callCount === 3) throw new Error("registration failed");
        },
      ),
    }) as ModelContextLike;
    const source = { modelContext: context } as unknown as Document;

    expect(() => registerPlannerV2Tools(dependencies(), source)).toThrow(
      "registration failed",
    );
    expect(registrationSignals).toHaveLength(3);
    expect(
      registrationSignals.slice(0, 2).every((signal) => signal.aborted),
    ).toBe(true);
  });
});
