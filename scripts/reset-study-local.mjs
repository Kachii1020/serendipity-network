import { spawnSync } from "node:child_process";

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
  throw new Error("Local Supabase must be running before reset");
}

const jsonStart = statusResult.stdout.indexOf("{");
const local = JSON.parse(statusResult.stdout.slice(jsonStart));
const apiUrl = new URL(local.API_URL);
if (
  apiUrl.protocol !== "http:" ||
  !["127.0.0.1", "localhost"].includes(apiUrl.hostname) ||
  typeof local.SECRET_KEY !== "string"
) {
  throw new Error("Study reset refuses every non-local Supabase target");
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

const response = await globalThis.fetch(
  new URL("/rest/v1/rpc/reset_demo_state_for_date", apiUrl),
  {
    body: JSON.stringify({
      p_capacity_override: 20,
      p_operator_scope: "serendipity-demo-v1",
      p_service_date: serviceDate,
    }),
    headers: {
      apikey: local.SECRET_KEY,
      authorization: `Bearer ${local.SECRET_KEY}`,
      "content-type": "application/json",
    },
    method: "POST",
    signal: globalThis.AbortSignal.timeout(10_000),
  },
);
const body = await response.json();
const row = Array.isArray(body) ? body[0] : undefined;
if (!response.ok || row?.restored_slots !== 9) {
  throw new Error("Local study fixture reset failed closed");
}

process.stdout.write(
  `${JSON.stringify({
    deletedHolds: row.deleted_holds,
    restoredSlots: row.restored_slots,
    serviceDate,
    target: "local",
  })}\n`,
);
