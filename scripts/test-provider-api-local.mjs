import { once } from "node:events";
import { spawn, spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const port = 3191;
const baseUrl = `http://localhost:${port}`;

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
    `Unable to read the local Supabase status: ${statusResult.stderr.trim()}`,
  );
}

const jsonStart = statusResult.stdout.indexOf("{");
const status = JSON.parse(statusResult.stdout.slice(jsonStart));
if (!status.API_URL || !status.SECRET_KEY) {
  throw new Error("The local Supabase API and secret key must be available");
}

try {
  const occupied = await globalThis.fetch(baseUrl);
  if (occupied) {
    throw new Error(`Port ${port} is already in use`);
  }
} catch (error) {
  if (error instanceof Error && error.message.includes("already in use")) {
    throw error;
  }
}

const server = spawn(
  "pnpm",
  [
    "--filter",
    "@serendipity/provider",
    "exec",
    "next",
    "dev",
    "-p",
    String(port),
  ],
  {
    cwd: root,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      DEMO_MODE: "true",
      DEMO_OPERATOR_SECRET:
        "local-operator-secret-with-at-least-thirty-two-bytes",
      HOLD_TOKEN_SECRET:
        "local-hold-token-secret-with-at-least-thirty-two-bytes",
      HUB_INTERSERVICE_SECRET:
        "local-interservice-secret-with-at-least-thirty-two-bytes",
      NEXT_PUBLIC_HUB_ORIGIN: "http://localhost:3100",
      NEXT_PUBLIC_PROVIDER_SLUG: "kiln",
      PROVIDER_ACCESS_TOKEN_SECRET:
        "local-access-secret-with-at-least-thirty-two-bytes",
      PROVIDER_SLUG: "kiln",
      SUPABASE_SECRET_KEY: status.SECRET_KEY,
      SUPABASE_URL: status.API_URL,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let serverLog = "";
const recordLog = (chunk) => {
  serverLog = `${serverLog}${chunk.toString()}`.slice(-12_000);
};
server.stdout.on("data", recordLog);
server.stderr.on("data", recordLog);

const stopServer = () => {
  if (!server.pid || server.exitCode !== null) return;
  try {
    if (process.platform === "win32") server.kill("SIGTERM");
    else process.kill(-server.pid, "SIGTERM");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("ESRCH")) {
      throw error;
    }
  }
};

const waitForServer = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Provider server exited before readiness:\n${serverLog}`);
    }
    try {
      const response = await globalThis.fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The development server is still starting.
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, 250));
  }
  throw new Error(`Provider server did not become ready:\n${serverLog}`);
};

try {
  await waitForServer();
  const smoke = spawn(
    "node",
    ["--import", "tsx", "apps/provider/tests/api/local-route-smoke.mts"],
    {
      cwd: root,
      env: { ...process.env, PROVIDER_SMOKE_BASE_URL: baseUrl },
      stdio: "inherit",
    },
  );
  const [exitCode] = await once(smoke, "exit");
  if (exitCode !== 0) {
    throw new Error(`Provider API smoke test exited with code ${exitCode}`);
  }
} catch (error) {
  process.stderr.write(`${serverLog}\n`);
  throw error;
} finally {
  stopServer();
  if (server.exitCode === null) {
    await Promise.race([
      once(server, "exit"),
      new Promise((resolve) => globalThis.setTimeout(resolve, 5_000)),
    ]);
  }
}
