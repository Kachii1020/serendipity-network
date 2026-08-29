import { execFileSync } from "node:child_process";

const HUB_ORIGIN = "https://serendipity-phase0-hub.vercel.app";
const PRODUCTION_RESET_OPT_IN = "serendipity-phase0-hub.vercel.app";
const KEYCHAIN_SERVICE = "serendipity-network-demo-operator";

const tokyoServiceDate = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Tokyo",
  year: "numeric",
})
  .formatToParts(new Date())
  .reduce((parts, part) => {
    if (part.type !== "literal") parts[part.type] = part.value;
    return parts;
  }, {});
const serviceDate = `${tokyoServiceDate.year}-${tokyoServiceDate.month}-${tokyoServiceDate.day}`;

const canonicalIntent = {
  area: "shibuya",
  endAt: `${serviceDate}T22:30:00+09:00`,
  excludedTags: [],
  partySize: 1,
  preferredTags: ["creative", "seasonal", "experimental"],
  schemaVersion: "1",
  startAt: `${serviceDate}T18:00:00+09:00`,
  totalBudgetYen: 5000,
};

class SafeScriptError extends Error {}

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const readJson = async (response, operation) => {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new SafeScriptError(
      `${operation} returned ${response.status} without a JSON envelope.`,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new SafeScriptError(
      `${operation} returned ${response.status} with invalid JSON.`,
    );
  }
};

const assertResetEnvelope = (response, envelope) => {
  if (
    response.status !== 200 ||
    !isRecord(envelope) ||
    envelope.schemaVersion !== "1" ||
    envelope.ok !== true ||
    !isRecord(envelope.data) ||
    envelope.data.status !== "RESET" ||
    envelope.data.restoredSlots !== 9 ||
    !Number.isInteger(envelope.data.deletedHolds) ||
    envelope.data.deletedHolds < 0 ||
    !isRecord(envelope.meta) ||
    typeof envelope.meta.correlationId !== "string"
  ) {
    throw new SafeScriptError(
      `Reset failed closed: expected a successful envelope with restoredSlots=9, received HTTP ${response.status}.`,
    );
  }
  return envelope;
};

const assertSearchEnvelope = (response, envelope) => {
  const data =
    isRecord(envelope) && isRecord(envelope.data) ? envelope.data : null;
  const statuses =
    data && isRecord(data.providerStatuses) ? data.providerStatuses : null;
  const bundle =
    data && isRecord(data.selectedBundle) ? data.selectedBundle : null;
  if (
    response.status !== 200 ||
    !isRecord(envelope) ||
    envelope.schemaVersion !== "1" ||
    envelope.ok !== true ||
    statuses?.kiln !== "ONLINE" ||
    statuses.nori !== "ONLINE" ||
    statuses.loop !== "ONLINE" ||
    !Array.isArray(bundle?.items) ||
    bundle.items.length !== 3
  ) {
    throw new SafeScriptError(
      `Read-only verification failed closed: expected three online Providers and a three-stop bundle, received HTTP ${response.status}.`,
    );
  }
  return envelope;
};

const run = async () => {
  const verifySearch = process.argv.slice(2).includes("--verify-search");
  const unknownArguments = process.argv
    .slice(2)
    .filter((value) => value !== "--verify-search");
  if (unknownArguments.length > 0) {
    throw new SafeScriptError(
      "Only the optional --verify-search argument is accepted.",
    );
  }
  if (process.env.ALLOW_PRODUCTION_RESET !== PRODUCTION_RESET_OPT_IN) {
    throw new SafeScriptError(
      `Set ALLOW_PRODUCTION_RESET=${PRODUCTION_RESET_OPT_IN} to target the fixed production Hub explicitly.`,
    );
  }
  let operatorSecret = process.env.DEMO_OPERATOR_SECRET?.trim();
  if (!operatorSecret && process.platform === "darwin") {
    try {
      operatorSecret = execFileSync(
        "/usr/bin/security",
        [
          "find-generic-password",
          "-a",
          process.env.USER ?? "ichika",
          "-s",
          KEYCHAIN_SERVICE,
          "-w",
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
    } catch {
      operatorSecret = undefined;
    }
  }
  if (!operatorSecret || operatorSecret.length < 32) {
    throw new SafeScriptError(
      "DEMO_OPERATOR_SECRET must contain at least 32 characters.",
    );
  }

  let resetResponse;
  try {
    resetResponse = await globalThis.fetch(`${HUB_ORIGIN}/api/demo/reset`, {
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-serendipity-operator-secret": operatorSecret,
      },
      method: "POST",
      redirect: "error",
    });
  } catch {
    throw new SafeScriptError("The fixed production Hub could not be reached.");
  }
  const resetEnvelope = assertResetEnvelope(
    resetResponse,
    await readJson(resetResponse, "Reset"),
  );
  console.log(
    JSON.stringify({
      correlationId: resetEnvelope.meta.correlationId,
      deletedHolds: resetEnvelope.data.deletedHolds,
      origin: HUB_ORIGIN,
      restoredSlots: resetEnvelope.data.restoredSlots,
      status: resetEnvelope.data.status,
    }),
  );

  if (!verifySearch) return;

  let searchResponse;
  try {
    searchResponse = await globalThis.fetch(`${HUB_ORIGIN}/api/manual/search`, {
      body: JSON.stringify(canonicalIntent),
      cache: "no-store",
      headers: { "content-type": "application/json" },
      method: "POST",
      redirect: "error",
    });
  } catch {
    throw new SafeScriptError(
      "The read-only production search could not be reached.",
    );
  }
  const searchEnvelope = assertSearchEnvelope(
    searchResponse,
    await readJson(searchResponse, "Read-only verification"),
  );
  console.log(
    JSON.stringify({
      bundleId: searchEnvelope.data.selectedBundle.bundleId,
      correlationId: searchEnvelope.meta?.correlationId,
      providers: ["kiln", "nori", "loop"],
      status: "SEARCH_VERIFIED",
    }),
  );
};

try {
  await run();
} catch (error) {
  const message =
    error instanceof SafeScriptError
      ? error.message
      : "Production reset stopped after an unexpected local failure.";
  console.error(message);
  process.exitCode = 1;
}
