"use client";

import type { PlannerIntentV3 } from "@serendipity/contracts/planner-v3";
import { useEffect, useState } from "react";

import type { PlannerTransportV3 } from "./planner-machine";
import { areaLabel } from "./planner-options";

type ProgressStageV3 = "matching" | "preparing" | "routing" | "validating";

const stages: readonly { key: ProgressStageV3; label: string }[] = [
  { key: "validating", label: "Understanding your choices" },
  {
    key: "matching",
    label: "Checking published hours & official menu prices",
  },
  { key: "routing", label: "Comparing routes & walking time" },
  { key: "preparing", label: "Preparing your best plan" },
];

const stageIndex = (stage: ProgressStageV3): number =>
  stages.findIndex(({ key }) => key === stage);

export function PlannerProgressV3({
  intent,
  transport,
}: {
  readonly intent: PlannerIntentV3;
  readonly transport: PlannerTransportV3;
}) {
  const [stage, setStage] = useState<ProgressStageV3>("validating");

  useEffect(() => {
    const matching = globalThis.setTimeout(() => setStage("matching"), 500);
    const routing = globalThis.setTimeout(() => setStage("routing"), 1_150);
    const preparing = globalThis.setTimeout(() => setStage("preparing"), 1_750);
    return () => {
      globalThis.clearTimeout(matching);
      globalThis.clearTimeout(routing);
      globalThis.clearTimeout(preparing);
    };
  }, []);

  const currentIndex = stageIndex(stage);
  const progress =
    stage === "validating"
      ? 20
      : stage === "matching"
        ? 45
        : stage === "routing"
          ? 70
          : 90;
  const activeSlots =
    stage === "validating"
      ? 0
      : stage === "matching"
        ? 1
        : stage === "routing"
          ? 2
          : 3;
  const slotRoles = intent.includeMeal
    ? (["Activity", "Meal", "Activity"] as const)
    : (["Activity", "Activity", "Activity"] as const);

  return (
    <section
      aria-labelledby="v3-progress-title"
      className="v3-progress"
      tabIndex={-1}
    >
      <p className="v3-progress__source">
        {transport === "site-tool" ? "AI tool · find_evening_plan" : "Planner"}
      </p>
      <h1 id="v3-progress-title">Building your Tokyo plan…</h1>
      <ul aria-label="Selected plan constraints" className="v3-progress__chips">
        <li>{areaLabel(intent.area)}</li>
        <li>
          {intent.partySize} {intent.partySize === 1 ? "adult" : "adults"}
        </li>
        <li>¥{intent.budgetPerPersonYen.toLocaleString("en-US")} / person</li>
        <li>{intent.includeMeal ? "Meal included" : "Activities only"}</li>
      </ul>
      <div
        aria-label="Plan building progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progress}
        aria-valuetext={stages[currentIndex]!.label}
        className="v3-progress-track"
        role="progressbar"
      >
        <span
          className="v3-progress-fill"
          data-stage={stage}
          style={{ transform: `scaleX(${progress / 100})` }}
        />
      </div>
      <ol className="v3-progress__stages">
        {stages.map((item, index) => (
          <li
            aria-current={item.key === stage ? "step" : undefined}
            data-state={
              index < currentIndex
                ? "complete"
                : index === currentIndex
                  ? "current"
                  : "pending"
            }
            key={item.key}
          >
            <span aria-hidden="true">
              {index < currentIndex ? "✓" : index + 1}
            </span>
            {item.label}
          </li>
        ))}
      </ol>
      <ol aria-label="Target route structure" className="v3-progress__slots">
        {slotRoles.map((role, index) => (
          <li
            data-state={
              index < activeSlots
                ? "complete"
                : index === activeSlots
                  ? "current"
                  : "pending"
            }
            key={`${role}-${index}`}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {role}
          </li>
        ))}
      </ol>
      <p aria-live="polite" className="sr-only">
        {stages[currentIndex]!.label}
      </p>
      <p className="v3-progress__boundary">
        Published information only—no live availability or booking claim.
      </p>
    </section>
  );
}
