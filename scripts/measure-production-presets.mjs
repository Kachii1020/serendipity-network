import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

const origin = "https://serendipity-phase0-hub.vercel.app";
const endpoint = new URL("/api/manual/search", origin);
const expectedCounts = {
  "18:00/4500": 3,
  "18:00/5000": 3,
  "18:00/6000": 3,
  "18:30/4500": 0,
  "18:30/5000": 2,
  "18:30/6000": 3,
  "19:00/4500": 0,
  "19:00/5000": 0,
  "19:00/6000": 0,
};

if (endpoint.origin !== origin || endpoint.pathname !== "/api/manual/search") {
  throw new Error("Preset measurement target is not allowlisted");
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

const results = [];
const correlations = new Set();
for (const startTime of ["18:00", "18:30", "19:00"]) {
  for (const totalBudgetYen of [4500, 5000, 6000]) {
    const key = `${startTime}/${totalBudgetYen}`;
    const correlationId = `preset-${randomUUID()}`;
    const startedAt = performance.now();
    const response = await globalThis.fetch(endpoint, {
      body: JSON.stringify({
        area: "shibuya",
        endAt: `${serviceDate}T22:30:00+09:00`,
        excludedTags: [],
        partySize: 1,
        preferredTags: ["creative", "seasonal", "experimental"],
        schemaVersion: "1",
        startAt: `${serviceDate}T${startTime}:00+09:00`,
        totalBudgetYen,
      }),
      headers: {
        "content-type": "application/json",
        "x-correlation-id": correlationId,
      },
      method: "POST",
      signal: globalThis.AbortSignal.timeout(10_000),
    });
    const envelope = await response.json();
    const responseCorrelation = response.headers.get("x-correlation-id");
    const expected = expectedCounts[key];
    const candidateCount =
      envelope?.ok === true && envelope?.data?.selectedBundle
        ? 1 + (envelope.data.alternatives?.length ?? 0)
        : 0;
    const matches =
      typeof expected === "number" &&
      responseCorrelation === correlationId &&
      envelope?.meta?.correlationId === correlationId &&
      !correlations.has(correlationId) &&
      (expected === 0
        ? envelope?.ok === false &&
          envelope?.error?.code === "NO_VALID_BUNDLE" &&
          candidateCount === 0
        : response.ok && envelope?.ok === true && candidateCount === expected);
    correlations.add(correlationId);
    results.push({
      candidateCount,
      durationMs: Math.round(performance.now() - startedAt),
      expected,
      key,
      matches,
      status: response.status,
    });
  }
}

const summary = {
  correlations: correlations.size,
  matched: results.filter(({ matches }) => matches).length,
  results,
  serviceDate,
  status: results.every(({ matches }) => matches) ? "PASS" : "FAIL",
};
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (summary.status !== "PASS" || correlations.size !== 9) process.exitCode = 1;
