import type {
  ExecutionEncoding,
  ModelContextLike,
  NormalizedWebMcpError,
  RegisteredTool,
  RegisterToolOptions,
  ToolDefinition,
} from "./types";

export type {
  ExecutionEncoding,
  ModelContextLike,
  NormalizedWebMcpError,
  RegisteredTool,
  RegisterToolOptions,
  ToolDefinition,
  WebMcpDocument,
} from "./types";

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function exactSecureOrigin(value: string): string {
  if (value.includes("*")) {
    throw new Error("Origin wildcards are forbidden");
  }

  const parsed = new URL(value);
  const isLocalHttp =
    parsed.protocol === "http:" && localHosts.has(parsed.hostname);
  if (parsed.protocol !== "https:" && !isLocalHttp) {
    throw new Error("WebMCP origins must use HTTPS outside localhost");
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("Expected an exact origin");
  }
  return parsed.origin;
}

export function getModelContext(
  source: Document = document,
): ModelContextLike | undefined {
  return source.modelContext;
}

export function isWebMcpAvailable(source: Document = document): boolean {
  const context = getModelContext(source);
  return Boolean(
    context &&
    typeof context.registerTool === "function" &&
    typeof context.getTools === "function" &&
    typeof context.executeTool === "function",
  );
}

export function normalizeWebMcpError(
  error: unknown,
  fallbackCode: NormalizedWebMcpError["code"] = "TRANSPORT_ERROR",
): NormalizedWebMcpError {
  const name = error instanceof Error ? error.name : "Error";
  const rawMessage =
    error instanceof Error ? error.message : "WebMCP call failed";
  const message = rawMessage.slice(0, 240);
  const lower = `${name} ${message}`.toLowerCase();

  let code = fallbackCode;
  if (lower.includes("abort")) code = "ABORTED";
  else if (lower.includes("timeout")) code = "TIMEOUT";
  else if (lower.includes("permission") || lower.includes("notallowed")) {
    code = "PERMISSION_DENIED";
  } else if (lower.includes("not supported") || lower.includes("undefined")) {
    code = "NOT_SUPPORTED";
  }

  return { code, message, name };
}

function requireContext(source: Document): ModelContextLike {
  const context = getModelContext(source);
  if (!context) {
    throw Object.assign(new Error("WebMCP is not supported in this document"), {
      name: "NotSupportedError",
    });
  }
  return context;
}

export interface RegistrationHandle {
  readonly ready: Promise<void>;
  dispose(): void;
}

export function registerTool(
  definition: ToolDefinition,
  options: Omit<RegisterToolOptions, "signal"> = {},
  source: Document = document,
): RegistrationHandle {
  const controller = new AbortController();
  const context = requireContext(source);
  const exposedTo = options.exposedTo?.map(exactSecureOrigin);
  const ready = Promise.resolve(
    context.registerTool(definition, {
      ...(exposedTo ? { exposedTo } : {}),
      signal: controller.signal,
    }),
  );

  return {
    dispose() {
      controller.abort();
    },
    ready,
  };
}

export interface DiscoverRequest {
  readonly expected: readonly {
    readonly name: string;
    readonly origin: string;
  }[];
  readonly fromOrigins: readonly string[];
}

export interface DiscoveryResult {
  readonly ignored: readonly {
    readonly name: string;
    readonly origin: string;
    readonly reason: "ORIGIN_MISMATCH" | "UNEXPECTED_TOOL";
  }[];
  readonly tools: readonly RegisteredTool[];
}

export async function discoverExactTools(
  request: DiscoverRequest,
  source: Document = document,
): Promise<DiscoveryResult> {
  const context = requireContext(source);
  const fromOrigins = request.fromOrigins.map(exactSecureOrigin);
  const expected = new Map(
    request.expected.map(({ name, origin }) => [
      name,
      exactSecureOrigin(origin),
    ]),
  );
  const discovered = await context.getTools({ fromOrigins });
  const tools: RegisteredTool[] = [];
  const ignored: DiscoveryResult["ignored"][number][] = [];

  for (const tool of discovered) {
    const expectedOrigin = expected.get(tool.name);
    if (!expectedOrigin) {
      continue;
    }
    if (tool.origin !== expectedOrigin) {
      ignored.push({
        name: tool.name,
        origin: tool.origin ?? "same-origin",
        reason: "ORIGIN_MISMATCH",
      });
      continue;
    }
    tools.push(tool);
  }

  return { ignored, tools };
}

export interface ExecuteRequest {
  readonly encoding: ExecutionEncoding;
  readonly input: Readonly<Record<string, unknown>>;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export async function executeTool(
  tool: RegisteredTool,
  request: ExecuteRequest,
  source: Document = document,
): Promise<null | string> {
  const context = requireContext(source);
  const controller = new AbortController();
  const timeoutMs = request.timeoutMs ?? 5_000;
  let timedOut = false;
  const onAbort = () => controller.abort(request.signal?.reason);

  if (request.signal?.aborted) {
    controller.abort(request.signal.reason);
  } else {
    request.signal?.addEventListener("abort", onAbort, { once: true });
  }

  const timeout = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort(
      new DOMException("WebMCP execution timeout", "TimeoutError"),
    );
  }, timeoutMs);

  const encodedInput =
    request.encoding === "json-string"
      ? JSON.stringify(request.input)
      : request.input;

  try {
    return await context.executeTool(tool, encodedInput, {
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw Object.assign(new Error("WebMCP execution timeout"), {
        name: "TimeoutError",
      });
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    request.signal?.removeEventListener("abort", onAbort);
  }
}

export interface EncodingProbeResult {
  readonly accepted: readonly ExecutionEncoding[];
  readonly attempts: readonly {
    readonly encoding: ExecutionEncoding;
    readonly error?: NormalizedWebMcpError;
    readonly result?: null | string;
  }[];
}

export async function probeExecutionEncodings(
  readOnlyTool: RegisteredTool,
  input: Readonly<Record<string, unknown>>,
  source: Document = document,
): Promise<EncodingProbeResult> {
  const attempts: EncodingProbeResult["attempts"][number][] = [];
  const encodings: readonly ExecutionEncoding[] = ["object", "json-string"];

  for (const encoding of encodings) {
    try {
      const result = await executeTool(
        readOnlyTool,
        { encoding, input, timeoutMs: 2_000 },
        source,
      );
      attempts.push({ encoding, result });
    } catch (error) {
      attempts.push({ encoding, error: normalizeWebMcpError(error) });
    }
  }

  return {
    accepted: attempts
      .filter((attempt) => !attempt.error)
      .map((attempt) => attempt.encoding),
    attempts,
  };
}

export class ToolRegistryCache {
  #valid = true;
  readonly #context: ModelContextLike;
  readonly #invalidate = () => {
    this.#valid = false;
  };

  constructor(source: Document = document) {
    this.#context = requireContext(source);
    this.#context.addEventListener("toolchange", this.#invalidate);
  }

  get valid(): boolean {
    return this.#valid;
  }

  markFresh(): void {
    this.#valid = true;
  }

  dispose(): void {
    this.#context.removeEventListener("toolchange", this.#invalidate);
    this.#valid = false;
  }
}
