import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

const origin = "https://serendipity-phase0-hub.vercel.app";
const endpoint = new URL("/api/manual/search", origin);
const runCount = 20;

if (
  endpoint.origin !== origin ||
  endpoint.protocol !== "https:" ||
  endpoint.pathname !== "/api/manual/search"
) {
  throw new Error("Read-only production measurement target is not allowlisted");
}

const parts = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Tokyo",
  year: "numeric",
}).formatToParts(new Date());
const readPart = (type) => parts.find((part) => part.type === type)?.value;
const serviceDate = [readPart("year"), readPart("month"), readPart("day")].join(
  "-",
);
const input = {
  area: "shibuya",
  endAt: `${serviceDate}T22:30:00+09:00`,
  excludedTags: [],
  partySize: 1,
  preferredTags: ["creative", "seasonal", "experimental"],
  schemaVersion: "1",
  startAt: `${serviceDate}T18:00:00+09:00`,
  totalBudgetYen: 5000,
};

const durations = [];
const correlations = new Set();
let non2xx = 0;
let invalid = 0;

for (let index = 0; index < runCount; index += 1) {
  const requestedCorrelation = `readonly-${randomUUID()}`;
  const started = performance.now();
  const response = await globalThis.fetch(endpoint, {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json",
      "x-correlation-id": requestedCorrelation,
    },
    method: "POST",
    signal: globalThis.AbortSignal.timeout(10_000),
  });
  const body = await response.json();
  durations.push(performance.now() - started);
  if (!response.ok) non2xx += 1;

  const responseCorrelation = response.headers.get("x-correlation-id");
  const envelopeCorrelation = body?.meta?.correlationId;
  if (
    body?.ok !== true ||
    body?.data?.selectedBundle?.items?.length !== 3 ||
    responseCorrelation !== requestedCorrelation ||
    envelopeCorrelation !== requestedCorrelation ||
    correlations.has(envelopeCorrelation)
  ) {
    invalid += 1;
  }
  correlations.add(envelopeCorrelation);
}

durations.sort((left, right) => left - right);
const percentile = (fraction) =>
  durations[Math.max(0, Math.ceil(durations.length * fraction) - 1)];

process.stdout.write(
  `${JSON.stringify(
    {
      count: durations.length,
      invalid,
      maxMs: Math.round(durations.at(-1)),
      minMs: Math.round(durations[0]),
      non2xx,
      p50Ms: Math.round(percentile(0.5)),
      p95Ms: Math.round(percentile(0.95)),
      serviceDate,
      uniqueCorrelationIds: correlations.size,
    },
    null,
    2,
  )}\n`,
);

if (
  non2xx !== 0 ||
  invalid !== 0 ||
  correlations.size !== runCount ||
  percentile(0.95) > 3_000
) {
  process.exitCode = 1;
}
