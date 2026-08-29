import {
  discoverExactTools,
  executeTool,
  normalizeWebMcpError,
  probeExecutionEncodings,
  type ExecutionEncoding,
  type RegisteredTool,
} from "@serendipity/webmcp";

const slugs = ["kiln", "nori"] as const;

export interface Phase0Result {
  readonly encoding: ExecutionEncoding;
  readonly ignored: readonly unknown[];
  readonly operation: string;
  readonly results: readonly {
    readonly name: string;
    readonly origin?: string;
    readonly result: null | string;
  }[];
}

function expectedTools(
  providerOrigins: readonly string[],
  suffix: "error" | "hold" | "read" | "slow",
) {
  return slugs.map((slug, index) => ({
    name: `provider_${slug}_phase0_${suffix}`,
    origin: providerOrigins[index] ?? "",
  }));
}

export async function discoverProviderTools(
  providerOrigins: readonly string[],
  suffix: "error" | "hold" | "read" | "slow",
) {
  return discoverExactTools({
    expected: expectedTools(providerOrigins, suffix),
    fromOrigins: providerOrigins,
  });
}

export async function runProviderReads(
  providerOrigins: readonly string[],
  encoding: ExecutionEncoding,
): Promise<Phase0Result> {
  const discovery = await discoverProviderTools(providerOrigins, "read");
  const results = await Promise.all(
    discovery.tools.map(async (tool) => ({
      name: tool.name,
      ...(tool.origin ? { origin: tool.origin } : {}),
      result: await executeTool(tool, {
        encoding,
        input: { ping: "phase0-read" },
      }),
    })),
  );
  return { encoding, ignored: discovery.ignored, operation: "read", results };
}

export async function runProviderHolds(
  providerOrigins: readonly string[],
  encoding: ExecutionEncoding,
  requestId: string,
): Promise<Phase0Result> {
  const discovery = await discoverProviderTools(providerOrigins, "hold");
  const results = await Promise.all(
    discovery.tools.map(async (tool) => ({
      name: tool.name,
      ...(tool.origin ? { origin: tool.origin } : {}),
      result: await executeTool(tool, {
        encoding,
        input: { requestId: `${requestId}:${tool.origin ?? tool.name}` },
      }),
    })),
  );
  return { encoding, ignored: discovery.ignored, operation: "hold", results };
}

export async function runControlledError(
  providerOrigins: readonly string[],
  encoding: ExecutionEncoding,
) {
  const discovery = await discoverProviderTools(providerOrigins, "error");
  const tool = discovery.tools[0];
  if (!tool) throw new Error("TOOL_NOT_FOUND");
  try {
    await executeTool(tool, { encoding, input: {} });
    return { ok: false, error: { code: "EXPECTED_ERROR_NOT_THROWN" } };
  } catch (error) {
    return { ok: true, error: normalizeWebMcpError(error) };
  }
}

export async function runAbortProbe(
  providerOrigins: readonly string[],
  encoding: ExecutionEncoding,
) {
  const discovery = await discoverProviderTools(providerOrigins, "slow");
  const tool = discovery.tools[0];
  if (!tool) throw new Error("TOOL_NOT_FOUND");
  try {
    await executeTool(tool, {
      encoding,
      input: { delayMs: 10_000 },
      timeoutMs: 120,
    });
    return { ok: false, error: { code: "EXPECTED_TIMEOUT_NOT_THROWN" } };
  } catch (error) {
    return { ok: true, error: normalizeWebMcpError(error) };
  }
}

export async function runEncodingProbe(providerOrigins: readonly string[]) {
  const discovery = await discoverProviderTools(providerOrigins, "read");
  const tool: RegisteredTool | undefined = discovery.tools[0];
  if (!tool) throw new Error("TOOL_NOT_FOUND");
  return probeExecutionEncodings(tool, { ping: "encoding-probe" });
}
