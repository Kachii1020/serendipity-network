import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";

const root = new URL("..", import.meta.url).pathname;
const statusResult = spawnSync(
  "pnpm",
  ["exec", "supabase", "status", "--output", "json"],
  {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "true" },
  },
);

if (statusResult.status !== 0) {
  throw new Error(
    "Local Supabase must be running before the study server starts",
  );
}

const jsonStart = statusResult.stdout.indexOf("{");
const local = JSON.parse(statusResult.stdout.slice(jsonStart));
if (!local.API_URL || !local.SECRET_KEY) {
  throw new Error("Local Supabase API and secret key are unavailable");
}

const child = spawn("pnpm", ["dev:phase0"], {
  cwd: root,
  env: {
    ...process.env,
    BUNDLE_ENCRYPTION_KEY: randomBytes(32).toString("base64url"),
    HOLD_TOKEN_SECRET: "local-study-hold-token-secret-32-bytes-minimum",
    HUB_INTERSERVICE_SECRET: "local-study-interservice-secret-32-bytes-minimum",
    NEXT_PUBLIC_HUB_ORIGIN: "http://localhost:3100",
    NEXT_PUBLIC_PROVIDER_ORIGINS:
      "http://localhost:3101,http://localhost:3102,http://localhost:3103",
    NEXT_PUBLIC_WEBMCP_EXECUTION_ENCODING: "json-string",
    PROVIDER_ACCESS_TOKEN_SECRET:
      "local-study-provider-access-secret-32-bytes-minimum",
    SUPABASE_SECRET_KEY: local.SECRET_KEY,
    SUPABASE_URL: local.API_URL,
    WEBMCP_COMPOSITION_MODE: "direct",
    WEBMCP_EXECUTION_ENCODING: "json-string",
  },
  stdio: "inherit",
});

const stop = (signal) => {
  if (child.exitCode === null) child.kill(signal);
};
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

const [exitCode] = await once(child, "exit");
process.exitCode = exitCode ?? 1;
