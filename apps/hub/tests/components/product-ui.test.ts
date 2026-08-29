import { composeBundles } from "@serendipity/bundle-engine";
import type { BundleSummary, Provider } from "@serendipity/contracts";
import {
  canonicalIntent,
  canonicalSlotsByProvider,
  canonicalTravelTimes,
} from "@serendipity/test-fixtures";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";

import { ProductView } from "../../components/product/product-view";
import type { ProviderProjection } from "../../components/product/types";

const origins: Record<Provider, string> = {
  kiln: "https://kiln.test",
  nori: "https://nori.test",
  loop: "https://loop.test",
};

const projection = (
  operation: ProviderProjection["operation"] = "Ready",
  connection: ProviderProjection["connection"] = "Live site",
): Record<Provider, ProviderProjection> => ({
  kiln: { connection, operation },
  nori: { connection, operation },
  loop: { connection, operation },
});

const noop = () => undefined;

describe("Sticker Network Hub product states", () => {
  let bundle: NonNullable<ComponentProps<typeof ProductView>["selected"]>;
  let candidates: BundleSummary[];

  beforeAll(async () => {
    const result = await composeBundles({
      bundleVersion: 1,
      intent: canonicalIntent,
      slotsByProvider: canonicalSlotsByProvider,
      travelTimes: canonicalTravelTimes,
    });
    if (!result.ok || !result.candidates[0]) {
      throw new Error("canonical product bundle was not composed");
    }
    candidates = result.candidates;
    bundle = candidates[0]!;
  });

  const render = (
    overrides: Partial<ComponentProps<typeof ProductView>> = {},
  ): string =>
    renderToStaticMarkup(
      createElement(ProductView, {
        activities: [],
        alternatives: [],
        browserSessionId: "11111111-1111-4111-8111-111111111111",
        connectionMode: "webmcp",
        errorCode: null,
        expiresAt: null,
        mood: "Surprising",
        onConfirm: noop,
        onExpired: noop,
        onHold: noop,
        onMood: noop,
        onPlan: noop,
        onRelease: noop,
        onReleaseAndLeave: noop,
        onReset: noop,
        onSelect: noop,
        origins,
        phase: "idle",
        projections: projection(),
        receipt: null,
        recovery: null,
        requiresFreshSearch: false,
        selected: null,
        ...overrides,
      }),
    );

  it("keeps the idle invitation dominant without loading closed proof frames", () => {
    const html = render();

    expect(html).toContain("What kind of tonight?");
    expect(html).toContain("Shibuya launch network");
    expect(html).toContain("Plan my night");
    expect(html).toContain("See WebMCP in action");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("/embed?session=");
  });

  it("keeps time and budget behind one closed native disclosure", () => {
    const html = render({
      constraints: { startTime: "18:30", totalBudgetYen: 6000 },
    });

    expect(html).toContain("Adjust time &amp; budget");
    expect(html).toContain("18:30 · ¥6,000");
    expect(html).toContain("Shibuya launch network");
    expect(html).toContain("from 18:30");
    expect(html).toContain("up to ¥6,000");
    expect(html).not.toContain('<details class="constraint-adjuster" open');
    expect(html.match(/journey-primary/g)).toHaveLength(1);
  });

  it("names real search progress and never renders a premature Held stamp", () => {
    const html = render({
      phase: "discovering",
      projections: projection("Checking"),
    });

    expect(html).toContain("Checking three sites…");
    expect(html).toContain("Checking");
    expect(html).not.toContain(">Held<");
    expect(html).not.toContain(">Confirmed<");
  });

  it("renders a composed route as three large ordered bands with one hold action", () => {
    const html = render({
      alternatives: [bundle],
      phase: "composed",
      projections: projection("Found"),
      selected: bundle,
    });

    expect(html).toContain("Tonight got interesting.");
    expect(html).toContain("A surprising 3-stop route");
    expect(html.match(/class="stop-band"/g)).toHaveLength(3);
    expect(html).toContain("Hold for 90 seconds");
    expect(html).toContain("min travel");
    expect(html).toContain("min spare");
    expect(html).toContain(
      "A hold temporarily sets these three available stops aside",
    );
    expect(html).toContain("no payment will be taken");
  });

  it("keeps route numbers and comparison details stable after selection", () => {
    expect(candidates).toHaveLength(3);
    const third = candidates[2]!;
    const html = render({
      alternatives: [candidates[0]!, candidates[1]!],
      candidateOrder: candidates.map(({ bundleId }) => bundleId),
      phase: "composed",
      selected: third,
    });

    expect(html).toContain("Your three-stop route · Route 3");
    expect(html).toContain("Route 1");
    expect(html).toContain("Route 2");
    expect(html).not.toContain("Option 2");
    for (const alternative of [candidates[0]!, candidates[1]!]) {
      expect(html).toContain(alternative.items[0]!.slot.title);
      expect(html).toContain(`${alternative.totalTravelMinutes} min travel`);
    }
  });

  it("separates no-result and safe error states without inventing partial inventory", () => {
    const noResults = render({
      constraints: { startTime: "19:00", totalBudgetYen: 4500 },
      phase: "no_results",
      projections: projection("Checked — no match"),
    });
    const failed = render({
      errorCode: "PROVIDER_OFFLINE",
      phase: "error",
      projections: projection("Needs attention"),
    });

    expect(noResults).toContain("Nothing fits exactly—yet.");
    expect(noResults).toContain("19:00–22:30");
    expect(noResults).toContain("¥4,500");
    expect(noResults).toContain("Adjust time, budget, or mood");
    expect(noResults).toContain("never fill a route with invented or partial");
    expect(failed).toContain("The route paused.");
    expect(failed).toContain("could not be reached safely");
  });

  it("shows authoritative held, confirmed, and recovery projections with safe copy", () => {
    const held = render({
      expiresAt: "2030-05-17T09:01:30Z",
      phase: "held",
      projections: projection("Held"),
      selected: bundle,
    });
    const confirmed = render({
      phase: "confirmed",
      projections: projection("Confirmed"),
      receipt: {
        confirmedAt: "2030-05-17T09:01:00Z",
        reservations: [
          { provider: "kiln", reservationRef: "reservation-kiln-safe" },
          { provider: "nori", reservationRef: "reservation-nori-safe" },
          { provider: "loop", reservationRef: "reservation-loop-safe" },
        ],
      },
      selected: bundle,
    });
    const recovery = render({
      phase: "composed",
      projections: {
        kiln: { connection: "Live site", operation: "Released" },
        nori: { connection: "Live site", operation: "Needs attention" },
        loop: { connection: "Live site", operation: "Released" },
      },
      recovery: { failedProvider: "nori", replacement: bundle },
      selected: bundle,
    });

    expect(held).toContain("Your night is held.");
    expect(held).toContain("earliest hold");
    expect(confirmed).toContain("Your night is confirmed.");
    expect(confirmed).toContain("reservation-kiln-safe");
    expect(confirmed).not.toMatch(/holdToken|idempotencyKey|authorization/i);
    expect(recovery).toContain("Safely recovered");
    expect(recovery).toContain("Not held");
    expect(recovery).toContain("Released");
  });

  it("locks release and compensation recovery behind one safe next action", () => {
    const releasing = render({
      phase: "releasing",
      projections: projection("Releasing"),
      selected: bundle,
    });
    const blocked = render({
      compensationBlockedUntil: "2030-05-17T09:01:30Z",
      compensationSeconds: 75,
      errorCode: "COMPENSATION_INCOMPLETE",
      phase: "error",
      projections: projection("Needs attention"),
    });
    const retryRelease = render({
      errorCode: "PROVIDER_TIMEOUT",
      phase: "error",
      projections: projection("Needs attention"),
      recoveryAction: "retry-release",
    });
    const checkStatus = render({
      errorCode: "ALREADY_CONFIRMED",
      phase: "error",
      projections: projection("Needs attention"),
      recoveryAction: "check-status",
    });

    expect(releasing).toContain("Releasing your hold…");
    expect(releasing).toContain("Releasing all three temporary holds…");
    expect(releasing).not.toContain("Confirm demo reservation");
    expect(releasing).not.toContain("Release hold");
    expect(blocked).toContain("We could not verify every temporary release");
    expect(blocked).toContain("01:15");
    expect(blocked).toContain("Wait before searching again");
    expect(blocked).not.toContain("Start a fresh search");
    expect(retryRelease).toContain("Retry release safely");
    expect(checkStatus).toContain("Check latest Provider status");
  });

  it("labels unsupported browsers as manual and sanitizes visible activity", () => {
    const html = render({
      activities: [
        {
          completedAt: "2030-05-17T09:00:00Z",
          correlationId: "safe-correlation",
          provider: "nori",
          status: "Failed",
          toolName: "nori_search_slots",
          errorCode: "PROVIDER_TIMEOUT",
          durationMs: 1200,
          origin: "https://nori.test",
          transport: "manual",
        },
      ],
      connectionMode: "manual",
      projections: projection("Needs attention", "Manual connection"),
    });

    expect(html).toContain("This browser does not expose Site Tools.");
    expect(html).toContain("Manual connection");
    expect(html).toContain("3 Provider APIs · manual mode");
    expect(html).toContain("makes no Site Tool claim");
    expect(html).toContain('aria-label="Three Provider connection status"');
    expect(html).toContain("See the live site architecture");
    expect(html).toContain("Manual fallback");
    expect(html).toContain("1200 ms");
    expect(html).toContain("safe-correlation");
    expect(html).toContain("Search slots");
    expect(html).toContain("PROVIDER_TIMEOUT");
    expect(html).not.toMatch(/holdToken|authorization|secret/i);
  });

  it("does not announce Ready while a Provider is still Connecting", () => {
    const html = render({ projections: projection("Ready", "Connecting") });

    expect(html).toContain('aria-label="Kiln: Connecting"');
    expect(html).not.toContain('aria-label="Kiln: Connecting, Ready"');
    expect(html).not.toContain(">Ready<");
  });

  it("labels top-level Site Tool provenance without claiming iframe execution", () => {
    const html = render({
      activities: [
        {
          completedAt: "2030-05-17T09:00:00.000Z",
          correlationId: "site-tool-safe-correlation",
          durationMs: 48,
          origin: "https://hub.test",
          status: "Complete",
          toolName: "find_serendipity_options",
          transport: "site-tool",
        },
      ],
      phase: "composed",
      projections: projection("Found"),
      selected: bundle,
    });

    expect(html).toContain("Site tool");
    expect(html).toContain("Find serendipity options");
    expect(html).toContain("https://hub.test");
    expect(html).toContain("48 ms");
    expect(html).toContain("site-tool-safe-correlation");
    expect(html).toContain(
      "The Hub exposes five top-level Site Tools, coordinates three independent Provider APIs",
    );
    expect(html).not.toContain("Manual fallback");
    expect(html).not.toMatch(
      /iframe tool|tool executed in (?:an )?iframe|Provider iframe executed|Provider page ran a tool/i,
    );
    expect(html).not.toMatch(
      /(?:holdToken|accessToken|authorization|serviceRoleKey|secret)[=&quot;':]/i,
    );
  });
});
