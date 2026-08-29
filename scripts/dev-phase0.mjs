import { spawn } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const shared = {
  ...process.env,
  HOLD_TOKEN_SECRET:
    process.env.HOLD_TOKEN_SECRET ??
    "local-only-hold-token-secret-32-bytes-minimum",
  HUB_INTERSERVICE_SECRET:
    process.env.HUB_INTERSERVICE_SECRET ??
    "local-only-interservice-secret-32-bytes-minimum",
  NEXT_PUBLIC_HUB_ORIGIN:
    process.env.NEXT_PUBLIC_HUB_ORIGIN ?? "http://localhost:3100",
  NEXT_PUBLIC_PROVIDER_ORIGINS:
    process.env.NEXT_PUBLIC_PROVIDER_ORIGINS ??
    "http://localhost:3101,http://localhost:3102,http://localhost:3103",
  NEXT_PUBLIC_WEBMCP_EXECUTION_ENCODING:
    process.env.WEBMCP_EXECUTION_ENCODING ?? "json-string",
  PROVIDER_ACCESS_TOKEN_SECRET:
    process.env.PROVIDER_ACCESS_TOKEN_SECRET ??
    "local-only-provider-access-secret-32-bytes-minimum",
};

const processes = [
  spawn("pnpm", ["--filter", "@serendipity/hub", "dev"], {
    cwd: root,
    env: shared,
    stdio: "inherit",
  }),
  spawn(
    "pnpm",
    ["--filter", "@serendipity/provider", "exec", "next", "dev", "-p", "3101"],
    {
      cwd: root,
      env: { ...shared, NEXT_PUBLIC_PROVIDER_SLUG: "kiln" },
      stdio: "inherit",
    },
  ),
  spawn(
    "pnpm",
    ["--filter", "@serendipity/provider", "exec", "next", "dev", "-p", "3102"],
    {
      cwd: root,
      env: { ...shared, NEXT_PUBLIC_PROVIDER_SLUG: "nori" },
      stdio: "inherit",
    },
  ),
  spawn(
    "pnpm",
    ["--filter", "@serendipity/provider", "exec", "next", "dev", "-p", "3103"],
    {
      cwd: root,
      env: { ...shared, NEXT_PUBLIC_PROVIDER_SLUG: "loop" },
      stdio: "inherit",
    },
  ),
];

function stop(signal) {
  processes.forEach((child) => child.kill(signal));
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

await Promise.all(
  processes.map(
    (child) =>
      new Promise((resolve) => {
        child.once("exit", resolve);
      }),
  ),
);
