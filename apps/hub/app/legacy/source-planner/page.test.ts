import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  connection: vi.fn(() => Promise.resolve()),
  redirect: vi.fn(),
}));

vi.mock("next/server", () => ({ connection: runtime.connection }));
vi.mock("next/navigation", () => ({ redirect: runtime.redirect }));
vi.mock("../../../data/shibuya-v2", () => ({
  SHIBUYA_ACTIVE_PACK_V2: {
    packVersion: "1.3.0",
    validThrough: "2026-10-28T23:59:59+09:00",
  },
}));

import { PlannerMaintenance } from "../../../components/planner-v2/planner-maintenance";
import LegacySourcePlannerPage from "./page";

const query = {
  auto: "1",
  budget: "5000",
  date: "2026-08-30",
  end: "22:00",
  interests: ["art", "quiet"],
  start: "17:00",
  walk: "20",
} as const;

describe("legacy planner v2 SSR boundary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T01:00:00+09:00"));
    runtime.connection.mockClear();
    runtime.redirect.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it("delegates auto-search to the preserved v2 controller", async () => {
    const element = (await LegacySourcePlannerPage({
      searchParams: Promise.resolve(query),
    })) as ReactElement<{
      autoSearch: boolean;
      initialIntent: { area: string; totalBudgetYen: number };
      packVersion: string;
      plannerPath: string;
    }>;

    expect(element.props.autoSearch).toBe(true);
    expect(element.props.initialIntent).toMatchObject({
      area: "shibuya",
      totalBudgetYen: 5000,
    });
    expect(element.props.packVersion).toBe("1.3.0");
    expect(element.props.plannerPath).toBe("/legacy/source-planner");
  });

  it("renders maintenance after the audited pack expires", async () => {
    vi.setSystemTime(new Date("2026-10-29T01:00:00+09:00"));
    const element = (await LegacySourcePlannerPage({
      searchParams: Promise.resolve({}),
    })) as ReactElement<{ validThrough: string }>;
    expect(element.type).toBe(PlannerMaintenance);
    expect(element.props.validThrough).toBe("2026-10-28");
  });
});
