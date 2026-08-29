import Image from "next/image";
import Link from "next/link";

const providers = [
  {
    copy: "Make something with your hands before the night speeds up.",
    image: "/brand/kiln-vignette.webp",
    name: "Kiln",
    type: "Workshop",
  },
  {
    copy: "Pause for a small seasonal tasting at an intimate counter.",
    image: "/brand/nori-vignette.webp",
    name: "Nori",
    type: "Food",
  },
  {
    copy: "Finish inside an experimental listening room made for one.",
    image: "/brand/loop-vignette.webp",
    name: "Loop",
    type: "Culture",
  },
] as const;

const steps = [
  {
    copy: "Choose a mood, start time, and budget. Serendipity checks all three demo Providers.",
    number: "01",
    title: "Discover",
  },
  {
    copy: "Set the complete route aside for 90 seconds. If one stop fails, the others are released safely.",
    number: "02",
    title: "Hold",
  },
  {
    copy: "Review the full route and confirm the demo reservation only when every Provider agrees.",
    number: "03",
    title: "Confirm",
  },
] as const;

export function LandingPage({
  plannerHref = "/plan",
}: {
  readonly plannerHref?: string;
}) {
  return (
    <div className="marketing-shell">
      <a className="skip-link" href="#landing-main">
        Skip to the story
      </a>
      <header className="marketing-nav">
        <Link
          aria-label="Serendipity home"
          className="wordmark"
          href="/"
          translate="no"
        >
          SERENDIPITY<span aria-hidden="true">✦</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How It Works</a>
          <a href="#network">Network</a>
          <a href="#safety">Safety</a>
        </nav>
        <Link className="marketing-nav__plan" href={plannerHref}>
          Open Planner
        </Link>
      </header>

      <main id="landing-main">
        <section className="marketing-hero">
          <div className="marketing-hero__copy">
            <p className="marketing-eyebrow">Shibuya launch network · solo</p>
            <h1>Three places. One unexpectedly good night.</h1>
            <p className="marketing-hero__lede">
              Serendipity turns current demo availability from three independent
              sites into one route that actually fits your time and budget.
            </p>
            <div className="marketing-hero__actions">
              <Link className="marketing-primary" href={plannerHref}>
                Plan a Shibuya night <span aria-hidden="true">→</span>
              </Link>
              <a className="marketing-secondary" href="#how-it-works">
                See how it works
              </a>
            </div>
            <ul className="marketing-trust" aria-label="Demo boundaries">
              <li>Demo only</li>
              <li>No payment</li>
              <li>90-second reversible hold</li>
            </ul>
          </div>
          <div className="marketing-hero__visual">
            <Image
              alt="Cut-paper illustration connecting pottery, seasonal tasting, and a listening room into one evening route"
              height={941}
              priority
              sizes="(max-width: 767px) 100vw, 58vw"
              src="/brand/serendipity-night-hero.webp"
              width={1672}
            />
          </div>
        </section>

        <section
          aria-labelledby="preview-heading"
          className="marketing-preview"
        >
          <div className="marketing-section-heading">
            <p className="marketing-eyebrow">Example—not live availability</p>
            <h2 id="preview-heading">A full night, already made feasible.</h2>
          </div>
          <div className="marketing-route-preview">
            <article data-provider="kiln">
              <span>18:15</span>
              <strong>Beginner pottery</strong>
              <small>Kiln</small>
            </article>
            <p>20 min travel</p>
            <article data-provider="nori">
              <span>19:40</span>
              <strong>Seasonal counter tasting</strong>
              <small>Nori</small>
            </article>
            <p>18 min travel</p>
            <article data-provider="loop">
              <span>21:00</span>
              <strong>Experimental listening room</strong>
              <small>Loop</small>
            </article>
          </div>
        </section>

        <section
          aria-labelledby="how-heading"
          className="marketing-section"
          id="how-it-works"
        >
          <div className="marketing-section-heading">
            <p className="marketing-eyebrow">Three deliberate steps</p>
            <h2 id="how-heading">Spontaneous does not have to mean risky.</h2>
          </div>
          <ol className="marketing-steps">
            {steps.map((step) => (
              <li key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="network-heading"
          className="marketing-section"
          id="network"
        >
          <div className="marketing-section-heading">
            <p className="marketing-eyebrow">Three independent demo sites</p>
            <h2 id="network-heading">Each stop keeps its own identity.</h2>
          </div>
          <div className="marketing-provider-grid">
            {providers.map((provider) => (
              <article
                data-provider={provider.name.toLowerCase()}
                key={provider.name}
              >
                <Image
                  alt={`Editorial illustration of the ${provider.name} ${provider.type.toLowerCase()} experience`}
                  height={1254}
                  loading="lazy"
                  sizes="(max-width: 767px) 100vw, 33vw"
                  src={provider.image}
                  width={1254}
                />
                <div>
                  <p>{provider.type}</p>
                  <h3 translate="no">{provider.name}</h3>
                  <span>{provider.copy}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="safety-heading"
          className="marketing-safety"
          id="safety"
        >
          <div>
            <p className="marketing-eyebrow">Human and agent, one live page</p>
            <h2 id="safety-heading">The useful part of WebMCP is visible.</h2>
          </div>
          <div className="marketing-safety__copy">
            <p>
              On the planner, five high-level Site Tools use the same validated
              actions as the visible controls. Search stays read-only. Hold,
              confirm, and release remain explicit.
            </p>
            <p>
              This launch is an honest Shibuya-only, solo demo. It creates no
              paid booking and exposes only Provider-safe references.
            </p>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <Link className="wordmark" href="/" translate="no">
          SERENDIPITY<span aria-hidden="true">✦</span>
        </Link>
        <p>One tiny plan for a bigger night.</p>
        <Link href={plannerHref}>Open the planner</Link>
      </footer>
    </div>
  );
}
