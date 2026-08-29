import Link from "next/link";

import { PlannerForm, type PlannerFormDefaults } from "./planner-form";

export type LandingSampleStop = {
  readonly category: string;
  readonly name: string;
  readonly priceLabel: string;
  readonly publisher: string;
};

export function PlannerLanding({
  defaults,
  maxDate,
  minDate,
  sampleStops,
}: {
  readonly defaults: PlannerFormDefaults;
  readonly maxDate: string;
  readonly minDate: string;
  readonly sampleStops: readonly LandingSampleStop[];
}) {
  return (
    <div className="v2-site-shell">
      <a className="skip-link" href="#planner-home">
        Skip to planner
      </a>
      <header className="v2-header">
        <Link className="wordmark" href="/" translate="no">
          SERENDIPITY<span aria-hidden="true">✦</span>
        </Link>
        <p>Source-backed Shibuya plans</p>
      </header>

      <main id="planner-home">
        <section className="v2-hero">
          <div className="v2-hero__intro">
            <p className="v2-eyebrow">Shibuya · solo · 2–3 real places</p>
            <h1>A plan you can actually verify.</h1>
            <p className="v2-hero__lede">
              Pick a time, budget, and mood. Get a feasible route with published
              hours, reference prices, walking estimates, and the source behind
              every stop.
            </p>
            <ul className="v2-promise-list">
              <li>Real place names and addresses</li>
              <li>Price and opening-hours evidence</li>
              <li>Official links for the next step</li>
            </ul>
          </div>

          <div className="v2-form-card">
            <div className="v2-form-card__heading">
              <span>Start at Shibuya Station</span>
              <strong>Build one doable afternoon or evening</strong>
            </div>
            <PlannerForm
              defaults={defaults}
              maxDate={maxDate}
              minDate={minDate}
            />
          </div>
        </section>

        <section aria-labelledby="example-title" className="v2-example">
          <div>
            <p className="v2-eyebrow">What comes back</p>
            <h2 id="example-title">Places first. Proof beside them.</h2>
            <p>
              Serendipity combines published facts into one route; it does not
              pretend to know live seats or complete a booking.
            </p>
          </div>
          <ol className="v2-example__route">
            {sampleStops.map((stop, index) => (
              <li key={`${stop.name}-${index}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <small>{stop.category}</small>
                  <strong>{stop.name}</strong>
                  <p>{stop.priceLabel}</p>
                  <p>Source: {stop.publisher}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="agent-title" className="v2-agent-story">
          <div>
            <p className="v2-eyebrow">Human and agent, one plan</p>
            <h2 id="agent-title">
              Ask for a change. See the same page change.
            </h2>
          </div>
          <p>
            With WebMCP, an AI assistant can use the planner&apos;s validated
            search, evidence, swap, and save actions instead of guessing at the
            interface. Manual controls always remain available.
          </p>
        </section>
      </main>

      <footer className="v2-footer">
        <span translate="no">SERENDIPITY</span>
        <p>Published information · no live availability or booking claim</p>
        <Link href="/plan">Open planner</Link>
      </footer>
    </div>
  );
}
