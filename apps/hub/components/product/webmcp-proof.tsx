"use client";

import type { BundleSummary, Provider } from "@serendipity/contracts";
import { useState } from "react";

import { ToolActivity } from "./tool-activity";
import type { ToolActivityItem } from "./types";

const providerNames: Record<Provider, string> = {
  kiln: "Kiln",
  nori: "Nori",
  loop: "Loop",
};

function RouteProof({ bundle }: { readonly bundle: BundleSummary | null }) {
  if (!bundle) {
    return (
      <section aria-labelledby="route-proof-heading" className="route-proof">
        <p className="section-kicker">Route proof</p>
        <h3 id="route-proof-heading">One route, three independent sites</h3>
        <p>
          The ordered route will appear after the three searches are composed.
        </p>
      </section>
    );
  }

  const points = bundle.items.map(({ slot }) => ({
    x: Math.min(92, Math.max(8, slot.location.mapX)),
    y: Math.min(84, Math.max(16, slot.location.mapY)),
  }));
  const path = points.map(({ x, y }) => `${x},${y}`).join(" ");
  return (
    <section aria-labelledby="route-proof-heading" className="route-proof">
      <p className="section-kicker">Route proof</p>
      <h3 id="route-proof-heading">One route, three independent sites</h3>
      <svg
        aria-hidden="true"
        className="route-svg"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <polyline fill="none" points={path} vectorEffect="non-scaling-stroke" />
        {points.map((point, index) => (
          <g key={`${point.x}-${point.y}`}>
            <circle cx={point.x} cy={point.y} r="6" />
            <text x={point.x} y={point.y + 2} textAnchor="middle">
              {index + 1}
            </text>
          </g>
        ))}
      </svg>
      <ol className="route-text">
        {bundle.items.map(({ slot }, index) => (
          <li key={slot.slotId}>
            <span>{index + 1}</span>
            <strong>{slot.title}</strong>
            <small>{slot.location.name}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ProviderFrames({
  browserSessionId,
  open,
  origins,
}: {
  readonly browserSessionId: string;
  readonly open: boolean;
  readonly origins: Record<Provider, string>;
}) {
  return (
    <section
      aria-labelledby="provider-frames-heading"
      className="provider-frames"
    >
      <div className="proof-subheading">
        <div>
          <p className="section-kicker">Real embedded documents</p>
          <h3 id="provider-frames-heading">Provider pages</h3>
        </div>
        <span>exact origins</span>
      </div>
      <div className="provider-frame-grid">
        {(["kiln", "nori", "loop"] as const).map((provider) => {
          const origin = origins[provider];
          const source = `${origin}/embed?session=${encodeURIComponent(browserSessionId)}`;
          return (
            <figure key={provider}>
              <iframe
                allow="tools"
                aria-hidden={!open}
                loading="eager"
                src={source}
                tabIndex={open ? 0 : -1}
                title={`${providerNames[provider]} live Provider page`}
              />
              <figcaption>
                <strong>{providerNames[provider]}</strong>
                <span>{origin}</span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}

export function WebMcpProof({
  activities,
  browserSessionId,
  bundle,
  connectionMode,
  origins,
}: {
  readonly activities: readonly ToolActivityItem[];
  readonly browserSessionId: string;
  readonly bundle: BundleSummary | null;
  readonly connectionMode: "manual" | "webmcp";
  readonly origins: Record<Provider, string>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="webmcp-proof"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>
          <span aria-hidden="true" className="proof-dot" />
          {connectionMode === "webmcp"
            ? "See WebMCP in action"
            : "See the live site architecture"}
        </span>
        <small>{activities.length} safe events</small>
      </summary>
      <div className="proof-body">
        <header className="proof-intro">
          <p className="section-kicker">The visible architecture</p>
          <h2>Three live sites. One city night.</h2>
          <p>
            {connectionMode === "webmcp"
              ? "The Hub exposes five top-level Site Tools, coordinates three independent Provider APIs, and shows only safe references."
              : "The same three independent Provider sites stay visible while this browser uses the secure manual fallback. No live Site Tool claim is made."}
          </p>
        </header>
        {open ? (
          <ProviderFrames
            browserSessionId={browserSessionId}
            open={open}
            origins={origins}
          />
        ) : null}
        <RouteProof bundle={bundle} />
        <ToolActivity items={activities} />
      </div>
    </details>
  );
}
