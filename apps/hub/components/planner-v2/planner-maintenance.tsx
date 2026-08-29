import Link from "next/link";

const displayDate = (date: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Tokyo",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00+09:00`));

export function PlannerMaintenance({
  compact = false,
  validThrough,
}: {
  readonly compact?: boolean;
  readonly validThrough: string;
}) {
  const message = (
    <>
      The current place pack was verified through {displayDate(validThrough)}.
      No route will be generated until its hours, prices, and closure dates are
      checked again.
    </>
  );

  if (compact) {
    return (
      <div className="v2-source-maintenance" role="status">
        <strong>Source refresh in progress</strong>
        <p>{message}</p>
      </div>
    );
  }

  return (
    <div className="v2-planner-shell">
      <a className="skip-link" href="#planner-maintenance">
        Skip to status
      </a>
      <header className="v2-header">
        <Link className="wordmark" href="/" translate="no">
          SERENDIPITY<span aria-hidden="true">✦</span>
        </Link>
        <p>Source-backed Shibuya plans</p>
      </header>
      <main className="v2-planner-main" id="planner-maintenance">
        <div className="v2-empty-state" tabIndex={-1}>
          <p className="v2-eyebrow">Source refresh required</p>
          <h1>Planning is paused, not guessed.</h1>
          <p>{message}</p>
          <Link className="v2-text-action" href="/">
            Back to Serendipity
          </Link>
        </div>
      </main>
    </div>
  );
}
