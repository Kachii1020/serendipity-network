import { resolveProviderConfig } from "@serendipity/provider-config";

export default function ProviderHome() {
  const config = resolveProviderConfig(
    process.env.NEXT_PUBLIC_PROVIDER_SLUG ?? "kiln",
  );
  const hubOrigin =
    process.env.NEXT_PUBLIC_HUB_ORIGIN ?? "http://localhost:3100";

  return (
    <main
      className="provider-home"
      data-provider={config.slug}
      style={{ "--accent": config.accent } as React.CSSProperties}
    >
      <header className="provider-home__header">
        <div>
          <p className="provider-home__network">Serendipity Network</p>
          <p className="provider-home__name">{config.displayName}</p>
        </div>
        <span className="provider-home__category">{config.category}</span>
      </header>

      <section className="provider-home__hero" aria-labelledby="provider-hero">
        <div className="provider-home__invitation">
          <p>{config.tagline}</p>
          <h1 id="provider-hero">{config.hero}</h1>
          <a className="provider-home__action" href={hubOrigin}>
            Plan with Serendipity <span aria-hidden="true">→</span>
          </a>
        </div>
        <div className="provider-home__art" aria-hidden="true">
          <span className={`provider-home__art-mark mark--${config.mark}`}>
            {config.mark === "vessel"
              ? "◡"
              : config.mark === "bowl"
                ? "⌣"
                : "♪"}
          </span>
          <span className="provider-home__art-spark">✦</span>
          <span className="provider-home__art-dot" />
        </div>
      </section>

      <section
        className="provider-home__activities"
        aria-labelledby="activities"
      >
        <div className="provider-home__section-heading">
          <div>
            <p>What you might find</p>
            <h2 id="activities">A little taste of {config.displayName}</h2>
          </div>
          <p>Availability is checked live through Serendipity.</p>
        </div>
        <ol>
          {config.activities.map((activity, index) => (
            <li key={activity}>
              <span className="provider-home__activity-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <strong>{activity}</strong>
              <span
                aria-hidden="true"
                className="provider-home__activity-arrow"
              >
                ↗
              </span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="provider-home__footer">
        <span aria-hidden="true" className="provider-home__webmcp-mark">
          ✣
        </span>
        <p>Independent Provider site · Connected to Serendipity via WebMCP</p>
      </footer>
    </main>
  );
}
