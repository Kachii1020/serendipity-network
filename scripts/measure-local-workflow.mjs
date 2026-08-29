import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { performance } from "node:perf_hooks";

const root = new URL("..", import.meta.url).pathname;
const hubOrigin = "http://127.0.0.1:3100";
const providerOrigins = [
  "http://127.0.0.1:3101",
  "http://127.0.0.1:3102",
  "http://127.0.0.1:3103",
];
const fixtureDate = "2030-05-17";
const runs = 20;

const localOnly = (value) => {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname)
  ) {
    throw new Error(`Local reliability harness refused ${url.origin}`);
  }
  return url.origin;
};

[hubOrigin, ...providerOrigins].forEach(localOnly);

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
  throw new Error("Unable to read local Supabase status");
}
const jsonStart = statusResult.stdout.indexOf("{");
const local = JSON.parse(statusResult.stdout.slice(jsonStart));
const supabaseUrl = localOnly(local.API_URL);
const supabaseSecret = local.SECRET_KEY;
if (typeof supabaseSecret !== "string" || !supabaseSecret) {
  throw new Error("Local Supabase secret key is unavailable");
}

const rpcHeaders = {
  apikey: supabaseSecret,
  authorization: `Bearer ${supabaseSecret}`,
  "content-type": "application/json",
};

const resetLocalFixture = async () => {
  const started = performance.now();
  const response = await globalThis.fetch(
    `${supabaseUrl}/rest/v1/rpc/reset_demo_state_for_date`,
    {
      body: JSON.stringify({
        p_capacity_override: null,
        p_operator_scope: "serendipity-demo-v1",
        p_service_date: fixtureDate,
      }),
      headers: rpcHeaders,
      method: "POST",
      signal: globalThis.AbortSignal.timeout(10_000),
    },
  );
  const body = await response.json();
  const row = Array.isArray(body) ? body[0] : undefined;
  if (!response.ok || row?.restored_slots !== 9) {
    throw new Error("Local fixture reset failed closed");
  }
  return performance.now() - started;
};

const shared = {
  ...process.env,
  BUNDLE_ENCRYPTION_KEY: randomBytes(32).toString("base64url"),
  HOLD_TOKEN_SECRET: "local-only-hold-token-secret-32-bytes-minimum",
  HUB_INTERSERVICE_SECRET: "local-only-interservice-secret-32-bytes-minimum",
  NEXT_PUBLIC_HUB_ORIGIN: hubOrigin,
  NEXT_PUBLIC_PROVIDER_ORIGINS: providerOrigins.join(","),
  NEXT_PUBLIC_WEBMCP_EXECUTION_ENCODING: "json-string",
  PROVIDER_ACCESS_TOKEN_SECRET:
    "local-only-provider-access-secret-32-bytes-minimum",
  SUPABASE_SECRET_KEY: supabaseSecret,
  SUPABASE_URL: supabaseUrl,
};

