"use client";

import {
  executeTool,
  getModelContext,
  isWebMcpAvailable,
  normalizeWebMcpError,
  registerTool,
  ToolRegistryCache,
  type ExecutionEncoding,
  type RegisteredTool,
  type ToolDefinition,
} from "@serendipity/webmcp";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  discoverProviderTools,
  runAbortProbe,
  runControlledError,
  runEncodingProbe,
  runProviderHolds,
  runProviderReads,
} from "../lib/phase0";

declare global {
  interface Window {
    __phase0?: {
      discover: () => Promise<unknown>;
      encoding: () => Promise<unknown>;
      error: () => Promise<unknown>;
      hold: (requestId?: string) => Promise<unknown>;
      nestedHold: (requestId?: string) => Promise<unknown>;
      nestedRead: () => Promise<unknown>;
      read: () => Promise<unknown>;
      rediscoverAfterReload: (index?: number) => Promise<unknown>;
      timeout: () => Promise<unknown>;
    };
  }
}

const executionEncoding = (process.env.NEXT_PUBLIC_WEBMCP_EXECUTION_ENCODING ??
  "json-string") as ExecutionEncoding;

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function Phase0Hub({
  providerOrigins,
}: {
  readonly providerOrigins: readonly string[];
}) {
  const params = useSearchParams();
  const noriToolsDisabled = params.get("noriTools") === "disabled";
  const noriExposureDisabled = params.get("noriExposure") === "none";
  const noriSpoof = params.get("noriSpoof") === "kiln";
  const [diagnostics, setDiagnostics] = useState("No diagnostic has run yet.");
  const [hubRegistration, setHubRegistration] = useState("pending");
  const [supported, setSupported] = useState(false);
  const frameRefs = useRef<(HTMLIFrameElement | null)[]>([]);
  const cacheRef = useRef<ToolRegistryCache | null>(null);

  const providerFrameUrls = useMemo(
    () =>
      providerOrigins.map((origin, index) => {
        const url = new URL("/embed", origin);
        url.searchParams.set("phase0", "1");
        if (index === 1 && noriExposureDisabled)
          url.searchParams.set("expose", "none");
        if (index === 1 && noriSpoof) url.searchParams.set("spoof", "kiln");
        return url.toString();
      }),
    [noriExposureDisabled, noriSpoof, providerOrigins],
  );

  const runAndDisplay = useCallback(
    async (operation: () => Promise<unknown>) => {
      try {
        const result = await operation();
        setDiagnostics(stringify({ ok: true, result }));
        return result;
      } catch (error) {
        const normalized = normalizeWebMcpError(error);
        setDiagnostics(stringify({ error: normalized, ok: false }));
        throw error;
      }
    },
    [],
  );

  const invokeHubTool = useCallback(
    async (name: string, input: Readonly<Record<string, unknown>>) => {
      const context = getModelContext();
      if (!context) throw new Error("WebMCP is not supported");
      const tools = await context.getTools();
      const tool = tools.find((candidate) => candidate.name === name);
      if (!tool) throw new Error(`TOOL_NOT_FOUND: ${name}`);
      return executeTool(tool, {
        encoding: executionEncoding,
        input,
      });
    },
    [],
  );

  useEffect(() => {
    const available = isWebMcpAvailable();
    setSupported(available);
    if (!available) {
      setHubRegistration("unsupported");
      return;
    }

    cacheRef.current = new ToolRegistryCache();

    const tools: readonly ToolDefinition[] = [
      {
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        description:
          "Run the Serendipity Phase 0 nested read diagnostic across the exact Kiln and Nori iframe origins. This never reserves inventory.",
        execute: async () =>
          stringify(await runProviderReads(providerOrigins, executionEncoding)),
        inputSchema: { additionalProperties: false, type: "object" },
        name: "serendipity_phase0_nested_read",
        title: "Serendipity Phase 0 nested read",
      },
      {
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        description:
          "Run the Serendipity Phase 0 nested in-memory hold across Kiln and Nori after explicit user intent. Requires a unique requestId.",
        execute: async (input) => {
          const request = input as { requestId?: unknown };
          if (typeof request.requestId !== "string" || !request.requestId) {
            throw new TypeError("requestId is required");
          }
          return stringify(
            await runProviderHolds(
              providerOrigins,
              executionEncoding,
              request.requestId,
            ),
          );
        },
        inputSchema: {
          additionalProperties: false,
          properties: { requestId: { minLength: 1, type: "string" } },
          required: ["requestId"],
          type: "object",
        },
        name: "serendipity_phase0_nested_hold",
        title: "Serendipity Phase 0 nested hold",
      },
    ];

    const registrations = tools.map((tool) => registerTool(tool));
    let active = true;
    void Promise.all(registrations.map(({ ready }) => ready))
      .then(() => {
        if (active) setHubRegistration("registered");
      })
      .catch((error: unknown) => {
        if (active) setHubRegistration(normalizeWebMcpError(error).code);
      });

    return () => {
      active = false;
      registrations.forEach((registration) => registration.dispose());
      cacheRef.current?.dispose();
      cacheRef.current = null;
    };
  }, [providerOrigins]);

  useEffect(() => {
    const api = {
      discover: () => discoverProviderTools(providerOrigins, "read"),
      encoding: () => runEncodingProbe(providerOrigins),
      error: () => runControlledError(providerOrigins, executionEncoding),
      hold: (requestId = `direct-${Date.now()}`) =>
        runProviderHolds(providerOrigins, executionEncoding, requestId),
      nestedHold: (requestId = `nested-${Date.now()}`) =>
        invokeHubTool("serendipity_phase0_nested_hold", { requestId }),
      nestedRead: () => invokeHubTool("serendipity_phase0_nested_read", {}),
      read: () => runProviderReads(providerOrigins, executionEncoding),
      rediscoverAfterReload: async (index = 0) => {
        const initial = await discoverProviderTools(providerOrigins, "read");
        const cached: RegisteredTool | undefined = initial.tools[index];
        const frame = frameRefs.current[index];
        if (!cached || !frame) throw new Error("TOOL_NOT_FOUND");
        frame.setAttribute("src", frame.src);
        await new Promise((resolve) => {
          frame.addEventListener("load", resolve, { once: true });
        });
        await new Promise((resolve) => window.setTimeout(resolve, 100));
        const cacheValidAfterReload = cacheRef.current?.valid ?? false;
        const rediscovered = await discoverProviderTools(
          providerOrigins,
          "read",
        );
        return {
          cacheValidAfterReload,
          cachedName: cached.name,
          rediscovered: rediscovered.tools.map(({ name, origin }) => ({
            name,
            origin,
          })),
        };
      },
      timeout: () => runAbortProbe(providerOrigins, executionEncoding),
    };
    window.__phase0 = api;
    return () => {
      delete window.__phase0;
    };
  }, [invokeHubTool, providerOrigins]);

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Serendipity Network / Architecture gate</p>
          <h1>Phase 0</h1>
          <p className="hero-copy">
            Two real cross-origin Provider frames, one high-level Hub tool, and
            a deterministic diagnostic surface for nested WebMCP composition.
          </p>
        </div>
        <div
          className={`support-pill ${supported ? "supported" : ""}`}
          data-testid="webmcp-support"
        >
          {supported ? "WebMCP available" : "WebMCP unavailable"}
        </div>
      </header>

      <div className="grid">
        <section className="panel">
          <div className="panel-header">
            <h2>Live Provider network</h2>
            <span className="status-line" data-testid="hub-registration">
              Hub tools: {hubRegistration}
            </span>
          </div>
          <div className="provider-network">
            {providerFrameUrls.map((url, index) => (
              <iframe
                allow={index === 1 && noriToolsDisabled ? "" : "tools"}
                className="provider-frame"
                data-testid={`provider-frame-${index}`}
                key={providerOrigins[index]}
                ref={(frame) => {
                  frameRefs.current[index] = frame;
                }}
                src={url}
                title={`${index === 0 ? "Kiln" : "Nori"} Provider`}
              />
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Deterministic probes</h2>
            <span className="status-line">encoding: {executionEncoding}</span>
          </div>
          <div className="actions">
            <button
              onClick={() =>
                void runAndDisplay(() => window.__phase0!.discover())
              }
            >
              Discover
            </button>
            <button
              onClick={() => void runAndDisplay(() => window.__phase0!.read())}
            >
              Direct read
            </button>
            <button
              onClick={() =>
                void runAndDisplay(() => window.__phase0!.nestedRead())
              }
            >
              Nested read
            </button>
            <button
              onClick={() =>
                void runAndDisplay(() => window.__phase0!.nestedHold())
              }
            >
              Nested hold
            </button>
            <button
              className="secondary"
              onClick={() =>
                void runAndDisplay(() => window.__phase0!.encoding())
              }
            >
              Probe encoding
            </button>
            <button
              className="secondary"
              onClick={() =>
                void runAndDisplay(() => window.__phase0!.timeout())
              }
            >
              Probe timeout
            </button>
          </div>
          <pre
            aria-live="polite"
            className="diagnostics"
            data-testid="diagnostics"
          >
            {diagnostics}
          </pre>
        </section>
      </div>
    </main>
  );
}
