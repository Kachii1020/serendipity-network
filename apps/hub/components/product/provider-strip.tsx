import type { Provider } from "@serendipity/contracts";

import type { ProviderProjection } from "./types";

const providerNames: Record<Provider, string> = {
  kiln: "Kiln",
  nori: "Nori",
  loop: "Loop",
};

const operationIcon: Record<ProviderProjection["operation"], string> = {
  Ready: "◎",
  Checking: "↻",
  Found: "✦",
  "Checked — no match": "○",
  Holding: "…",
  Held: "✓",
  Confirming: "…",
  Confirmed: "✓",
  Releasing: "↻",
  Released: "↗",
  "Needs attention": "!",
  Unknown: "?",
};

export function ProviderSticker({
  projection,
  provider,
}: {
  readonly projection: ProviderProjection;
  readonly provider: Provider;
}) {
  const isWaitingForConnection =
    projection.connection === "Connecting" && projection.operation === "Ready";
  const accessibleStatus = isWaitingForConnection
    ? `${providerNames[provider]}: ${projection.connection}`
    : `${providerNames[provider]}: ${projection.connection}, ${projection.operation}`;

  return (
    <article
      aria-label={accessibleStatus}
      className="provider-sticker"
      data-operation={projection.operation}
      data-provider={provider}
    >
      <div className="provider-sticker__name">
        <span aria-hidden="true" className="provider-sticker__mark">
          {provider === "kiln" ? "◡" : provider === "nori" ? "⌣" : "♪"}
        </span>
        <strong translate="no">{providerNames[provider]}</strong>
      </div>
      <div className="provider-sticker__status">
        <span>
          <span aria-hidden="true">●</span> {projection.connection}
        </span>
        {!isWaitingForConnection ? (
          <span>
            <span aria-hidden="true">
              {operationIcon[projection.operation]}
            </span>{" "}
            {projection.operation}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export function LiveProviderStrip({
  projections,
}: {
  readonly projections: Record<Provider, ProviderProjection>;
}) {
  return (
    <section
      aria-atomic="false"
      aria-label="Three Provider connection status"
      aria-live="polite"
      className="provider-strip"
    >
      {(["kiln", "nori", "loop"] as const).map((provider) => (
        <ProviderSticker
          key={provider}
          projection={projections[provider]}
          provider={provider}
        />
      ))}
    </section>
  );
}
