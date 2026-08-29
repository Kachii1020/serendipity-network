import { Button } from "@serendipity/ui";

import {
  BUDGET_PRESETS_YEN,
  MOOD_PRESETS,
  START_TIME_PRESETS,
  type Mood,
  type PlanConstraints,
} from "./types";

const yen = (value: number): string => `¥${value.toLocaleString("en-US")}`;

export function MoodPrompt({
  constraints,
  disabled = false,
  onBudget,
  onPlan,
  onSelect,
  onStartTime,
  selected,
}: {
  readonly constraints: PlanConstraints;
  readonly disabled?: boolean;
  readonly onBudget: (budgetYen: number) => void;
  readonly onPlan: () => void;
  readonly onSelect: (mood: Mood) => void;
  readonly onStartTime: (startTime: string) => void;
  readonly selected: Mood;
}) {
  return (
    <section aria-labelledby="mood-heading" className="mood-prompt">
      <p className="section-kicker">A tiny plan for a bigger night</p>
      <h2 id="mood-heading" tabIndex={-1}>
        What kind of tonight?
      </h2>
      <div aria-label="Choose a mood" className="mood-options">
        {MOOD_PRESETS.map((mood) => {
          const isSelected = mood === selected;
          return (
            <button
              aria-pressed={isSelected}
              className="mood-choice"
              data-selected={isSelected}
              disabled={disabled}
              key={mood}
              onClick={() => onSelect(mood)}
              type="button"
            >
              <span>{mood}</span>
              {isSelected ? <span aria-hidden="true">✓</span> : null}
              {isSelected ? <span className="sr-only">Selected</span> : null}
            </button>
          );
        })}
      </div>
      <details className="constraint-adjuster">
        <summary>
          <span>Adjust time &amp; budget</span>
          <small>
            {constraints.startTime} · {yen(constraints.totalBudgetYen)}
          </small>
        </summary>
        <div className="constraint-controls">
          <fieldset disabled={disabled}>
            <legend>Start time</legend>
            <div className="constraint-options">
              {START_TIME_PRESETS.map((startTime) => (
                <label key={startTime}>
                  <input
                    checked={constraints.startTime === startTime}
                    name="plan-start-time"
                    onChange={() => onStartTime(startTime)}
                    type="radio"
                    value={startTime}
                  />
                  <span>{startTime}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={disabled}>
            <legend>Total budget</legend>
            <div className="constraint-options">
              {BUDGET_PRESETS_YEN.map((budgetYen) => (
                <label key={budgetYen}>
                  <input
                    checked={constraints.totalBudgetYen === budgetYen}
                    name="plan-total-budget"
                    onChange={() => onBudget(budgetYen)}
                    type="radio"
                    value={budgetYen}
                  />
                  <span>{yen(budgetYen)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </details>
      <p className="constraint-summary">
        Shibuya launch network <span aria-hidden="true">·</span> solo{" "}
        <span aria-hidden="true">·</span> from {constraints.startTime}{" "}
        <span aria-hidden="true">·</span> up to{" "}
        {yen(constraints.totalBudgetYen)} <span aria-hidden="true">·</span> ends
        by 22:30
      </p>
      <Button
        className="journey-primary"
        disabled={disabled}
        onClick={onPlan}
        variant="primary"
      >
        {disabled ? "Checking three sites…" : "Plan my night"}
        <span aria-hidden="true">→</span>
      </Button>
    </section>
  );
}
