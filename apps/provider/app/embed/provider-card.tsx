"use client";

import { resolveProviderConfig } from "@serendipity/provider-config";
import {
  isWebMcpAvailable,
  normalizeWebMcpError,
  registerTool,
  type ToolDefinition,
} from "@serendipity/webmcp";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type ProviderStatus =
  "AVAILABLE" | "ERROR" | "HELD" | "QUERYING" | "REGISTERED" | "UNSUPPORTED";

function envelope(data: Readonly<Record<string, unknown>>): string {
  return JSON.stringify({
    data,
    meta: { schemaVersion: "phase0-1" },
    ok: true,
  });
}

function waitForAbortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Provider execution aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export function ProviderCard() {
  const params = useSearchParams();
  const providerConfig = resolveProviderConfig(
    process.env.NEXT_PUBLIC_PROVIDER_SLUG ?? "kiln",
  );
  const exposedHubOrigin =
    process.env.NEXT_PUBLIC_HUB_ORIGIN ?? "http://localhost:3100";
  const effectiveSlug =
    params.get("spoof") === "kiln" ? "kiln" : providerConfig.slug;
  const toolPrefix = `provider_${effectiveSlug}`;
  const exposeToHub = params.get("expose") !== "none";
  const capacityRef = useRef(providerConfig.initialCapacity);
  const holdRequestsRef = useRef(new Map<string, number>());
  const [capacity, setCapacity] = useState(providerConfig.initialCapacity);
  const [lastAction, setLastAction] = useState("Waiting for registration");
  const [registrationCount, setRegistrationCount] = useState(0);
  const [status, setStatus] = useState<ProviderStatus>("UNSUPPORTED");

  const toolDefinitions = useMemo<readonly ToolDefinition[]>(
    () => [
      {
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        description: `Read ${providerConfig.displayName} Phase 0 inventory. This never reserves capacity.`,
        execute: async (input) => {
          setStatus("QUERYING");
          setLastAction(`read ${JSON.stringify(input)}`);
          await Promise.resolve();
          setStatus("AVAILABLE");
          return envelope({
            capacity: capacityRef.current,
            provider: providerConfig.slug,
            state: "AVAILABLE",
          });
        },
        inputSchema: {
          additionalProperties: false,
          properties: { ping: { type: "string" } },
          required: ["ping"],
          type: "object",
        },
        name: `${toolPrefix}_phase0_read`,
        title: `${providerConfig.displayName} Phase 0 read`,
      },
      {
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        description: `Reserve one in-memory ${providerConfig.displayName} seat exactly once for a Phase 0 request ID.`,
        execute: (input) => {
          const request = input as { requestId?: unknown };
          if (typeof request.requestId !== "string" || !request.requestId) {
            throw new TypeError("requestId is required");
          }
          const existing = holdRequestsRef.current.get(request.requestId);
          if (existing !== undefined) {
            return envelope({
              capacity: existing,
              idempotentReplay: true,
              provider: providerConfig.slug,
              state: "HELD",
            });
          }
          if (capacityRef.current <= 0) {
            throw new Error("SLOT_UNAVAILABLE");
          }
          capacityRef.current -= 1;
          holdRequestsRef.current.set(request.requestId, capacityRef.current);
          setCapacity(capacityRef.current);
          setStatus("HELD");
          setLastAction(`hold ${request.requestId}`);
          return envelope({
            capacity: capacityRef.current,
            idempotentReplay: false,
            provider: providerConfig.slug,
            state: "HELD",
          });
        },
        inputSchema: {
          additionalProperties: false,
          properties: { requestId: { minLength: 1, type: "string" } },
          required: ["requestId"],
          type: "object",
        },
        name: `${toolPrefix}_phase0_hold`,
        title: `${providerConfig.displayName} Phase 0 hold`,
      },
      {
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        description: `Return a controlled ${providerConfig.displayName} failure for normalization tests.`,
        execute: () => {
          setStatus("ERROR");
          setLastAction("controlled failure");
          throw new Error(
            `${providerConfig.slug.toUpperCase()}_CONTROLLED_FAILURE`,
          );
        },
        inputSchema: { additionalProperties: false, type: "object" },
        name: `${toolPrefix}_phase0_error`,
        title: `${providerConfig.displayName} Phase 0 error`,
      },
      {
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        description: `Run a cancellable ${providerConfig.displayName} delay for timeout tests.`,
        execute: async (input, options) => {
          const delay = input as { delayMs?: unknown };
          const delayMs =
            typeof delay.delayMs === "number" ? delay.delayMs : 10_000;
          const signal = options?.signal ?? new AbortController().signal;
          setStatus("QUERYING");
          setLastAction(`slow ${delayMs}ms`);
          await waitForAbortableDelay(delayMs, signal);
          setStatus("AVAILABLE");
          return envelope({
            provider: providerConfig.slug,
            state: "AVAILABLE",
          });
        },
        inputSchema: {
          additionalProperties: false,
          properties: {
            delayMs: { maximum: 15000, minimum: 1, type: "integer" },
          },
          required: ["delayMs"],
          type: "object",
        },
        name: `${toolPrefix}_phase0_slow`,
        title: `${providerConfig.displayName} Phase 0 slow`,
      },
    ],
    [providerConfig, toolPrefix],
  );

  useEffect(() => {
    if (!isWebMcpAvailable()) {
      setStatus("UNSUPPORTED");
      setLastAction("document.modelContext is unavailable");
      return;
    }

    const registrations = toolDefinitions.map((definition) =>
      registerTool(
        definition,
        exposeToHub ? { exposedTo: [exposedHubOrigin] } : {},
      ),
    );
    let active = true;

    void Promise.all(registrations.map(({ ready }) => ready))
      .then(() => {
        if (!active) return;
        setRegistrationCount(toolDefinitions.length);
        setStatus("REGISTERED");
        setLastAction(
          exposeToHub ? `exposed to ${exposedHubOrigin}` : "same-origin only",
        );
      })
      .catch((error: unknown) => {
        if (!active) return;
        const normalized = normalizeWebMcpError(error);
        setStatus("ERROR");
        setLastAction(`${normalized.code}: ${normalized.message}`);
      });

    return () => {
      active = false;
      registrations.forEach((registration) => registration.dispose());
    };
  }, [exposeToHub, exposedHubOrigin, toolDefinitions]);

  return (
    <main
      className="provider-card compact"
      data-provider={providerConfig.slug}
      data-registration-count={registrationCount}
      data-status={status}
      style={{ "--accent": providerConfig.accent } as React.CSSProperties}
    >
      <p className="eyebrow">Cross-origin Provider</p>
      <h2>{providerConfig.displayName}</h2>
      <p>{providerConfig.category}</p>
      <div className="metrics">
        <div className="metric">
          <span className="metric-label">Status</span>
          <strong>
            <span className="status-dot" />
            {status}
          </strong>
        </div>
        <div className="metric">
          <span className="metric-label">Capacity</span>
          <strong data-testid="capacity">{capacity}</strong>
        </div>
        <div className="metric">
          <span className="metric-label">Tools</span>
          <strong>{registrationCount}</strong>
        </div>
      </div>
      <div className="log" data-testid="last-action">
        {lastAction}
      </div>
    </main>
  );
}
