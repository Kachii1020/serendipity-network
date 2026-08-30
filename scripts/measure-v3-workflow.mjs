import { performance } from "node:perf_hooks";

const runCount = 20;
const configured = process.env.APP_BASE_URL ?? "http://localhost:3100";
const baseUrl = new URL(configured);
const allowed =
  (baseUrl.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(baseUrl.hostname)) ||
  (baseUrl.protocol === "https:" && baseUrl.hostname.endsWith(".vercel.app"));
if (!allowed || baseUrl.pathname !== "/") {
  throw new Error(
    "APP_BASE_URL must be an exact localhost or vercel.app origin.",
  );
}

const parts = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Tokyo",
  year: "numeric",
}).formatToParts(new Date());
const read = (type) => Number(parts.find((part) => part.type === type)?.value);
const offset = read("hour") * 60 + read("minute") > 17 * 60 + 25 ? 1 : 0;
const serviceDate = new Date(
  Date.UTC(read("year"), read("month") - 1, read("day") + offset),
)
  .toISOString()
  .slice(0, 10);

const areas = ["shibuya", "shinjuku", "ikebukuro"];
const durations = [];
const correlations = new Set();
const areaCounts = new Map(areas.map((area) => [area, 0]));
for (let index = 0; index < runCount; index += 1) {
  const area = areas[index % areas.length];
  const intent = {
    area,
    budgetPerPersonYen: area === "shinjuku" ? 7000 : 4000,
    endAt: `${serviceDate}T22:30:00+09:00`,
    excludedTags: [],
    includeMeal: true,
    interestPreset: area === "shinjuku" ? "SURPRISE" : "CALM_QUIET",
    maxWalkMinutesPerLeg: area === "shinjuku" ? 30 : 20,
    partySize: 3,
    schemaVersion: "3",
    startAt: `${serviceDate}T17:30:00+09:00`,
  };
  const started = performance.now();
  const response = await globalThis.fetch(
    new URL("/api/v3/plans/search", baseUrl),
    {
      body: JSON.stringify(intent),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: globalThis.AbortSignal.timeout(5_000),
    },
  );
  const raw = await response.text();
  const duration = performance.now() - started;
  if (!response.ok)
    throw new Error(`Run ${index + 1} returned HTTP ${response.status}.`);
  if (new globalThis.TextEncoder().encode(raw).byteLength > 65_536) {
    throw new Error(`Run ${index + 1} exceeded 64 KiB.`);
  }
  const envelope = JSON.parse(raw);
  const plan = envelope?.data?.plan;
  const correlation = envelope?.meta?.correlationId;
  const roles = plan?.stops?.map((stop) => stop?.place?.role);
  if (
    envelope?.schemaVersion !== "3" ||
    envelope?.ok !== true ||
    envelope?.meta?.area !== area ||
    typeof correlation !== "string" ||
    !Array.isArray(roles) ||
    roles.length < 2 ||
    !roles.includes("MEAL") ||
    roles.filter((role) => role === "MEAL").length !== 1 ||
    plan?.totals?.perPersonMaxYen > intent.budgetPerPersonYen ||
    plan?.totals?.estimatedGroupMaxYen !== plan?.totals?.perPersonMaxYen * 3 ||
    /holdToken|authorization|serviceRoleKey|secret|priceRange"\s*:/.test(raw)
  ) {
    throw new Error(`Run ${index + 1} violated the v3 public contract.`);
  }
  if (correlations.has(correlation))
    throw new Error(`Run ${index + 1} reused a correlation ID.`);
  correlations.add(correlation);
  areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
  durations.push(duration);
}

const percentile = (value) => {
  const sorted = [...durations].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * value) - 1)] ?? 0;
};
console.log(
  JSON.stringify(
    {
      areaRuns: Object.fromEntries(areaCounts),
      baseOrigin: baseUrl.origin,
      correlations: correlations.size,
      maxMs: Math.round(Math.max(...durations)),
      p50Ms: Math.round(percentile(0.5)),
      p95Ms: Math.round(percentile(0.95)),
      runs: runCount,
      serviceDate,
    },
    null,
    2,
  ),
);
