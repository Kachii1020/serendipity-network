"use client";

import { useState, type FormEventHandler } from "react";

import {
  PLANNER_INTEREST_OPTIONS,
  type PlannerFormDefaults,
} from "./planner-options";

const timeOptions = (firstHour: number, lastHour: number) =>
  Array.from({ length: (lastHour - firstHour) * 2 + 2 }, (_, index) => {
    const totalMinutes = firstHour * 60 + index * 30;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  });

const exclusionOptions = [
  ["alcohol", "Alcohol-focused"],
  ["smoking", "Smoking"],
  ["outdoors", "Outdoor stops"],
] as const;

const tagLabel = (value: string): string => {
  const labels: Readonly<Record<string, string>> = {
    "coffee-tea": "Coffee & tea",
    "hands-on": "Hands-on",
    viewpoint: "Viewpoint",
  };
  return labels[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
};

export function PlannerForm({
  defaults,
  earliestStartToday,
  error,
  maxDate,
  minDate,
  onSubmit,
}: {
  readonly defaults: PlannerFormDefaults;
  readonly earliestStartToday: string | null;
  readonly error?: string | null;
  readonly maxDate: string;
  readonly minDate: string;
  readonly onSubmit?: FormEventHandler<HTMLFormElement>;
}) {
  const [selectedDate, setSelectedDate] = useState(defaults.date);
  const minimumStart = selectedDate === minDate ? earliestStartToday : "12:00";
  const effectiveStart =
    minimumStart && defaults.start < minimumStart
      ? minimumStart
      : defaults.start;
  const visibleInterests = new Set<string>(
    PLANNER_INTEREST_OPTIONS.map(({ value }) => value),
  );
  const visibleExclusions = new Set<string>(
    exclusionOptions.map(([value]) => value),
  );
  const additionalInterests = defaults.interests.filter(
    (value) => !visibleInterests.has(value),
  );
  const additionalExclusions = defaults.excludedTags.filter(
    (value) => !visibleExclusions.has(value),
  );
  const startOptions = [
    ...new Set([...timeOptions(12, 21), defaults.start]),
  ].sort();
  const endOptions = [
    ...new Set([...timeOptions(14, 23), defaults.end]),
  ].sort();
  const budgetOptions = [...new Set([3000, 5000, 8000, defaults.budget])].sort(
    (left, right) => left - right,
  );
  const walkOptions = [...new Set([10, 20, 30, defaults.walk])].sort(
    (left, right) => left - right,
  );

  return (
    <form
      action="/plan"
      className="v2-planner-form"
      method="get"
      onSubmit={onSubmit}
    >
      <input name="auto" type="hidden" value="1" />
      <input name="interests" type="hidden" value="none" />
      <div className="v2-form-row v2-form-row--three">
        <label>
          <span>Date</span>
          <input
            defaultValue={defaults.date}
            max={maxDate}
            min={minDate}
            name="date"
            onChange={(event) => setSelectedDate(event.currentTarget.value)}
            required
            type="date"
          />
        </label>
        <label>
          <span>Start</span>
          <select
            defaultValue={effectiveStart}
            key={selectedDate}
            name="start"
            required
          >
            {startOptions.map((value) => (
              <option
                disabled={minimumStart === null || value < minimumStart}
                key={value}
                value={value}
              >
                {value} JST
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Finish by</span>
          <select defaultValue={defaults.end} name="end" required>
            {endOptions.map((value) => (
              <option key={value} value={value}>
                {value} JST
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="v2-choice-group v2-choice-group--budget">
        <legend>Reference budget</legend>
        <div className="v2-chip-grid v2-chip-grid--budget">
          {budgetOptions.map((budget) => (
            <label key={budget}>
              <input
                defaultChecked={defaults.budget === budget}
                name="budget"
                type="radio"
                value={budget}
              />
              <span>¥{budget.toLocaleString("en-US")}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="v2-choice-group v2-choice-group--interests">
        <legend>What sounds good?</legend>
        <div className="v2-chip-grid">
          {PLANNER_INTEREST_OPTIONS.map((option) => (
            <label key={option.value}>
              <input
                defaultChecked={defaults.interests.includes(option.value)}
                name="interests"
                type="checkbox"
                value={option.value}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {additionalInterests.length > 0 ? (
        <fieldset className="v2-choice-group v2-applied-constraints">
          <legend>Also requested by the current link or assistant</legend>
          <div className="v2-chip-grid">
            {additionalInterests.map((value) => (
              <label key={value}>
                <input
                  defaultChecked
                  name="interests"
                  type="checkbox"
                  value={value}
                />
                <span>{tagLabel(value)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <details className="v2-advanced">
        <summary>Walking and exclusions</summary>
        <div className="v2-advanced__body">
          <label>
            <span>Maximum walk between stops</span>
            <select defaultValue={defaults.walk} name="walk">
              {walkOptions.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Leave out</legend>
            <div className="v2-check-list">
              {exclusionOptions.map(([value, label]) => (
                <label key={value}>
                  <input
                    defaultChecked={defaults.excludedTags.includes(value)}
                    name="exclude"
                    type="checkbox"
                    value={value}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            {additionalExclusions.length > 0 ? (
              <div className="v2-check-list v2-applied-constraints">
                {additionalExclusions.map((value) => (
                  <label key={value}>
                    <input
                      defaultChecked
                      name="exclude"
                      type="checkbox"
                      value={value}
                    />
                    <span>{tagLabel(value)}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </fieldset>
        </div>
      </details>

      <button className="v2-primary-action" type="submit">
        Build my evening <span aria-hidden="true">→</span>
      </button>
      {error ? (
        <p className="v2-inline-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="v2-form-boundary">
        Solo · Shibuya Station start · listed admission/activity only · not live
        availability
      </p>
    </form>
  );
}
