import {
  PLANNER_SCHEMA_VERSION,
  type PlannerIntentV2,
  type PlannerTag,
} from "@serendipity/contracts/planner-v2";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { PlannerClient } from "../../components/planner-v2/planner-client";
import {
  normalizePlannerQuery,
  toTokyoTimestamp,
  type PlannerQuery,
} from "../../components/planner-v2/planner-query";
import { SHIBUYA_ACTIVE_PACK_V2 } from "../../data/shibuya-v2";

export const metadata: Metadata = {
  alternates: { canonical: "/plan" },
  description:
    "Plan 2–3 real Shibuya stops with published evidence and official links.",
  robots: { follow: true, index: true },
  title: "Build a source-backed Shibuya plan",
};

export default async function PlanPage({
  searchParams,
}: {
  readonly searchParams: Promise<PlannerQuery>;
}) {
  await connection();
  const query = await searchParams;
  const normalized = normalizePlannerQuery(query, new Date());
  if (normalized.invalid) {
    const target = normalized.normalized.toString();
    redirect(target ? `/plan?${target}` : "/plan");
  }

  const intent: PlannerIntentV2 = {
    area: "shibuya",
    endAt: toTokyoTimestamp(normalized.defaults.date, normalized.defaults.end),
    excludedTags: normalized.defaults.excludedTags as PlannerTag[],
    maxWalkMinutesPerLeg: normalized.defaults.walk,
    partySize: 1,
    preferredTags: normalized.defaults.interests as PlannerTag[],
    schemaVersion: PLANNER_SCHEMA_VERSION,
    startAt: toTokyoTimestamp(
      normalized.defaults.date,
      normalized.defaults.start,
    ),
    stopCount: "AUTO",
    totalBudgetYen: normalized.defaults.budget,
  };

  return (
    <PlannerClient
      autoSearch={normalized.autoSearch}
      defaults={normalized.defaults}
      hubOrigin={process.env.NEXT_PUBLIC_HUB_ORIGIN ?? "http://localhost:3100"}
      initialIntent={intent}
      maxDate={normalized.maxDate}
      minDate={normalized.minDate}
      packVersion={SHIBUYA_ACTIVE_PACK_V2.packVersion}
    />
  );
}
