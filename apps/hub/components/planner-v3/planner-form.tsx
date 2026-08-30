"use client";

import { useState, type FormEventHandler } from "react";

import {
  AREA_OPTIONS,
  BUDGET_PRESETS,
  INTEREST_OPTIONS,
  PARTY_PRESETS,
  type PlannerFormDefaultsV3,
} from "./planner-options";

const exclusionOptions = [
  ["drinks", "Drinks-focused"],
  ["outdoors", "Outdoor stops"],
] as const;

const tagLabel = (value: string): string => {
  const labels: Readonly<Record<string, string>> = {
    "coffee-tea": "Coffee & tea",
    "hands-on": "Hands-on",
  };
  return labels[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
};

const timeOptions = (firstHour: number, lastHour: number) =>
  Array.from({ length: (lastHour - firstHour) * 2 + 2 }, (_, index) => {
    const minutes = firstHour * 60 + index * 30;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  });

export function PlannerFormV3({
  defaults,
  earliestStartToday,
  error,
  maxDate,
  minDate,
  onSubmit,
}: {
  readonly defaults: PlannerFormDefaultsV3;
  readonly earliestStartToday: string | null;
  readonly error?: string | null;
  readonly maxDate: string;
  readonly minDate: string;
  readonly onSubmit?: FormEventHandler<HTMLFormElement>;
}) {
  const [selectedDate, setSelectedDate] = useState(defaults.date);
  const [interest, setInterest] = useState(defaults.interestPreset);
  const [includeMeal, setIncludeMeal] = useState(defaults.includeMeal);
  const earliest = selectedDate === minDate ? earliestStartToday : "12:00";
  const startOptions = [
    ...new Set([...timeOptions(12, 21), defaults.start]),
  ].sort();
  const endOptions = [
    ...new Set([...timeOptions(14, 23), defaults.end]),
  ].sort();
  const budgetOptions = [
    ...new Set([...BUDGET_PRESETS, defaults.budgetPerPersonYen]),
  ].sort((left, right) => left - right);
  const visibleExclusions = new Set<string>(
    exclusionOptions.map(([value]) => value),
  );
  const additionalExclusions = defaults.excludedTags.filter(
    (value) => !visibleExclusions.has(value),
  );
  const walkOptions = [...new Set([5, 10, 15, 20, 25, 30, defaults.walk])]
    .filter((value) => Number.isInteger(value) && value >= 5 && value <= 30)
    .sort((left, right) => left - right);

  return (
    <form
      action="/v3/plan"
      className="v3-form"
      method="get"
      onSubmit={onSubmit}
    >
      <input name="auto" type="hidden" value="1" />
      <input name="meal" type="hidden" value={includeMeal ? "1" : "0"} />
      <fieldset className="v3-fieldset">
        <legend>Choose a Tokyo hub</legend>
        <div className="v3-region-grid">
          {AREA_OPTIONS.map((area) => (
            <label key={area.value}>
              <input
                defaultChecked={defaults.area === area.value}
                name="area"
                type="radio"
                value={area.value}
              />
              <span>{area.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="v3-ticket-row">
        <fieldset className="v3-fieldset">
          <legend>Adults</legend>
          <div className="v3-ticket-options">
            {PARTY_PRESETS.map((partySize) => (
              <label key={partySize}>
                <input
                  defaultChecked={defaults.partySize === partySize}
                  name="party"
                  type="radio"
                  value={partySize}
                />
                <span>
                  {partySize} {partySize === 1 ? "adult" : "adults"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="v3-fieldset">
          <legend>Budget per person</legend>
          <div className="v3-ticket-options">
            {budgetOptions.map((budget) => (
              <label key={budget}>
                <input
                  defaultChecked={defaults.budgetPerPersonYen === budget}
                  name="budget"
                  type="radio"
                  value={budget}
                />
                <span>¥{budget.toLocaleString("en-US")}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="v3-date-row">
        <label>
          <span>Date</span>
          <input
            autoComplete="off"
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
          <select autoComplete="off" defaultValue={defaults.start} name="start">
            {startOptions.map((value) => (
              <option
                disabled={earliest === null || value < earliest}
                key={value}
                value={value}
              >
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Finish</span>
          <select autoComplete="off" defaultValue={defaults.end} name="end">
            {endOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="v3-fieldset">
        <legend>What sounds good?</legend>
        <div className="v3-mood-grid">
          {INTEREST_OPTIONS.map((option) => (
            <label key={option.value}>
              <input
                checked={interest === option.value}
                name="interest"
                onChange={() => {
                  setInterest(option.value);
                  if (option.value === "FOOD_DISCOVERY") setIncludeMeal(true);
                }}
                type="radio"
                value={option.value}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="v3-form-actions">
        <label className="v3-meal-toggle">
          <input
            checked={includeMeal}
            disabled={interest === "FOOD_DISCOVERY"}
            onChange={(event) => setIncludeMeal(event.currentTarget.checked)}
            type="checkbox"
            value="1"
          />
          <span>{includeMeal ? "✓ Include a meal" : "Include a meal"}</span>
        </label>
        <button className="v3-primary" type="submit">
          Build my Tokyo plan <span aria-hidden="true">→</span>
        </button>
      </div>
      <details>
        <summary>Walking & exclusions</summary>
        <div className="v3-ticket-row">
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
          <fieldset className="v3-fieldset">
            <legend>Leave out</legend>
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
          </fieldset>
        </div>
      </details>
      {error ? (
        <p className="v2-inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
