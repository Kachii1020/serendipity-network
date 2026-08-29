import { randomUUID } from "node:crypto";

import type { Provider } from "@serendipity/contracts";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { HubClient } from "../../../components/product/hub-client";
import {
  BUDGET_PRESETS_YEN,
  DEFAULT_PLAN_CONSTRAINTS,
  MOOD_PRESETS,
  START_TIME_PRESETS,
  type Mood,
  type PlanConstraints,
} from "../../../components/product/types";

export const metadata: Metadata = {
  description: "Archived reservation-network demonstration for Serendipity v1.",
  robots: { follow: false, index: false },
  title: "Legacy network demo",
};

const providerOrigins = (): Record<Provider, string> => {
  const values = (
    process.env.NEXT_PUBLIC_PROVIDER_ORIGINS ??
    "http://localhost:3101,http://localhost:3102,http://localhost:3103"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (values.length !== 3) {
    throw new Error("Kiln, Nori, and Loop origins are required");
  }
  return { kiln: values[0]!, nori: values[1]!, loop: values[2]! };
};

const scalar = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;

const validMood = (value: string | undefined): Mood | undefined =>
  MOOD_PRESETS.find((mood) => mood.toLowerCase() === value?.toLowerCase());

const initialMood = (value: string | undefined): Mood =>
  validMood(value) ?? "Surprising";

const initialConstraints = (
  start: string | undefined,
  budget: string | undefined,
): PlanConstraints => {
  const startTime = START_TIME_PRESETS.find((preset) => preset === start);
  const numericBudget = Number(budget);
  const totalBudgetYen = BUDGET_PRESETS_YEN.find(
    (preset) => preset === numericBudget,
  );
  return {
    startTime: startTime ?? DEFAULT_PLAN_CONSTRAINTS.startTime,
    totalBudgetYen: totalBudgetYen ?? DEFAULT_PLAN_CONSTRAINTS.totalBudgetYen,
  };
};

export default async function LegacyNetworkDemoPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const mood = scalar(query.mood);
  const start = scalar(query.start);
  const budget = scalar(query.budget);
  const numericBudget = Number(budget);
  const safe = new URLSearchParams();
  const selectedMood = validMood(mood);
  const selectedStart = START_TIME_PRESETS.find((preset) => preset === start);
  const selectedBudget = BUDGET_PRESETS_YEN.find(
    (preset) => preset === numericBudget,
  );
  if (selectedMood) safe.set("mood", selectedMood.toLowerCase());
  if (selectedStart) safe.set("start", selectedStart);
  if (selectedBudget) safe.set("budget", String(selectedBudget));
  const unsafeQuery =
    Object.keys(query).some(
      (key) => !["budget", "mood", "start"].includes(key),
    ) ||
    Object.values(query).some(Array.isArray) ||
    (mood !== undefined && !selectedMood) ||
    (start !== undefined && !selectedStart) ||
    (budget !== undefined && !selectedBudget) ||
    (selectedMood !== undefined && mood !== selectedMood.toLowerCase());
  if (unsafeQuery) {
    const normalized = safe.toString();
    redirect(
      normalized
        ? `/legacy/network-demo?${normalized}`
        : "/legacy/network-demo",
    );
  }
  await connection();
  return (
    <HubClient
      browserSessionId={randomUUID()}
      initialConstraints={initialConstraints(
        scalar(query.start),
        scalar(query.budget),
      )}
      initialMood={initialMood(mood)}
      providerOrigins={providerOrigins()}
    />
  );
}
