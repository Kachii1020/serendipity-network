"use client";

import Link from "next/link";

export default function GlobalError({ reset }: { readonly reset: () => void }) {
  return (
    <main className="launch-state">
      <p className="marketing-eyebrow">Safe stop</p>
      <h1>Serendipity paused before guessing.</h1>
      <p>Retry this page or return home. No successful action is implied.</p>
      <div>
        <button className="marketing-primary" onClick={reset} type="button">
          Try this page again
        </button>
        <Link className="marketing-secondary" href="/">
          Back home
        </Link>
      </div>
    </main>
  );
}
