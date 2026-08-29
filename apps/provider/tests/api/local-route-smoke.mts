import { createHmac, randomUUID } from "node:crypto";

const baseUrl = process.env.PROVIDER_SMOKE_BASE_URL ?? "http://localhost:3101";
const parsedBaseUrl = new URL(baseUrl);
if (
  parsedBaseUrl.protocol !== "http:" ||
  !["127.0.0.1", "localhost"].includes(parsedBaseUrl.hostname)
) {
  throw new Error("Provider smoke test refuses non-local targets");
}

const accessSecret = "local-access-secret-with-at-least-thirty-two-bytes";
const operatorSecret = "local-operator-secret-with-at-least-thirty-two-bytes";
const browserSessionId = randomUUID();

const accessPayload = Buffer.from(
  JSON.stringify({
    audience: "provider-api",
    browserSessionId,
    expiresAt: Math.floor(Date.now() / 1_000) + 600,
    provider: "kiln",
    version: 1,
  }),
).toString("base64url");
const accessSignature = createHmac("sha256", accessSecret)
  .update(accessPayload)
  .digest("base64url");
const accessToken = `${accessPayload}.${accessSignature}`;

type Envelope = {
  data?: Record<string, unknown>;
  error?: { code?: unknown };
  ok?: unknown;
};

const post = async (
  path: string,
  body: unknown,
  options: {
    access?: boolean;
    holdToken?: string;
    operator?: boolean;
  } = {},
): Promise<{ body: Envelope; status: number }> => {
  const headers = new Headers({
    "content-type": "application/json",
    origin: parsedBaseUrl.origin,
  });
  if (options.access !== false) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }
  if (options.holdToken) {
    headers.set("x-serendipity-hold-token", options.holdToken);
  }
  if (options.operator) {
    headers.set("x-serendipity-operator-secret", operatorSecret);
  }
  const response = await fetch(new URL(path, parsedBaseUrl), {
    body: JSON.stringify(body),
    headers,
    method: "POST",
  });
  const responseText = await response.text();
  let responseBody: Envelope;
  try {
    responseBody = JSON.parse(responseText) as Envelope;
  } catch {
    throw new Error(
      `Provider returned a non-JSON response (${response.status}) for ${path}: ${responseText.slice(0, 160) || "<empty>"}`,
    );
  }
  return { body: responseBody, status: response.status };
};

const expect = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};

const searchInput = {
  schemaVersion: "1",
  startAt: "2030-05-17T18:00:00+09:00",
  endAt: "2030-05-17T22:30:00+09:00",
  maxPriceYen: 5000,
  partySize: 1,
  preferredTags: ["creative"],
  excludedTags: [],
};

const unauthorized = await post("/api/slots", searchInput, { access: false });
expect(unauthorized.status === 401, "missing access token must return 401");

const search = await post("/api/slots", searchInput);
expect(search.status === 200 && search.body.ok === true, "search must succeed");
const slots = search.body.data?.slots;
expect(
  Array.isArray(slots) && slots.length === 3,
  "search must return three Kiln slots",
);

const createAndReadHold = async (slotId: string) => {
  const clientRequestId = randomUUID();
  const hold = await post("/api/holds", {
    schemaVersion: "1",
    slotId,
    inventoryVersion: "1",
    quantity: 1,
    browserSessionId,
    clientRequestId,
    idempotencyKey: `create-${randomUUID()}`,
  });
  expect(hold.status === 200 && hold.body.ok === true, "hold must succeed");
  const holdToken = hold.body.data?.holdToken;
  const publicResult = hold.body.data?.publicResult;
  expect(typeof holdToken === "string", "private hold token must be present");
  expect(
    typeof publicResult === "object" && publicResult !== null,
    "public hold result must be present",
  );
  expect(
    !JSON.stringify(publicResult).includes("holdToken"),
    "public result must not contain the hold token",
  );
  const status = await post("/api/holds/status", {
    schemaVersion: "1",
    browserSessionId,
    clientRequestId,
  });
  expect(
    status.status === 200 && status.body.data?.status === "HELD",
    "status lookup must recover the committed hold",
  );
  return { clientRequestId, holdToken };
};

const confirmedHold = await createAndReadHold(
  "10000000-0000-4000-8000-000000000001",
);
const confirm = await post(
  `/api/holds/${confirmedHold.clientRequestId}/confirm`,
  {
    schemaVersion: "1",
    holdSafeReference: confirmedHold.clientRequestId,
    browserSessionId,
    idempotencyKey: `confirm-${randomUUID()}`,
  },
  { holdToken: confirmedHold.holdToken },
);
expect(
  confirm.status === 200 && confirm.body.data?.status === "CONFIRMED",
  "confirm must succeed",
);

const releasedHold = await createAndReadHold(
  "10000000-0000-4000-8000-000000000002",
);
const releaseBody = {
  schemaVersion: "1",
  holdSafeReference: releasedHold.clientRequestId,
  browserSessionId,
  idempotencyKey: `release-${randomUUID()}`,
  reason: "USER_CANCELLED",
};
const release = await post(
  `/api/holds/${releasedHold.clientRequestId}/release`,
  releaseBody,
  { holdToken: releasedHold.holdToken },
);
const releaseReplay = await post(
  `/api/holds/${releasedHold.clientRequestId}/release`,
  releaseBody,
  { holdToken: releasedHold.holdToken },
);
expect(
  release.body.data?.capacityRestored === true &&
    releaseReplay.body.data?.capacityRestored === false,
  "release replay must not restore capacity twice",
);

const cancelBody = {
  schemaVersion: "1",
  slotId: "10000000-0000-4000-8000-000000000003",
};
const cancel = await post("/api/demo/cancel-slot", cancelBody, {
  access: false,
  operator: true,
});
const cancelReplay = await post("/api/demo/cancel-slot", cancelBody, {
  access: false,
  operator: true,
});
expect(
  cancel.status === 200 &&
    cancel.body.data?.inventoryVersion ===
      cancelReplay.body.data?.inventoryVersion,
  "demo cancellation replay must be stable",
);

process.stdout.write(
  "PASS: live Provider routes enforce auth, validate data, and preserve hold invariants.\n",
);
