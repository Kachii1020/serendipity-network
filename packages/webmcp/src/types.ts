export type ExecutionEncoding = "json-string" | "object";

export interface ToolAnnotations {
  readonly readOnlyHint?: boolean;
  readonly untrustedContentHint?: boolean;
}

export interface ToolExecutionOptions {
  readonly signal: AbortSignal;
}

export interface ToolDefinition {
  readonly annotations?: ToolAnnotations;
  readonly description: string;
  readonly execute: (
    input: unknown,
    options?: ToolExecutionOptions,
  ) => Promise<string> | string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly name: string;
  readonly title?: string;
}

export interface RegisteredTool {
  readonly annotations?: ToolAnnotations;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly name: string;
  readonly origin?: string;
  readonly title?: string;
  readonly window?: Window;
}

export interface RegisterToolOptions {
  readonly exposedTo?: readonly string[];
  readonly signal?: AbortSignal;
}

export interface GetToolsOptions {
  readonly fromOrigins?: readonly string[];
}

export interface ExecuteToolOptions {
  readonly signal?: AbortSignal;
}

export interface ModelContextLike extends EventTarget {
  executeTool(
    tool: RegisteredTool,
    input: Readonly<Record<string, unknown>> | string,
    options?: ExecuteToolOptions,
  ): Promise<null | string>;
  getTools(options?: GetToolsOptions): Promise<readonly RegisteredTool[]>;
  registerTool(
    tool: ToolDefinition,
    options?: RegisterToolOptions,
  ): Promise<void> | void;
}

export interface WebMcpDocument extends Document {
  readonly modelContext?: ModelContextLike;
}

declare global {
  interface Document {
    readonly modelContext?: ModelContextLike;
  }
}

export interface NormalizedWebMcpError {
  readonly code:
    | "ABORTED"
    | "INVALID_ORIGIN"
    | "NOT_SUPPORTED"
    | "ORIGIN_MISMATCH"
    | "PERMISSION_DENIED"
    | "TIMEOUT"
    | "TOOL_NOT_FOUND"
    | "TRANSPORT_ERROR";
  readonly message: string;
  readonly name: string;
}
