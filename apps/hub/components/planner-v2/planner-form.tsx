export const PLANNER_INTEREST_OPTIONS = [
  { label: "Art & culture", value: "art" },
  { label: "Hands-on", value: "hands-on" },
  { label: "Quiet", value: "quiet" },
  { label: "Books", value: "books" },
] as const;

export type PlannerFormDefaults = {
  readonly budget: number;
  readonly date: string;
  readonly end: string;
  readonly excludedTags: readonly string[];
  readonly interests: readonly string[];
  readonly start: string;
  readonly walk: number;
};

export function PlannerForm({
  defaults,
  maxDate,
  minDate,
}: {
  readonly defaults: PlannerFormDefaults;
  readonly maxDate: string;
  readonly minDate: string;
}) {
  return (
    <form action="/plan" className="v2-planner-form" method="get">
      <input name="auto" type="hidden" value="1" />
      <div className="v2-form-row v2-form-row--three">
        <label>
          <span>Date</span>
          <input
            defaultValue={defaults.date}
            max={maxDate}
            min={minDate}
            name="date"
            required
            type="date"
          />
        </label>
        <label>
          <span>Start</span>
          <input
            defaultValue={defaults.start}
            max="21:30"
            min="12:00"
            name="start"
            required
            step="1800"
            type="time"
          />
        </label>
        <label>
          <span>Finish by</span>
          <input
            defaultValue={defaults.end}
            max="23:30"
            min="14:00"
            name="end"
            required
            step="1800"
            type="time"
          />
        </label>
      </div>

      <fieldset className="v2-choice-group v2-choice-group--budget">
        <legend>Reference budget</legend>
        <div className="v2-chip-grid v2-chip-grid--budget">
          {[3000, 5000, 8000].map((budget) => (
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

      <details className="v2-advanced">
        <summary>Walking and exclusions</summary>
        <div className="v2-advanced__body">
          <label>
            <span>Maximum walk between stops</span>
            <select defaultValue={defaults.walk} name="walk">
              <option value="10">10 minutes</option>
              <option value="20">20 minutes</option>
              <option value="30">30 minutes</option>
            </select>
          </label>
          <fieldset>
            <legend>Leave out</legend>
            <div className="v2-check-list">
              {[
                ["alcohol", "Alcohol-focused"],
                ["smoking", "Smoking"],
                ["outdoors", "Outdoor stops"],
              ].map(([value, label]) => (
                <label key={value}>
                  <input
                    defaultChecked={defaults.excludedTags.includes(value!)}
                    name="exclude"
                    type="checkbox"
                    value={value}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </details>

      <button className="v2-primary-action" type="submit">
        Build my evening <span aria-hidden="true">→</span>
      </button>
      <p className="v2-form-boundary">
        Solo · Shibuya Station start · published information, not live
        availability
      </p>
    </form>
  );
}
