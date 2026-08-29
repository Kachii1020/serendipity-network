import { performance } from "node:perf_hooks";

const runCount = 20;
const configured = process.env.APP_BASE_URL ?? "http://localhost:3100";
const baseUrl = new URL(configured);
const local =
  baseUrl.protocol === "http:" &&
  ["localhost", "127.0.0.1"].includes(baseUrl.hostname);
const preview =
  baseUrl.protocol === "https:" && baseUrl.hostname.endsWith(".vercel.app");

if ((!local && !preview) || baseUrl.pathname !== "/") {
  throw new Error(
    "APP_BASE_URL must be an exact localhost or vercel.app origin.",
  );
}

const now = new Date();
const tokyoParts = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Tokyo",
  year: "numeric",
}).formatToParts(now);
const part = (type) => tokyoParts.find((item) => item.type === type)?.value;
const currentMinutes = Number(part("hour")) * 60 + Number(part("minute"));
const dateOffset = currentMinutes > 17 * 60 + 5 ? 1 : 0;
const tokyoDate = new Date(
  Date.UTC(
    Number(part("year")),
    Number(part("month")) - 1,
    Number(part("day")) + dateOffset,
  ),
)
  .toISOString()
  .slice(0, 10);

const intent = {
  area: "shibuya",
  endAt: `${tokyoDate}T22:00:00+09:00`,
  excludedTags: ["alcohol", "smoking"],
  maxWalkMinutesPerLeg: 20,
  partySize: 1,
  preferredTags: ["art", "hands-on", "lively", "quiet"],
  schemaVersion: "2",
  startAt: `${tokyoDate}T17:00:00+09:00`,
  stopCount: "AUTO",
  totalBudgetYen: 5000,
};

const percentile = (values, value) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * value) - 1)] ?? 0;
};

const durations = [];
const correlations = new Set();
for (let index = 0; index < runCount; index += 1) {
  const startedAt = performance.now();
  const response = await globalThis.fetch(
    new URL("/api/v2/plans/search", baseUrl),
    {
      body: JSON.stringify(intent),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: globalThis.AbortSignal.timeout(5_000),
    },
  );
  const raw = await response.text();
  const duration = performance.now() - startedAt;
  if (!response.ok) {
    throw new Error(`Run ${index + 1} returned HTTP ${response.status}.`);
  }
  if (new globalThis.TextEncoder().encode(raw).byteLength > 65_536) {
    throw new Error(`Run ${index + 1} exceeded the 64 KiB response limit.`);
  }
  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw new Error(`Run ${index + 1} returned invalid JSON.`);
  }
  const plan = envelope?.data?.plan;
  const correlation = envelope?.meta?.correlationId;
  if (
    envelope?.schemaVersion !== "2" ||
    envelope?.ok !== true ||
    typeof correlation !== "string" ||
    !Array.isArray(plan?.stops) ||
    plan.stops.length < 2 ||
    plan.stops.length > 3 ||
    plan.stops.some(
      (stop) =>
        typeof stop?.place?.name !== "string" ||
        !String(stop?.place?.officialUrl).startsWith("https://") ||
        typeof stop?.sourcePublisher !== "string" ||
        !Number.isFinite(Date.parse(stop?.sourceCheckedAt)),
    ) ||
    plan?.totals?.maxPriceYen > intent.totalBudgetYen
  ) {
    throw new Error(`Run ${index + 1} violated the public planner contract.`);
  }
  if (
    /holdToken|idempotencyKey|authorization|serviceRoleKey|secret/i.test(raw)
  ) {
    throw new Error(`Run ${index + 1} exposed a forbidden field marker.`);
  }
  if (correlations.has(correlation)) {
    throw new Error(`Run ${index + 1} reused a correlation ID.`);
  }
  correlations.add(correlation);
  durations.push(duration);
}

const result = {
  baseOrigin: baseUrl.origin,
  correlations: correlations.size,
  maxMs: Math.round(Math.max(...durations)),
  p50Ms: Math.round(percentile(durations, 0.5)),
  p95Ms: Math.round(percentile(durations, 0.95)),
  runs: runCount,
  serviceDate: tokyoDate,
};

if (result.p95Ms > 3_000) {
  throw new Error(`Planner p95 ${result.p95Ms}ms exceeded 3000ms.`);
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
