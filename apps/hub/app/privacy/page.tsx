import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <div className="v3-shell">
      <header className="v3-header">
        <Link className="v3-wordmark" href="/v3" translate="no">
          SERENDIPITY<span aria-hidden="true">✦</span>
        </Link>
      </header>
      <main className="v3-result-main v3-policy">
        <h1>Privacy</h1>
        <p>
          Serendipity does not create an account, process payment, or claim a
          live reservation. Saved plans stay in this browser.
        </p>
        <h2>Planner data</h2>
        <p>
          Your selected area, date, party size, budget, interests, and saved
          plan are used only to build and display the requested route. The app
          does not ask for your precise device location.
        </p>
        <h2>Google Maps Platform</h2>
        <p>
          When Google enrichment is enabled, the server may request current
          place details for predeclared restaurant Place IDs. Google content is
          shown transiently and is not stored in saved plan snapshots. Use of
          Google Maps features is subject to the Google Privacy Policy and
          Google Maps Platform Terms.
        </p>
        <p>
          <a
            href="https://policies.google.com/privacy"
            rel="noopener noreferrer"
            target="_blank"
          >
            Google Privacy Policy ↗
          </a>
          {" · "}
          <a
            href="https://cloud.google.com/maps-platform/terms"
            rel="noopener noreferrer"
            target="_blank"
          >
            Google Maps Platform Terms ↗
          </a>
        </p>
      </main>
    </div>
  );
}
