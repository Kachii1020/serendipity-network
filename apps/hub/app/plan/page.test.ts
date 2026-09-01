import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  connection: vi.fn(() => Promise.resolve()),
  redirect: vi.fn(),
}));

vi.mock("next/server", () => ({ connection: runtime.connection }));
vi.mock("next/navigation", () => ({ redirect: runtime.redirect }));

import PlanPage from "./page";

describe("canonical v3 planner SSR boundary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T01:00:00+09:00"));
    runtime.connection.mockClear();
    runtime.redirect.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it("projects the canonical /plan route into the v3 shared client", async () => {
    const element = (await PlanPage({
      searchParams: Promise.resolve({
        area: "ikebukuro",
        auto: "1",
        budget: "4000",
        date: "2026-09-01",
        end: "22:30",
        interest: "CALM_QUIET",
        meal: "1",
        party: "3",
        start: "17:30",
        walk: "20",
      }),
    })) as ReactElement<{
      homePath: string;
      initialIntent: { area: string; partySize: number };
      plannerPath: string;
    }>;

    expect(element.props.homePath).toBe("/");
    expect(element.props.plannerPath).toBe("/plan");
    expect(element.props.initialIntent).toMatchObject({
      area: "ikebukuro",
      partySize: 3,
    });
  });
});
