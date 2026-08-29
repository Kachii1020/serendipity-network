import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import pg from "pg";

const { Pool } = pg;

const databaseUrl =
  process.env.SERENDIPITY_TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54522/postgres";

if (!databaseUrl.includes("127.0.0.1") && !databaseUrl.includes("localhost")) {
  throw new Error(
    "Concurrency harness refuses non-local databases unless its safety guard is changed explicitly.",
  );
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 24,
  connectionTimeoutMillis: 5_000,
});

const hash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const providerId = "00000000-0000-4000-8000-000000000001";
const slotId = "10000000-0000-4000-8000-000000000003";
const browserSessionId = "20000000-0000-4000-8000-000000000020";
const now = "2030-05-17T08:55:00Z";

const reset = async (): Promise<void> => {
  await pool.query(
    "select * from public.reset_demo_state('serendipity-demo-v1')",
  );
};

const createHold = async (index: number) => {
  const clientRequestId = `30000000-0000-4000-8000-${index
    .toString()
    .padStart(12, "0")}`;
  const proposedHoldId = `40000000-0000-4000-8000-${index
    .toString()
    .padStart(12, "0")}`;
  const tokenHash = hash(`race-token-${index}`);
  const response = await pool.query<{
    error_code: string | null;
    hold_id: string | null;
    ok: boolean;
  }>(
    `select ok, error_code, hold_id
       from public.create_slot_hold(
         $1, $2, 1, $3, $4, $5, $6, 1, $7, $8, $9
       )`,
    [
      providerId,
      slotId,
      browserSessionId,
      clientRequestId,
      proposedHoldId,
      tokenHash,
      hash(`create-idempotency-${index}`),
      hash(`create-request-${index}`),
      now,
    ],
  );
  return { ...response.rows[0], tokenHash };
};

try {
  await reset();

  const attempts = await Promise.all(
    Array.from({ length: 20 }, (_, index) => createHold(index + 1)),
  );
  const winners = attempts.filter(({ ok }) => ok);
  assert.equal(winners.length, 1, "exactly one concurrent hold must succeed");
  assert.equal(
    attempts.filter(
      ({ error_code: errorCode }) => errorCode === "SLOT_UNAVAILABLE",
    ).length,
    19,
    "all losing holds must fail as unavailable",
  );

  const afterRace = await pool.query<{
    capacity_remaining: number;
    held_count: number;
    inventory_version: string;
  }>(
    `select
       s.capacity_remaining,
       s.inventory_version,
       count(h.id)::integer as held_count
     from public.slots as s
     left join public.holds as h
       on h.slot_id = s.id and h.status = 'HELD'
     where s.id = $1
     group by s.id`,
    [slotId],
  );
  assert.deepEqual(afterRace.rows[0], {
    capacity_remaining: 0,
    held_count: 1,
    inventory_version: "2",
  });

  const winner = winners[0];
  assert.ok(winner);
  const releaseResults = await Promise.all(
    Array.from({ length: 20 }, () =>
      pool.query<{ capacity_restored: boolean }>(
        `select capacity_restored
         from public.release_slot_hold($1, $2, $3, $4, $5)`,
        [
          providerId,
          winner.tokenHash,
          hash("release-idempotency"),
          hash("release-request"),
          "2030-05-17T08:55:30Z",
        ],
      ),
    ),
  );
  assert.equal(
    releaseResults
      .flatMap(({ rows }) => rows)
      .filter(({ capacity_restored: restored }) => restored).length,
    1,
    "concurrent release must restore capacity exactly once",
  );

  await reset();
  const expiryHold = await createHold(99);
  assert.equal(expiryHold.ok, true);
  const expiryResults = await Promise.all(
    Array.from({ length: 20 }, () =>
      pool.query("select * from public.expire_due_holds($1, $2)", [
        providerId,
        "2030-05-17T08:57:00Z",
      ]),
    ),
  );
  assert.equal(
    expiryResults.reduce((total, { rowCount }) => total + (rowCount ?? 0), 0),
    1,
    "concurrent expiry must transition exactly one row",
  );

  const finalSlot = await pool.query<{
    capacity_remaining: number;
    inventory_version: string;
  }>(
    "select capacity_remaining, inventory_version from public.slots where id = $1",
    [slotId],
  );
  assert.deepEqual(finalSlot.rows[0], {
    capacity_remaining: 1,
    inventory_version: "3",
  });

  await reset();
  process.stdout.write(
    "PASS: 20-way hold race, release, and expiry preserve capacity invariants.\n",
  );
} finally {
  await pool.end();
}
