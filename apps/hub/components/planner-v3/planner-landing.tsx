import Link from "next/link";

import { PlannerFormV3 } from "./planner-form";
import type { PlannerFormDefaultsV3 } from "./planner-options";

export function PlannerLandingV3({
  defaults,
  earliestStartToday,
  maxDate,
  minDate,
}: {
  readonly defaults: PlannerFormDefaultsV3;
  readonly earliestStartToday: string | null;
  readonly maxDate: string;
  readonly minDate: string;
}) {
  return (
    <div className="v3-shell">
      <a className="skip-link" href="#v3-planner">
        Skip to planner
      </a>
      <header className="v3-header">
        <Link className="v3-wordmark" href="/v3" translate="no">
          SERENDIPITY<span aria-hidden="true">✦</span>
        </Link>
        <span className="v3-mode">Tokyo&apos;s 3 major hubs</span>
      </header>
      <main className="v3-landing" id="v3-planner">
        <div className="v3-landing__intro">
          <h1>A whole Tokyo night.</h1>
          <p>
            Pick Shibuya, Shinjuku, or Ikebukuro. Get an activity, an optional
            meal, and a final stop from published hours and official prices.
          </p>
          <p className="v3-agent-note">
            Site Tools let your AI compare hubs, inspect official menu evidence,
            change one stop, and save the same visible plan.
          </p>
        </div>
        <PlannerFormV3
          defaults={defaults}
          earliestStartToday={earliestStartToday}
          maxDate={maxDate}
          minDate={minDate}
        />
      </main>
      <footer className="v3-footer">
        <strong translate="no">SERENDIPITY</strong>
        <span>Published information · no booking or live-seat claim</span>
        <Link href="/privacy">Privacy</Link>
      </footer>
    </div>
  );
}
