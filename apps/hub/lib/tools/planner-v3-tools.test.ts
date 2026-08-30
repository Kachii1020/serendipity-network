import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PlaceEvidenceDataV3,
  PlannerEnvelopeV3,
  PlannerIntentV3,
  SearchPlansDataV3,
  SwapPlanDataV3,
} from "@serendipity/contracts/planner-v3";
import type { ModelContextLike, ToolDefinition } from "@serendipity/webmcp";

import { AREA_REGISTRY_V3 } from "../../data/planner-v3";
import type { GooglePlaceEnrichmentV3 } from "../planner-v3/google-places";
import { PlannerV3Runtime } from "../planner-v3/runtime";
import {
  PLANNER_V3_TOOL_NAMES,
  createPlannerV3ToolDefinitions,
  registerPlannerV3Tools,
  validatePlannerV3EvidenceData,
  validatePlannerV3SearchData,
  validatePlannerV3SwapData,
  type PlannerV3ToolDependencies,
  type ShowPlaceEvidenceToolInputV3,
  type SwapPlanStopToolInputV3,
} from "./planner-v3-tools";

const intent: PlannerIntentV3 = {
  schemaVersion: "3",
  area: "shinjuku",
  partySize: 2,
  startAt: "2026-08-30T17:00:00+09:00",
  endAt: "2026-08-30T22:00:00+09:00",
  budgetPerPersonYen: 7_000,
  includeMeal: true,
  interestPreset: "SURPRISE",
  maxWalkMinutesPerLeg: 30,
  excludedTags: [],
};
const packVersion = AREA_REGISTRY_V3.shinjuku.pack.packVersion;

let searchData: SearchPlansDataV3;
let evidenceData: PlaceEvidenceDataV3;
let swapData: SwapPlanDataV3;
let evidenceInput: ShowPlaceEvidenceToolInputV3;
let swapInput: SwapPlanStopToolInputV3;

const googleDisabled = ({
  placeId,
}: {
  placeId: string;
}): Promise<GooglePlaceEnrichmentV3> =>
  Promise.resolve({
    attributions: [],
    checkedAt: "2026-08-30T08:00:00.000Z",
    openForRequestedWindow: null,
    placeId,
    status: "DISABLED",
  });

const envelope = <T>(data: T): PlannerEnvelopeV3<T> => ({
  schemaVersion: "3",
  ok: true,
  data,
  meta: {
    correlationId: "tool-result-1",
    origin: "https://hub.test",
    completedAt: "2026-08-30T08:00:00.000Z",
    packVersion,
    area: "shinjuku",
  },
});

const actions = () => ({
  deleteSaved: vi.fn(() => envelope({ deleted: true, savedPlanId: "plan-1" })),
  find: vi.fn(() => envelope(searchData)),
  save: vi.fn(() =>
    envelope({
      savedAt: "2026-08-30T08:00:00.000Z",
      savedPlanId: searchData.plan.planId,
      status: "SAVED",
    }),
  ),
  showEvidence: vi.fn(() => envelope(evidenceData)),
  swap: vi.fn(() => envelope(swapData)),
});

const dependencies = (
  overrides: Partial<PlannerV3ToolDependencies> = {},
): PlannerV3ToolDependencies => ({
  ...actions(),
  checkState: () => ({ ok: true }),
  clock: () => new Date("2026-08-30T08:00:00.000Z"),
  context: () => ({ area: "shinjuku", packVersion }),
  correlationId: () => "tool-failure-1",
  hubOrigin: "https://hub.test",
  ...overrides,
});

const findDefinition = (
  definitions: readonly ToolDefinition[],
  name: string,
): ToolDefinition => {
  const found = definitions.find((definition) => definition.name === name);
  if (!found) throw new Error(`Missing tool: ${name}`);
  return found;
};

