import { PLANNER_V3_AREAS } from "@serendipity/contracts/planner-v3";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { PlannerClientV3 } from "../../components/planner-v3/planner-client";
import {
  defaultPlannerFormV3,
  earliestPlannerStartV3,
  normalizePlannerQueryV3,
  plannerIntentFromDefaultsV3,
  tokyoDateV3,
  type PlannerQueryV3,
} from "../../components/planner-v3/planner-query";
import { getAreaDataPackV3, TOKYO_AREA_PACKS_V3 } from "../../data/planner-v3";

export const metadata: Metadata = {
  alternates: { canonical: "/plan" },
  description:
    "Build a source-backed Tokyo route with an optional meal across Shibuya, Shinjuku, and Ikebukuro.",
  robots: { follow: true, index: true },
  title: "Tokyo evening planner",
};

const scalar = (
  value: string | readonly string[] | undefined,
): string | undefined => (typeof value === "string" ? value : undefined);

export default async function PlanPage({
  searchParams,
}: {
  readonly searchParams: Promise<PlannerQueryV3>;
}) {
  await connection();
  const query = await searchParams;
  const now = new Date();
  const requestedArea = scalar(query.area);
  const area =
    PLANNER_V3_AREAS.find((candidate) => candidate === requestedArea) ??
    defaultPlannerFormV3(now).area;
  const pack = getAreaDataPackV3(area);
  const globalValidThrough = TOKYO_AREA_PACKS_V3.map(({ validThrough }) =>
    validThrough.slice(0, 10),
  ).sort()[0]!;
  const validThrough = [
    pack.validThrough.slice(0, 10),
    globalValidThrough,
  ].sort()[0]!;
  if (tokyoDateV3(0, now) > validThrough) {
    return (
      <div className="v3-shell">
        <main className="v3-result-main v3-empty">
          <h1>Source refresh in progress.</h1>
          <p>The reviewed Tokyo hub packs were valid through {validThrough}.</p>
        </main>
      </div>
    );
  }
  const normalized = normalizePlannerQueryV3(query, now, validThrough);
  if (normalized.invalid) {
    const target = normalized.normalized.toString();
    redirect(target ? `/plan?${target}` : "/plan");
  }
  return (
    <PlannerClientV3
      autoSearch={normalized.autoSearch}
      defaults={normalized.defaults}
      earliestStartToday={earliestPlannerStartV3(normalized.defaults.date, now)}
      homePath="/"
      hubOrigin={process.env.NEXT_PUBLIC_HUB_ORIGIN ?? "http://localhost:3100"}
      initialIntent={plannerIntentFromDefaultsV3(normalized.defaults)}
      maxDate={normalized.maxDate}
      minDate={normalized.minDate}
      plannerPath="/plan"
    />
  );
}
