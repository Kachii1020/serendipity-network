import { describe, expect, it, vi } from "vitest";

import {
  discoverExactTools,
  exactSecureOrigin,
  executeTool,
  isWebMcpAvailable,
  normalizeWebMcpError,
  probeExecutionEncodings,
  registerTool,
  ToolRegistryCache,
  type ModelContextLike,
  type RegisteredTool,
} from "./index";

function fakeDocument(context?: Partial<ModelContextLike>): Document {
  const events = new EventTarget();
  const modelContext: ModelContextLike = {
    addEventListener: events.addEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
    executeTool: vi.fn(() => Promise.resolve("ok")),
    getTools: vi.fn(() => Promise.resolve([])),
    registerTool: vi.fn(() => Promise.resolve()),
    removeEventListener: events.removeEventListener.bind(events),
    ...context,
  };
  return { modelContext } as unknown as Document;
}

const kilnTool: RegisteredTool = {
  description: "read",
  inputSchema: { type: "object" },
  name: "provider_kiln_phase0_read",
  origin: "https://kiln.example.test",
};

describe("WebMCP compatibility adapter", () => {
  it("detects support without throwing", () => {
    expect(isWebMcpAvailable(fakeDocument())).toBe(true);
    expect(isWebMcpAvailable({} as Document)).toBe(false);
  });

  it.each([
    "https://*.example.test",
    "http://example.test",
    "https://example.test/path",
  ])("rejects unsafe or non-exact origin %s", (origin) => {
    expect(() => exactSecureOrigin(origin)).toThrow();
  });

  it("aborts a registration during lifecycle cleanup", async () => {
    let signal: AbortSignal | undefined;
    const register: ModelContextLike["registerTool"] = vi.fn(
      (_tool: unknown, options?: { readonly signal?: AbortSignal }) => {
        signal = options?.signal;
      },
    );
    const registration = registerTool(
      {
        description: "read",
        execute: () => "ok",
        inputSchema: { type: "object" },
        name: "read",
      },
      {},
      fakeDocument({ registerTool: register }),
    );
    await registration.ready;
    expect(signal?.aborted).toBe(false);
    registration.dispose();
    expect(signal?.aborted).toBe(true);
  });

  it("filters duplicate names from the wrong origin", async () => {
    const result = await discoverExactTools(
      {
        expected: [
          { name: kilnTool.name, origin: "https://kiln.example.test" },
        ],
        fromOrigins: ["https://kiln.example.test", "https://nori.example.test"],
      },
      fakeDocument({
        getTools: vi.fn(() =>
          Promise.resolve([
            kilnTool,
            { ...kilnTool, origin: "https://nori.example.test" },
          ]),
        ),
      }),
    );
    expect(result.tools).toEqual([kilnTool]);
    expect(result.ignored).toContainEqual(
      expect.objectContaining({ reason: "ORIGIN_MISMATCH" }),
    );
  });

  it("pins input serialization without retrying inside executeTool", async () => {
    let observedInput: Readonly<Record<string, unknown>> | string | undefined;
    let executeCalls = 0;
    const execute: ModelContextLike["executeTool"] = (_tool, input) => {
      executeCalls += 1;
      observedInput = input;
      return Promise.resolve("ok");
    };
    const source = fakeDocument({ executeTool: execute });
    await executeTool(
      kilnTool,
      { encoding: "json-string", input: { ping: "one" } },
      source,
    );
    expect(executeCalls).toBe(1);
    expect(observedInput).toBe('{"ping":"one"}');
  });

  it("probes both encodings only for an explicitly read-only tool", async () => {
    let executeCalls = 0;
    const execute: ModelContextLike["executeTool"] = (_tool, input) => {
      executeCalls += 1;
      if (typeof input === "object") {
        return Promise.reject(new TypeError("Expected string"));
      }
      return Promise.resolve("ok");
    };
    const result = await probeExecutionEncodings(
      kilnTool,
      { ping: "probe" },
      fakeDocument({ executeTool: execute }),
    );
    expect(result.accepted).toEqual(["json-string"]);
    expect(executeCalls).toBe(2);
  });

  it("normalizes permission, timeout, and abort failures", () => {
    expect(
      normalizeWebMcpError(new DOMException("denied", "NotAllowedError")).code,
    ).toBe("PERMISSION_DENIED");
    expect(normalizeWebMcpError(new Error("timeout")).code).toBe("TIMEOUT");
    expect(
      normalizeWebMcpError(new DOMException("aborted", "AbortError")).code,
    ).toBe("ABORTED");
  });

  it("invalidates cached references on toolchange", () => {
    const source = fakeDocument();
    const cache = new ToolRegistryCache(source);
    expect(cache.valid).toBe(true);
    source.modelContext?.dispatchEvent(new Event("toolchange"));
    expect(cache.valid).toBe(false);
    cache.markFresh();
    expect(cache.valid).toBe(true);
    cache.dispose();
    expect(cache.valid).toBe(false);
  });
});
