"use client";

import type { PlannerIntentV3 } from "@serendipity/contracts/planner-v3";
import { useEffect, useState } from "react";

import type { PlannerTransportV3 } from "./planner-machine";
import { areaLabel } from "./planner-options";

type ProgressStageV3 = "matching" | "routing" | "validating";

const stages: readonly { key: ProgressStageV3; label: string }[] = [
  { key: "validating", label: "Validating your choices" },
  {
    key: "matching",
    label: "Matching published hours & official menu prices",
  },
  { key: "routing", label: "Balancing stops & walking time" },
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
    const matching = globalThis.setTimeout(() => setStage("matching"), 220);
    const routing = globalThis.setTimeout(() => setStage("routing"), 470);
    return () => {
      globalThis.clearTimeout(matching);
      globalThis.clearTimeout(routing);
    };
  }, []);

  const currentIndex = stageIndex(stage);
  const progress = stage === "validating" ? 25 : stage === "matching" ? 60 : 85;

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
      <p aria-live="polite" className="sr-only">
        {stages[currentIndex]!.label}
      </p>
      <p className="v3-progress__boundary">
        Published information only—no live availability or booking claim.
      </p>
    </section>
  );
}
