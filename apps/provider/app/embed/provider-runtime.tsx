"use client";

import { resolveProviderConfig } from "@serendipity/provider-config";
import { isWebMcpAvailable, normalizeWebMcpError } from "@serendipity/webmcp";
import { useEffect, useState } from "react";

import {
  createProviderToolDefinitions,
  registerProviderTools,
} from "../../lib/tools/provider-tools";
import {
  acceptManualBind,
  acceptManualPresentation,
  createProviderReadyMessage,
} from "../../lib/manual-presentation";
import {
  ProviderCardView,
  initialProviderPresentation,
  reduceProviderPresentation,
  type ProviderPresentation,
} from "./provider-card-view";

export function ProviderRuntime({
  accessToken,
  browserSessionId,
  exposedHubOrigin,
}: {
  readonly accessToken: string;
  readonly browserSessionId: string;
  readonly exposedHubOrigin: string;
}) {
  const config = resolveProviderConfig(
    process.env.NEXT_PUBLIC_PROVIDER_SLUG ?? "kiln",
  );
  const [presentation, setPresentation] = useState<ProviderPresentation>(
    initialProviderPresentation,
  );
  const [originLabel, setOriginLabel] = useState(`${config.slug} · loading`);
  const [registrationCount, setRegistrationCount] = useState(0);

  useEffect(() => {
    setOriginLabel(`${config.slug} · ${window.location.host}`);
    if (!isWebMcpAvailable()) {
      setPresentation({
        connectionLabel: "Manual connection",
        latestAction: "Waiting for a Serendipity request",
        operationLabel: "Ready",
      });
      setRegistrationCount(0);
      return;
    }

    const definitions = createProviderToolDefinitions({
      accessToken,
      browserSessionId,
      fetcher: window.fetch.bind(window),
      now: () => new Date(),
      onEvent: (event) =>
        setPresentation((current) =>
          reduceProviderPresentation(current, event),
        ),
      origin: window.location.origin,
      provider: config.slug,
      storage: window.sessionStorage,
      uuid: () => window.crypto.randomUUID(),
    });
    const registration = registerProviderTools(definitions, {
      exposedTo: [exposedHubOrigin],
    });
    let active = true;
    void registration.ready
      .then(() => {
        if (!active) return;
        setRegistrationCount(definitions.length);
        setPresentation((current) => ({
          ...current,
          connectionLabel: "Live site",
          latestAction: "Waiting for a Serendipity request",
        }));
      })
      .catch((error: unknown) => {
        if (!active) return;
        const normalized = normalizeWebMcpError(error);
        setRegistrationCount(0);
        setPresentation({
          connectionLabel: "Unavailable",
          latestAction: `Provider registration needs attention · ${normalized.code}`,
          operationLabel: "Needs attention",
        });
      });

    return () => {
      active = false;
      registration.dispose();
    };
  }, [accessToken, browserSessionId, config.slug, exposedHubOrigin]);

  useEffect(() => {
    const frameInstanceId = window.crypto.randomUUID();
    let bound = false;
    const context = {
      browserSessionId,
      frameInstanceId,
      hubOrigin: exposedHubOrigin,
      provider: config.slug,
      sourceIsParent: true,
    } as const;
    const announceReady = () =>
      window.parent.postMessage(
        createProviderReadyMessage(config.slug, frameInstanceId),
        exposedHubOrigin,
      );
    let retryReady: ReturnType<typeof globalThis.setInterval> | null = null;
    const onMessage = (event: MessageEvent<unknown>) => {
      const scopedContext = {
        ...context,
        sourceIsParent: event.source === window.parent,
      };
      if (acceptManualBind(event.data, event.origin, scopedContext)) {
        bound = true;
        if (retryReady !== null) globalThis.clearInterval(retryReady);
        return;
      }
      if (!bound) return;
      const next = acceptManualPresentation(
        event.data,
        event.origin,
        scopedContext,
      );
      if (next) setPresentation(next);
    };
    window.addEventListener("message", onMessage);
    retryReady = globalThis.setInterval(() => {
      if (!bound) announceReady();
    }, 500);
    announceReady();
    return () => {
      if (retryReady !== null) globalThis.clearInterval(retryReady);
      window.removeEventListener("message", onMessage);
    };
  }, [browserSessionId, config.slug, exposedHubOrigin]);

  return (
    <div data-registration-count={registrationCount}>
      <ProviderCardView
        config={config}
        originLabel={originLabel}
        presentation={presentation}
      />
    </div>
  );
}