const server = spawn("pnpm", ["dev:phase0"], {
  cwd: root,
  detached: process.platform !== "win32",
  env: shared,
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
const recordLog = (chunk) => {
  serverLog = `${serverLog}${chunk.toString()}`.slice(-16_000);
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

const waitForServers = async () => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Local app stack exited before readiness:\n${serverLog}`);
    }
    const ready = await Promise.all(
      [hubOrigin, ...providerOrigins].map(async (origin) => {
        try {
          return (
            await globalThis.fetch(origin, {
              signal: globalThis.AbortSignal.timeout(1_000),
            })
          ).ok;
        } catch {
          return false;
        }
      }),
    );
    if (ready.every(Boolean)) return;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 250));
  }
  throw new Error(`Local app stack did not become ready:\n${serverLog}`);
};

const intent = {
  area: "shibuya",
  endAt: `${fixtureDate}T22:30:00+09:00`,
  excludedTags: [],
  partySize: 1,
  preferredTags: ["creative", "seasonal", "experimental"],
  schemaVersion: "1",
  startAt: `${fixtureDate}T18:00:00+09:00`,
  totalBudgetYen: 5000,
};

const measurements = {
  confirm: [],
  confirmWorkflow: [],
  hold: [],
  recovery: [],
  release: [],
  releaseWorkflow: [],
  reset: [],
  search: [],
};
const correlations = new Set();
let requestCount = 0;

const requestJson = async (path, options = {}) => {
  const correlationId = `local-reliability-${randomUUID()}`;
  const headers = new globalThis.Headers(options.headers);
  headers.set("x-correlation-id", correlationId);
  if (options.body !== undefined)
    headers.set("content-type", "application/json");
  const started = performance.now();
  const response = await globalThis.fetch(`${hubOrigin}${path}`, {
    ...options,
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
    headers,
    signal: globalThis.AbortSignal.timeout(10_000),
  });
  const raw = await response.text();
  const durationMs = performance.now() - started;
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new Error(`${path} returned non-JSON`);
  }
  requestCount += 1;
  if (
    !response.ok ||
    body?.ok !== true ||
    body?.meta?.correlationId !== correlationId ||
    response.headers.get("x-correlation-id") !== correlationId ||
    correlations.has(correlationId)
  ) {
    throw new Error(`${path} returned an invalid success envelope`);
  }
  correlations.add(correlationId);
  const setCookie = response.headers.get("set-cookie");
  return {
    body,
    cookie: setCookie ? setCookie.split(";", 1)[0] : null,
    durationMs,
  };
};

const candidateSessionFrom = (search) => {
  const data = search.body.data;
  if (!data?.selectedBundle || !Array.isArray(data.alternatives)) {
    throw new Error("Search did not return a selected bundle");
  }
  return {
    bundleSessionId: data.bundleSessionId,
    bundleVersion: data.bundleVersion,
    candidates: [data.selectedBundle, ...data.alternatives],
    intent,
    selectedBundleId: data.selectedBundle.bundleId,
  };
};

const holdFromSearch = async (search) => {
  const session = candidateSessionFrom(search);
  const selected = session.candidates[0];
  const held = await requestJson("/api/manual/hold", {
    body: {
      bundleId: selected.bundleId,
      bundleSession: session,
      bundleSessionId: session.bundleSessionId,
      bundleVersion: selected.bundleVersion,
      schemaVersion: "1",
    },
    headers: { cookie: search.cookie },
    method: "POST",
  });
  if (
    held.body.data?.status !== "HELD" ||
    held.body.data?.providerHolds?.length !== 3
  ) {
    throw new Error("Hold did not cover all three Providers");
  }
  return { held, session };
};

const startSearch = async () => {
  const result = await requestJson("/api/manual/search", {
    body: intent,
    method: "POST",
  });
  if (!result.cookie)
    throw new Error("Search did not establish a browser session");
  return result;
};

const nearestRank = (values, fraction) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
};

const summary = (values) => ({
  count: values.length,
  maxMs: Math.round(Math.max(...values)),
  p50Ms: Math.round(nearestRank(values, 0.5)),
  p95Ms: Math.round(nearestRank(values, 0.95)),
});

try {
  await waitForServers();
  for (let index = 0; index < runs; index += 1) {
    measurements.reset.push(await resetLocalFixture());

    const confirmStarted = performance.now();
    const confirmSearch = await startSearch();
    measurements.search.push(confirmSearch.durationMs);
    const { held: confirmHold, session: confirmSession } =
      await holdFromSearch(confirmSearch);
    measurements.hold.push(confirmHold.durationMs);
    const confirmed = await requestJson("/api/manual/confirm", {
      body: {
        bundleHoldId: confirmHold.body.data.bundleHoldId,
        bundleSessionId: confirmSession.bundleSessionId,
        schemaVersion: "1",
      },
      headers: { cookie: confirmSearch.cookie },
      method: "POST",
    });
    measurements.confirm.push(confirmed.durationMs);
    measurements.confirmWorkflow.push(performance.now() - confirmStarted);
    if (
      confirmed.body.data?.status !== "CONFIRMED" ||
      confirmed.body.data?.reservations?.length !== 3
    ) {
      throw new Error("Confirmation did not cover all three Providers");
    }

    const releaseStarted = performance.now();
    const releaseSearch = await startSearch();
    measurements.search.push(releaseSearch.durationMs);
    const { held: releaseHold, session: releaseSession } =
      await holdFromSearch(releaseSearch);
    measurements.hold.push(releaseHold.durationMs);
    const recovered = await requestJson(
      `/api/bundle-sessions/${encodeURIComponent(releaseSession.bundleSessionId)}`,
      {
        headers: { cookie: releaseSearch.cookie },
        method: "GET",
      },
    );
    measurements.recovery.push(recovered.durationMs);
    if (
      recovered.body.data?.phase !== "held" ||
      recovered.body.data?.providerStates?.length !== 3
    ) {
      throw new Error("Recovery did not reconcile all three Provider holds");
    }
    const released = await requestJson("/api/manual/release", {
      body: {
        bundleHoldId: releaseHold.body.data.bundleHoldId,
        bundleSessionId: releaseSession.bundleSessionId,
        reason: "USER_CANCELLED",
        schemaVersion: "1",
      },
      headers: { cookie: releaseSearch.cookie },
      method: "POST",
    });
    measurements.release.push(released.durationMs);
    measurements.releaseWorkflow.push(performance.now() - releaseStarted);
    if (
      released.body.data?.status !== "RELEASED" ||
      released.body.data?.providerStatuses?.length !== 3
    ) {
      throw new Error("Release did not cover all three Providers");
    }
  }

  measurements.reset.push(await resetLocalFixture());
  const [holdsResponse, slotsResponse] = await Promise.all([
    globalThis.fetch(`${supabaseUrl}/rest/v1/holds?select=id&status=eq.HELD`, {
      headers: rpcHeaders,
      signal: globalThis.AbortSignal.timeout(10_000),
    }),
    globalThis.fetch(
      `${supabaseUrl}/rest/v1/slots?select=id,capacity_total,capacity_remaining,status`,
      {
        headers: rpcHeaders,
        signal: globalThis.AbortSignal.timeout(10_000),
      },
    ),
  ]);
  const activeHolds = await holdsResponse.json();
  const slots = await slotsResponse.json();
  if (
    !holdsResponse.ok ||
    !slotsResponse.ok ||
    !Array.isArray(activeHolds) ||
    activeHolds.length !== 0 ||
    !Array.isArray(slots) ||
    slots.length !== 9 ||
    slots.some(
      (slot) =>
        slot.status !== "ACTIVE" ||
        slot.capacity_remaining !== slot.capacity_total,
    )
  ) {
    throw new Error("Final local fixture invariants did not match baseline");
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        activeHoldsAfterFinalReset: activeHolds.length,
        confirmRuns: runs,
        correlations: {
          duplicate: requestCount - correlations.size,
          total: correlations.size,
        },
        fixtureDate,
        metrics: Object.fromEntries(
          Object.entries(measurements).map(([name, values]) => [
            name,
            summary(values),
          ]),
        ),
        releaseRecoveryRuns: runs,
        requests: requestCount,
        restoredSlotsAfterFinalReset: slots.length,
        totalBaselineCapacity: slots.reduce(
          (total, slot) => total + slot.capacity_remaining,
          0,
        ),
      },
      null,
      2,
    )}\n`,
  );
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