describe("planner v3 Site Tools", () => {
  beforeAll(async () => {
    const runtime = new PlannerV3Runtime({
      clock: () => new Date("2026-08-30T13:00:00+09:00"),
      googleLookup: googleDisabled,
    });
    const found = await runtime.search(intent);
    if (!found.ok) throw new Error("Expected v3 search fixture");
    searchData = found.data;
    const first = searchData.plan.stops[0]!;
    const evidence = await runtime.evidence("shinjuku", first.place.placeId);
    if (!evidence.ok) throw new Error("Expected v3 evidence fixture");
    evidenceData = evidence.data;
    evidenceInput = {
      schemaVersion: "3",
      area: "shinjuku",
      candidateSetId: searchData.candidateSetId,
      planId: searchData.plan.planId,
      placeId: first.place.placeId,
    };
    swapInput = {
      schemaVersion: "3",
      candidateSetId: searchData.candidateSetId,
      planId: searchData.plan.planId,
      targetPlaceId: first.place.placeId,
      preference: "DIFFERENT_INTEREST",
    };
    swapData = {
      candidateSetId: searchData.candidateSetId,
      plan: searchData.plan,
      replacedStopIndex: 0,
      preference: "DIFFERENT_INTEREST",
      warnings: [],
      googleSignals: [],
    };
  });

  beforeEach(() => vi.clearAllMocks());

  it("exports strict pre-projection validators", () => {
    expect(
      validatePlannerV3SearchData(searchData, intent, "shinjuku", packVersion),
    ).toBe(true);
    expect(
      validatePlannerV3EvidenceData(
        evidenceData,
        "shinjuku",
        evidenceInput.placeId,
        packVersion,
      ),
    ).toBe(true);
    expect(
      validatePlannerV3SwapData(swapData, swapInput, "shinjuku", packVersion),
    ).toBe(true);

    expect(
      validatePlannerV3SearchData(
        { ...searchData, warnings: ["<script>unsafe</script>"] },
        intent,
        "shinjuku",
        packVersion,
      ),
    ).toBe(false);
    expect(
      validatePlannerV3EvidenceData(
        {
          ...evidenceData,
          evidence: { ...evidenceData.evidence, packVersion: "9.0.0" },
        },
        "shinjuku",
        evidenceInput.placeId,
        packVersion,
      ),
    ).toBe(false);
    expect(
      validatePlannerV3SwapData(
        { ...swapData, googleSignals: [{ secret: "unsafe" }] },
        swapInput,
        "shinjuku",
        packVersion,
      ),
    ).toBe(false);
  });

  it("exposes exactly three read-only and two local mutations", () => {
    const definitions = createPlannerV3ToolDefinitions(dependencies());
    expect(definitions.map(({ name }) => name)).toEqual(PLANNER_V3_TOOL_NAMES);
    expect(
      definitions
        .slice(0, 3)
        .every(({ annotations }) => annotations?.readOnlyHint === true),
    ).toBe(true);
    expect(
      definitions
        .slice(3)
        .every(({ annotations }) => annotations?.readOnlyHint === false),
    ).toBe(true);
    expect(
      definitions.every(
        ({ annotations }) => annotations?.untrustedContentHint === true,
      ),
    ).toBe(true);
  });

  it("passes shared callbacks the exact input, provenance, and signal", async () => {
    const callbacks = actions();
    callbacks.save.mockImplementation(() =>
      envelope({
        savedAt: "2026-08-30T08:00:00.000Z",
        savedPlanId: searchData.plan.planId,
        status: "SAVED",
      }),
    );
    const definitions = createPlannerV3ToolDefinitions(dependencies(callbacks));
    const controller = new AbortController();
    const saveInput = {
      schemaVersion: "3" as const,
      candidateSetId: searchData.candidateSetId,
      planId: searchData.plan.planId,
    };
    const executions = [
      ["find_evening_plan", intent, callbacks.find],
      ["show_place_evidence", evidenceInput, callbacks.showEvidence],
      ["swap_plan_stop", swapInput, callbacks.swap],
      ["save_plan", saveInput, callbacks.save],
    ] as const;

    for (const [name, input, callback] of executions) {
      const result = await findDefinition(definitions, name).execute(input, {
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

  it("rejects invalid input before state or callback", async () => {
    const callbacks = actions();
    const checkState = vi.fn(() => ({ ok: true as const }));
    const definitions = createPlannerV3ToolDefinitions(
      dependencies({ ...callbacks, checkState }),
    );
    for (const definition of definitions) {
      const result = await definition.execute({ schemaVersion: "3" });
      expect(JSON.parse(result)).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_ERROR" },
      });
    }
    expect(checkState).not.toHaveBeenCalled();
    Object.values(callbacks).forEach((callback) =>
      expect(callback).not.toHaveBeenCalled(),
    );
  });

  it("rolls back every registration on synchronous and asynchronous failure", async () => {
    const signals: AbortSignal[] = [];
    let calls = 0;
    const context = Object.assign(new EventTarget(), {
      executeTool: vi.fn<ModelContextLike["executeTool"]>(),
      getTools: vi.fn<ModelContextLike["getTools"]>(() => Promise.resolve([])),
      registerTool: vi.fn<ModelContextLike["registerTool"]>(
        (_definition, options) => {
          calls += 1;
          if (options?.signal) signals.push(options.signal);
          if (calls === 3) return Promise.reject(new Error("failed"));
        },
      ),
    }) as ModelContextLike;
    const registration = registerPlannerV3Tools(dependencies(), {
      modelContext: context,
    } as unknown as Document);
    await expect(registration.ready).rejects.toThrow("failed");
    expect(signals).toHaveLength(5);
    expect(signals.every(({ aborted }) => aborted)).toBe(true);
  });
});
