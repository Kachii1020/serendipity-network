import Link from "next/link";

import { PlannerMaintenance } from "./planner-maintenance";
import { PlannerForm } from "./planner-form";
import type { PlannerFormDefaults } from "./planner-options";

export type LandingSampleStop = {
  readonly category: string;
  readonly name: string;
  readonly priceLabel: string;
  readonly publisher: string;
};

export function PlannerLanding({
  defaults,
  available = true,
  earliestStartToday,
  homePath = "/",
  maxDate,
  minDate,
  plannerPath = "/plan",
  sampleStops,
  sourcePackValidThrough,
}: {
  readonly available?: boolean;
  readonly defaults: PlannerFormDefaults;
  readonly earliestStartToday: string | null;
  readonly homePath?: string;
  readonly maxDate: string;
  readonly minDate: string;
  readonly plannerPath?: string;
  readonly sampleStops: readonly LandingSampleStop[];
  readonly sourcePackValidThrough: string;
}) {
  return (
    <div className="v2-site-shell">
      <a className="skip-link" href="#planner-home">
        Skip to planner
      </a>
      <header className="v2-header">
        <Link className="wordmark" href={homePath} translate="no">
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
              hours, a visible price basis, walking estimates, and the source
              behind every stop.
            </p>
            <ul className="v2-promise-list">
              <li>Real place names and addresses</li>
              <li>Price basis and opening-hours evidence</li>
              <li>Official links for the next step</li>
            </ul>
          </div>

          <div className="v2-form-card">
            <div className="v2-form-card__heading">
              <span>Start at Shibuya Station</span>
              <strong>Build one doable afternoon or evening</strong>
            </div>
            {available ? (
              <PlannerForm
                action={plannerPath}
                defaults={defaults}
                earliestStartToday={earliestStartToday}
                maxDate={maxDate}
                minDate={minDate}
              />
            ) : (
              <PlannerMaintenance
                compact
                validThrough={sourcePackValidThrough}
              />
            )}
          </div>
        </section>

        <section aria-labelledby="example-title" className="v2-example">
          <div>
            <p className="v2-eyebrow">Example output · not live availability</p>
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
            <p className="v2-eyebrow">Why use an AI assistant?</p>
            <h2 id="agent-title">
              One request can coordinate the whole revision.
            </h2>
          </div>
          <div className="v2-agent-story__workflow">
            <p className="v2-agent-request">
              <span>Example request</span>
              “Plan 13:00–22:00 under ¥8,000 with art, hands-on, lively, and
              quiet stops. Show the source for stop 1, swap the last stop for a
              different interest, and save only if it still fits.”
            </p>
            <ol aria-label="Actions coordinated from one request">
              <li>Rebuild the route with all constraints</li>
              <li>Check the evidence for the changed place</li>
              <li>Replace only a stop that still fits</li>
              <li>Save only after an explicit request</li>
            </ol>
            <p>
              WebMCP gives the assistant 5 validated planner actions, so it can
              complete that sequence without guessing at buttons or inventing
              place facts. The same result stays visible and editable here.
            </p>
          </div>
        </section>
      </main>

      <footer className="v2-footer">
        <span translate="no">SERENDIPITY</span>
        <p>Published information · no live availability or booking claim</p>
        <Link href={plannerPath}>Open planner</Link>
      </footer>
    </div>
  );
}
