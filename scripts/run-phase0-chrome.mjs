import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = resolve(root, "specs/001-serendipity-network/evidence");
const hubOrigin = process.env.PHASE0_BASE_URL;
const evidencePrefix = process.env.PHASE0_EVIDENCE_PREFIX ?? "chrome-run";
const providerOrigins = process.env.NEXT_PUBLIC_PROVIDER_ORIGINS?.split(
  ",",
).map((value) => value.trim());

if (!hubOrigin || providerOrigins?.length !== 2) {
  throw new Error(
    "PHASE0_BASE_URL and exactly two NEXT_PUBLIC_PROVIDER_ORIGINS are required",
  );
}

if (
  new URL(hubOrigin).protocol !== "https:" &&
  process.env.PHASE0_ALLOW_LOCAL !== "1"
) {
  throw new Error(
    "T017 evidence requires HTTPS; set PHASE0_ALLOW_LOCAL=1 only for non-gating local evidence",
  );
}

const chromeVersion = execFileSync(
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--version"],
  { encoding: "utf8" },
).trim();

mkdirSync(evidenceDir, { recursive: true });

for (let run = 1; run <= 3; run += 1) {
  const result = spawnSync(
    "pnpm",
    ["exec", "playwright", "test", "tests/phase0", "--reporter=json"],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PHASE0_BASE_URL: hubOrigin },
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  let report;
  try {
    const reportStart = result.stdout.indexOf("{");
    const reportEnd = result.stdout.lastIndexOf("}");
    if (reportStart < 0 || reportEnd < reportStart) {
      throw new Error("JSON reporter output was not found");
    }
    report = JSON.parse(result.stdout.slice(reportStart, reportEnd + 1));
  } catch {
    report = { parseError: true };
  }

  const tests = [];
  for (const suite of report.suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        tests.push({
          expectedStatus: test.expectedStatus,
          outcome: test.status,
          title: spec.title,
        });
      }
    }
  }

  const evidence = {
    chromeVersion,
    environment:
      new URL(hubOrigin).protocol === "https:"
        ? "fixed-https"
        : "local-non-gating",
    executionEncodingCandidate:
      process.env.WEBMCP_EXECUTION_ENCODING ?? "json-string",
    exitCode: result.status,
    hubOrigin,
    providerOrigins,
    reportParsed: report.parseError !== true,
    run,
    sanitized: true,
    tests,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(
    resolve(evidenceDir, `${evidencePrefix}-${run}.json`),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );

  if (result.status !== 0 || tests.length !== 15) {
    process.stderr.write(result.stderr);
    process.exit(result.status && result.status !== 0 ? result.status : 1);
  }
}
