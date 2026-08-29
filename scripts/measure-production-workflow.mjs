import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import { chromium } from "@playwright/test";

const HUB_ORIGIN = "https://serendipity-phase0-hub.vercel.app";
const PLANNER_URL = `${HUB_ORIGIN}/plan`;
const PROVIDER_ORIGINS = [
  "https://serendipity-phase0-kiln.vercel.app",
  "https://serendipity-phase0-nori.vercel.app",
  "https://serendipity-loop.vercel.app",
];
const PRODUCTION_WORKFLOW_OPT_IN =
  "serendipity-phase0-hub.vercel.app:20-sequential-confirmations";
const PRODUCTION_RELEASE_WORKFLOW_OPT_IN =
  "serendipity-phase0-hub.vercel.app:20-sequential-releases";
const KEYCHAIN_SERVICE = "serendipity-network-demo-operator";
const RUNS = 20;
const NAVIGATION_TIMEOUT_MS = 30_000;
const OPERATION_TIMEOUT_MS = 20_000;
const FAILURE_QUIESCENCE_MS = 12_000;
const SAFE_CORRELATION = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROVIDERS = ["kiln", "nori", "loop"];

class SafeScriptError extends Error {}

const assert = (condition, message) => {
  if (!condition) throw new SafeScriptError(message);
};

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isIsoTimestamp = (value) =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

const sameProviders = (values) =>
  Array.isArray(values) &&
  values.length === PROVIDERS.length &&
  [...values].sort().join(",") === [...PROVIDERS].sort().join(",");

const nearestRank = (values, fraction) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
};

const metricSummary = (values) => {
  assert(values.length > 0, "A reliability metric had no samples.");
  return {
    count: values.length,
    maxMs: Math.round(Math.max(...values)),
    p50Ms: Math.round(nearestRank(values, 0.5)),
    p95Ms: Math.round(nearestRank(values, 0.95)),
  };
};

const closeWithin = async (close, timeoutMs) => {
  let timeout;
  const closed = Promise.resolve()
    .then(close)
    .then(
      () => true,
      () => false,
    );
  const timedOut = new Promise((resolve) => {
    timeout = globalThis.setTimeout(() => resolve(false), timeoutMs);
  });
  const result = await Promise.race([closed, timedOut]);
  globalThis.clearTimeout(timeout);
  return result;
};

const terminateFailedBrowser = async (browser) => {
  await Promise.all(
    browser
      .contexts()
      .map((context) => closeWithin(() => context.close(), 5_000)),
  );
  if (await closeWithin(() => browser.close(), 5_000)) return true;
  if (!browser.isConnected()) return true;
  await Promise.all(
    browser
      .contexts()
      .map((context) => closeWithin(() => context.close(), 5_000)),
  );
  if (await closeWithin(() => browser.close(), 5_000)) return true;
  return !browser.isConnected();
};

const wait = (durationMs) =>
  new Promise((resolve) => globalThis.setTimeout(resolve, durationMs));

const withHardTimeout = async (promise, timeoutMs, message) => {
  let timeout;
  const timedOut = new Promise((_, reject) => {
    timeout = globalThis.setTimeout(
      () => reject(new SafeScriptError(message)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([promise, timedOut]);
  } finally {
    globalThis.clearTimeout(timeout);
  }
};

const safeBrowserDiagnostic = (value) =>
  String(value ?? "unknown")
    .replace(/https?:\/\/[^\s"'<>]+/gu, (raw) => {
      try {
        const url = new URL(raw);
        return `${url.origin}${url.pathname}`;
      } catch {
        return "[url]";
      }
    })
    .replace(
      /(?=[A-Za-z0-9_-]{32,}\b)(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[_-])[A-Za-z0-9_-]{32,}/gu,
      "[redacted-id]",
    )
    .replace(
      /DEMO_OPERATOR_SECRET|x-serendipity-operator-secret|holdToken|hold_token|idempotencyKey|idempotency_key/gu,
      "[redacted-field]",
    )
    .replace(/[\r\n]+/gu, " ")
    .slice(0, 240);

const browserEventSummary = (events) =>
  events.length === 0 ? "none" : events.join(" | ");

const isKnownFavicon404 = (message, expectedOrigin) => {
  const location = message.location();
  try {
    const url = new URL(location.url);
    return (
      url.origin === expectedOrigin &&
      url.pathname === "/favicon.ico" &&
      message.text().includes("status of 404")
    );
  } catch {
    return false;
  }
};

const readOperatorSecret = () => {
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
  assert(
    typeof operatorSecret === "string" && operatorSecret.length >= 32,
    "DEMO_OPERATOR_SECRET must contain at least 32 characters or be available in the dedicated macOS Keychain item.",
  );
  return operatorSecret;
};

const parseFetchJson = async (response, operation) => {
  const contentType = response.headers.get("content-type") ?? "";
  assert(
    contentType.toLowerCase().includes("application/json"),
    `${operation} returned HTTP ${response.status} without a JSON envelope.`,
  );
  try {
    return await withHardTimeout(
      response.json(),
      OPERATION_TIMEOUT_MS,
      `${operation} response body timed out.`,
    );
  } catch {
    throw new SafeScriptError(
      `${operation} returned HTTP ${response.status} with invalid JSON.`,
    );
  }
};

const assertEnvelopeMeta = (
  envelope,
  responseCorrelation,
  operation,
  claimCorrelation,
) => {
  assert(
    isRecord(envelope) &&
      envelope.schemaVersion === "1" &&
      envelope.ok === true &&
      isRecord(envelope.meta) &&
      envelope.meta.origin === HUB_ORIGIN &&
      isIsoTimestamp(envelope.meta.completedAt) &&
      envelope.meta.correlationId === responseCorrelation,
    `${operation} returned an invalid success envelope.`,
  );
  claimCorrelation(responseCorrelation, operation);
  return envelope;
};

const createCorrelationLedger = () => {
  const correlations = [];
  const seen = new Set();
  return {
    claim(value, operation) {
      assert(
        typeof value === "string" && SAFE_CORRELATION.test(value),
        `${operation} returned a missing or unsafe correlation ID.`,
      );
      assert(
        !seen.has(value),
        `${operation} returned a duplicate correlation ID.`,
      );
      seen.add(value);
      correlations.push(value);
    },
    values: correlations,
  };
};

const resetProduction = async (operatorSecret, claimCorrelation) => {
  const correlationId = `production-reliability-reset-${randomUUID()}`;
  const startedAt = performance.now();
  let response;
  try {
    response = await globalThis.fetch(`${HUB_ORIGIN}/api/demo/reset`, {
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": correlationId,
        "x-serendipity-operator-secret": operatorSecret,
      },
      method: "POST",
      redirect: "error",
      signal: globalThis.AbortSignal.timeout(OPERATION_TIMEOUT_MS),
    });
  } catch {
    throw new SafeScriptError(
      "The fixed production reset could not be reached.",
    );
  }
  const responseCorrelation = response.headers.get("x-correlation-id");
  assert(
    responseCorrelation === correlationId,
    "Production reset did not echo its caller-bound correlation ID.",
  );
  const envelope = assertEnvelopeMeta(
    await parseFetchJson(response, "Production reset"),
    responseCorrelation,
    "Production reset",
    claimCorrelation,
  );
  assert(
    response.status === 200 &&
      isRecord(envelope.data) &&
      envelope.data.status === "RESET" &&
      envelope.data.restoredSlots === 9 &&
      Number.isInteger(envelope.data.deletedHolds) &&
      envelope.data.deletedHolds >= 0,
    `Production reset failed closed: expected RESET with nine restored slots, received HTTP ${response.status}.`,
  );
  return {
    correlationId: responseCorrelation,
    deletedHolds: envelope.data.deletedHolds,
    durationMs: performance.now() - startedAt,
    restoredSlots: envelope.data.restoredSlots,
    status: "RESET",
  };
};

const assertSearchData = (data) =>
  isRecord(data) &&
  isRecord(data.providerStatuses) &&
  PROVIDERS.every((provider) => data.providerStatuses[provider] === "ONLINE") &&
  isRecord(data.selectedBundle) &&
  Array.isArray(data.selectedBundle.items) &&
  data.selectedBundle.items.length === 3 &&
  sameProviders(
    data.selectedBundle.items.map((item) =>
      isRecord(item) && isRecord(item.slot) ? item.slot.provider : null,
    ),
  );

const assertHoldData = (data) =>
  isRecord(data) &&
  data.status === "HELD" &&
  typeof data.bundleHoldId === "string" &&
  isIsoTimestamp(data.expiresAt) &&
  Array.isArray(data.providerHolds) &&
  data.providerHolds.length === 3 &&
  data.providerHolds.every(
    (hold) =>
      isRecord(hold) &&
      hold.status === "HELD" &&
      typeof hold.holdSafeReference === "string",
  ) &&
  sameProviders(data.providerHolds.map((hold) => hold.provider));

const assertConfirmData = (data) =>
  isRecord(data) &&
  data.status === "CONFIRMED" &&
  isIsoTimestamp(data.confirmedAt) &&
  Array.isArray(data.reservations) &&
  data.reservations.length === 3 &&
  data.reservations.every(
    (reservation) =>
      isRecord(reservation) && typeof reservation.reservationRef === "string",
  ) &&
  sameProviders(data.reservations.map((reservation) => reservation.provider));

const assertReleaseData = (data) =>
  isRecord(data) &&
  data.status === "RELEASED" &&
  typeof data.bundleId === "string" &&
  Array.isArray(data.providerStatuses) &&
  data.providerStatuses.length === 3 &&
  data.providerStatuses.every(
    (providerStatus) =>
      isRecord(providerStatus) &&
      ["RELEASED", "EXPIRED"].includes(providerStatus.status),
  ) &&
  sameProviders(
    data.providerStatuses.map((providerStatus) => providerStatus.provider),
  );

const captureUiOperation = async ({
  button,
  claimCorrelation,
  dataIsValid,
  followupButton,
  operation,
  page,
  path,
}) => {
  const expectedCorrelation = `production-reliability-ui-${randomUUID()}`;
  await page.route(
    `${HUB_ORIGIN}${path}`,
    async (route) => {
      await route.continue({
        headers: {
          ...route.request().headers(),
          "x-correlation-id": expectedCorrelation,
        },
      });
    },
    { times: 1 },
  );
  const startedAt = performance.now();
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) => {
        const url = new URL(candidate.url());
        return (
          url.origin === HUB_ORIGIN &&
          url.pathname === path &&
          candidate.request().method() === "POST"
        );
      },
      { timeout: OPERATION_TIMEOUT_MS },
    ),
    (async () => {
      await button.click({ timeout: OPERATION_TIMEOUT_MS });
      if (followupButton) {
        await followupButton.waitFor({
          state: "visible",
          timeout: OPERATION_TIMEOUT_MS,
        });
        await followupButton.click({ timeout: OPERATION_TIMEOUT_MS });
      }
    })(),
  ]);
  const responseUrl = new URL(response.url());
  const contentType = (await response.headerValue("content-type")) ?? "";
  assert(
    response.status() === 200 &&
      responseUrl.origin === HUB_ORIGIN &&
      responseUrl.pathname === path &&
      responseUrl.search === "" &&
      response.request().redirectedFrom() === null &&
      contentType.toLowerCase().includes("application/json"),
    `${operation} returned an unexpected HTTP response.`,
  );
  let envelope;
  try {
    envelope = await withHardTimeout(
      response.json(),
      OPERATION_TIMEOUT_MS,
      `${operation} response body timed out.`,
    );
  } catch {
    throw new SafeScriptError(`${operation} returned invalid JSON.`);
  }
  const responseCorrelation = await response.headerValue("x-correlation-id");
  const requestCorrelation = await response
    .request()
    .headerValue("x-correlation-id");
  assert(
    requestCorrelation === expectedCorrelation &&
      responseCorrelation === expectedCorrelation,
    `${operation} did not preserve its caller-bound correlation ID.`,
  );
  assertEnvelopeMeta(
    envelope,
    responseCorrelation,
    operation,
    claimCorrelation,
  );
  assert(dataIsValid(envelope.data), `${operation} returned invalid data.`);
  let requestBody;
  try {
    requestBody = response.request().postDataJSON();
  } catch {
    throw new SafeScriptError(`${operation} sent an invalid JSON request.`);
  }
  assert(isRecord(requestBody), `${operation} sent an invalid request body.`);
  return {
    correlationId: responseCorrelation,
    data: envelope.data,
    durationMs: performance.now() - startedAt,
    requestBody,
    status: envelope.data.status ?? "COMPOSED",
  };
};

const assertHoldContinuity = (search, hold, iteration) => {
  const searchData = search.data;
  const holdData = hold.data;
  const holdRequest = hold.requestBody;
  const embeddedSession = holdRequest.bundleSession;
  const selected = searchData.selectedBundle;
  assert(
    isRecord(embeddedSession) &&
      holdRequest.schemaVersion === "1" &&
      holdRequest.bundleSessionId === searchData.bundleSessionId &&
      holdRequest.bundleId === selected.bundleId &&
      holdRequest.bundleVersion === selected.bundleVersion &&
      embeddedSession.bundleSessionId === searchData.bundleSessionId &&
      embeddedSession.bundleVersion === searchData.bundleVersion &&
      embeddedSession.selectedBundleId === selected.bundleId &&
      JSON.stringify(embeddedSession.intent) ===
        JSON.stringify(search.requestBody) &&
      Array.isArray(embeddedSession.candidates) &&
      embeddedSession.candidates.some(
        (candidate) =>
          isRecord(candidate) &&
          candidate.bundleId === selected.bundleId &&
          candidate.bundleVersion === selected.bundleVersion,
      ) &&
      holdData.bundleId === selected.bundleId &&
      typeof holdData.bundleHoldId === "string" &&
      holdData.bundleHoldId.length > 0,
    `Iteration ${iteration} did not preserve the selected search identity through hold.`,
  );

  const selectedSlotByProvider = Object.fromEntries(
    selected.items.map((item) => [item.slot.provider, item.slot.slotId]),
  );
  const holdReferenceByProvider = Object.fromEntries(
    holdData.providerHolds.map((item) => [
      item.provider,
      item.holdSafeReference,
    ]),
  );
  assert(
    PROVIDERS.every(
      (provider) =>
        typeof selectedSlotByProvider[provider] === "string" &&
        typeof holdReferenceByProvider[provider] === "string",
    ),
    `Iteration ${iteration} could not bind all Provider slots to hold references.`,
  );
  return {
    bundleHoldId: holdData.bundleHoldId,
    bundleId: selected.bundleId,
    bundleSessionId: searchData.bundleSessionId,
    holdReferenceByProvider,
    selectedSlotByProvider,
  };
};

const assertConfirmContinuity = (confirm, workflow, iteration) => {
  const confirmRequest = confirm.requestBody;
  const confirmData = confirm.data;
  assert(
    confirmRequest.schemaVersion === "1" &&
      confirmRequest.bundleSessionId === workflow.bundleSessionId &&
      confirmRequest.bundleHoldId === workflow.bundleHoldId &&
      confirmData.bundleId === workflow.bundleId,
    `Iteration ${iteration} did not preserve the active hold identity through confirmation.`,
  );
  const reservationByProvider = Object.fromEntries(
    confirmData.reservations.map((reservation) => [
      reservation.provider,
      reservation.reservationRef,
    ]),
  );
  assert(
    PROVIDERS.every(
      (provider) => typeof reservationByProvider[provider] === "string",
    ),
    `Iteration ${iteration} confirmation did not bind all Provider reservations.`,
  );
  return reservationByProvider;
};

const assertReleaseContinuity = (release, workflow, iteration) => {
  const releaseRequest = release.requestBody;
  const releaseData = release.data;
  assert(
    releaseRequest.schemaVersion === "1" &&
      releaseRequest.bundleSessionId === workflow.bundleSessionId &&
      releaseRequest.bundleHoldId === workflow.bundleHoldId &&
      releaseRequest.reason === "USER_CANCELLED" &&
      releaseData.bundleId === workflow.bundleId,
    `Iteration ${iteration} did not preserve the active hold identity through release.`,
  );
  const statusByProvider = Object.fromEntries(
    releaseData.providerStatuses.map((providerStatus) => [
      providerStatus.provider,
      providerStatus.status,
    ]),
  );
  assert(
    PROVIDERS.every((provider) =>
      ["RELEASED", "EXPIRED"].includes(statusByProvider[provider]),
    ),
    `Iteration ${iteration} release did not reach a terminal state for all three Providers.`,
  );
  return statusByProvider;
};

const openProviderAuditors = async ({
  browserSessionId,
  context,
  ignoredBrowserEvents,
  iteration,
  workflow,
}) => {
  const auditors = [];
  for (let index = 0; index < PROVIDERS.length; index += 1) {
    const provider = PROVIDERS[index];
    const origin = PROVIDER_ORIGINS[index];
    const page = await context.newPage();
    const browserErrors = [];
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      if (isKnownFavicon404(message, origin)) {
        ignoredBrowserEvents.push(`${provider}-favicon-404`);
        return;
      }
      browserErrors.push(
        `console-error:${safeBrowserDiagnostic(message.text())}`,
      );
    });
    page.on("pageerror", (error) =>
      browserErrors.push(`page-error:${safeBrowserDiagnostic(error.message)}`),
    );
    const source = `${origin}/embed?session=${encodeURIComponent(browserSessionId)}`;
    const navigation = await page.goto(source, {
      timeout: NAVIGATION_TIMEOUT_MS,
      waitUntil: "domcontentloaded",
    });
    assert(
      navigation?.status() === 200 && page.url() === source,
      `Iteration ${iteration} could not open the ${provider} status auditor.`,
    );
    await page
      .locator('[data-registration-count="5"]')
      .waitFor({ state: "attached", timeout: OPERATION_TIMEOUT_MS });
    const tools = await withHardTimeout(
      page.evaluate(async (timeoutMs) => {
        const context = globalThis.document.modelContext;
        if (!context) return [];
        const controller = new globalThis.AbortController();
        const timeout = globalThis.setTimeout(
          () =>
            controller.abort(
              new globalThis.DOMException("Timeout", "TimeoutError"),
            ),
          timeoutMs,
        );
        const aborted = new Promise((_, reject) => {
          controller.signal.addEventListener(
            "abort",
            () => reject(controller.signal.reason),
            { once: true },
          );
        });
        try {
          const tools = await Promise.race([context.getTools(), aborted]);
          return tools.map((tool) => ({
            name: tool.name,
            readOnlyHint: tool.annotations?.readOnlyHint === true,
          }));
        } finally {
          globalThis.clearTimeout(timeout);
        }
      }, OPERATION_TIMEOUT_MS - 1_000),
      OPERATION_TIMEOUT_MS,
      `Iteration ${iteration} ${provider} tool inventory timed out.`,
    );
    assert(
      tools.length === 5 &&
        tools.some(
          (tool) =>
            tool.name === `${provider}_get_hold_status` && tool.readOnlyHint,
        ) &&
        browserErrors.length === 0,
      `Iteration ${iteration} could not establish the ${provider} read-only status proof.`,
    );
    auditors.push({
      browserErrors,
      holdSafeReference: workflow.holdReferenceByProvider[provider],
      origin,
      page,
      provider,
      slotId: workflow.selectedSlotByProvider[provider],
    });
  }
  return auditors;
};

const readProviderStatuses = async ({
  auditors,
  browserSessionId,
  claimCorrelation,
  expectedReservations,
  expectedStatus,
  expectedStatuses,
  iteration,
}) => {
  const results = [];
  for (const auditor of auditors) {
    const terminalStatus =
      expectedStatuses?.[auditor.provider] ?? expectedStatus;
    assert(
      ["HELD", "CONFIRMED", "RELEASED", "EXPIRED"].includes(terminalStatus),
      `Iteration ${iteration} did not provide an expected ${auditor.provider} Provider status.`,
    );
    const path = `/api/holds/${encodeURIComponent(auditor.holdSafeReference)}`;
    const startedAt = performance.now();
    const [response, serialized] = await Promise.all([
      auditor.page.waitForResponse(
        (candidate) => {
          const url = new URL(candidate.url());
          return (
            url.origin === auditor.origin &&
            url.pathname === path &&
            candidate.request().method() === "POST"
          );
        },
        { timeout: OPERATION_TIMEOUT_MS },
      ),
      withHardTimeout(
        auditor.page.evaluate(
          async ({ input, timeoutMs, toolName }) => {
            const context = globalThis.document.modelContext;
            if (!context) throw new Error("Provider WebMCP unavailable");
            const controller = new globalThis.AbortController();
            const timeout = globalThis.setTimeout(
              () =>
                controller.abort(
                  new globalThis.DOMException("Timeout", "TimeoutError"),
                ),
              timeoutMs,
            );
            const aborted = new Promise((_, reject) => {
              controller.signal.addEventListener(
                "abort",
                () => reject(controller.signal.reason),
                { once: true },
              );
            });
            try {
              const tools = await Promise.race([context.getTools(), aborted]);
              const tool = tools.find(
                (candidate) => candidate.name === toolName,
              );
              if (!tool) throw new Error("Provider status tool unavailable");
              return await Promise.race([
                context.executeTool(tool, JSON.stringify(input), {
                  signal: controller.signal,
                }),
                aborted,
              ]);
            } finally {
              globalThis.clearTimeout(timeout);
            }
          },
          {
            input: {
              browserSessionId,
              holdSafeReference: auditor.holdSafeReference,
              schemaVersion: "1",
            },
            timeoutMs: OPERATION_TIMEOUT_MS - 1_000,
            toolName: `${auditor.provider}_get_hold_status`,
          },
        ),
        OPERATION_TIMEOUT_MS,
        `Iteration ${iteration} ${auditor.provider} ${terminalStatus} tool execution timed out.`,
      ),
    ]);
    assert(
      response.status() === 200 &&
        (await response.headerValue("content-type"))
          ?.toLowerCase()
          .includes("application/json") === true &&
        typeof serialized === "string",
      `Iteration ${iteration} ${auditor.provider} ${terminalStatus} proof returned an invalid HTTP response.`,
    );
    let httpEnvelope;
    let toolEnvelope;
    let requestBody;
    try {
      httpEnvelope = await withHardTimeout(
        response.json(),
        OPERATION_TIMEOUT_MS,
        `Iteration ${iteration} ${auditor.provider} ${terminalStatus} response body timed out.`,
      );
      toolEnvelope = JSON.parse(serialized);
      requestBody = response.request().postDataJSON();
    } catch {
      throw new SafeScriptError(
        `Iteration ${iteration} ${auditor.provider} ${terminalStatus} proof returned invalid JSON.`,
      );
    }
    const responseCorrelation = await response.headerValue("x-correlation-id");
    const responseUrl = new URL(response.url());
    const statusChecks = {
      browserClean: auditor.browserErrors.length === 0,
      envelopeMatchesHttp:
        JSON.stringify(httpEnvelope) === JSON.stringify(toolEnvelope),
      envelopeMeta:
        isRecord(toolEnvelope) &&
        toolEnvelope.schemaVersion === "1" &&
        isRecord(toolEnvelope.meta) &&
        toolEnvelope.meta.origin === auditor.origin &&
        toolEnvelope.meta.correlationId === responseCorrelation &&
        isIsoTimestamp(toolEnvelope.meta.completedAt),
      envelopeSuccess: isRecord(toolEnvelope) && toolEnvelope.ok === true,
      provider:
        isRecord(toolEnvelope) &&
        isRecord(toolEnvelope.data) &&
        toolEnvelope.data.provider === auditor.provider,
      reference:
        isRecord(toolEnvelope) &&
        isRecord(toolEnvelope.data) &&
        toolEnvelope.data.holdSafeReference === auditor.holdSafeReference,
      requestIdentity:
        isRecord(requestBody) &&
        Object.keys(requestBody).sort().join(",") ===
          "browserSessionId,holdSafeReference,schemaVersion" &&
        requestBody.browserSessionId === browserSessionId &&
        requestBody.holdSafeReference === auditor.holdSafeReference &&
        requestBody.schemaVersion === "1",
      reservation:
        terminalStatus !== "CONFIRMED" ||
        (isRecord(toolEnvelope) &&
          isRecord(toolEnvelope.data) &&
          toolEnvelope.data.reservationRef ===
            expectedReservations[auditor.provider]),
      route:
        responseUrl.origin === auditor.origin &&
        responseUrl.pathname === path &&
        responseUrl.search === "" &&
        response.request().redirectedFrom() === null,
      slot:
        isRecord(toolEnvelope) &&
        isRecord(toolEnvelope.data) &&
        toolEnvelope.data.slotId === auditor.slotId,
      status:
        isRecord(toolEnvelope) &&
        isRecord(toolEnvelope.data) &&
        toolEnvelope.data.status === terminalStatus,
    };
    assert(
      Object.values(statusChecks).every(Boolean),
      `Iteration ${iteration} ${auditor.provider} did not prove authoritative ${terminalStatus} state: checks=${JSON.stringify(
        statusChecks,
      )}; envelopeOk=${isRecord(toolEnvelope) ? String(toolEnvelope.ok) : "invalid"}; publicStatus=${
        isRecord(toolEnvelope) && isRecord(toolEnvelope.data)
          ? safeBrowserDiagnostic(toolEnvelope.data.status)
          : "none"
      }; errorCode=${
        isRecord(toolEnvelope) && isRecord(toolEnvelope.error)
          ? safeBrowserDiagnostic(toolEnvelope.error.code)
          : "none"
      }.`,
    );
    claimCorrelation(
      responseCorrelation,
      `Iteration ${iteration} ${auditor.provider} ${terminalStatus} status`,
    );
    results.push({
      correlationId: responseCorrelation,
      durationMs: performance.now() - startedAt,
      provider: auditor.provider,
      status: terminalStatus,
    });
  }
  return results;
};

const assertUiProof = async ({
  holdCorrelation,
  operatorSecret,
  page,
  providerFrameResponses,
  searchCorrelation,
  terminal,
  terminalCorrelation,
}) => {
  const startedAt = performance.now();
  const proof = page.locator("details.webmcp-proof");
  if ((await proof.getAttribute("open")) === null) {
    await proof.locator(":scope > summary").click({
      timeout: OPERATION_TIMEOUT_MS,
    });
  }
  await proof.locator(".proof-body").waitFor({
    state: "visible",
    timeout: OPERATION_TIMEOUT_MS,
  });

  const providerOriginLabels = await proof
    .locator(".provider-frame-grid figcaption span")
    .allTextContents();
  assert(
    providerOriginLabels.length === PROVIDER_ORIGINS.length &&
      providerOriginLabels.every(
        (origin, index) => origin.trim() === PROVIDER_ORIGINS[index],
      ),
    "Proof audit did not expose the three fixed Provider origins in order.",
  );

  const frameSources = await proof
    .locator(".provider-frame-grid iframe")
    .evaluateAll((frames) => frames.map((frame) => frame.getAttribute("src")));
  const frameSessions = [];
  assert(
    frameSources.length === PROVIDER_ORIGINS.length &&
      frameSources.every((source, index) => {
        if (typeof source !== "string") return false;
        const url = new URL(source);
        const keys = [...url.searchParams.keys()];
        const session = url.searchParams.get("session") ?? "";
        frameSessions.push(session);
        return (
          url.origin === PROVIDER_ORIGINS[index] &&
          url.pathname === "/embed" &&
          keys.length === 1 &&
          keys[0] === "session" &&
          UUID_PATTERN.test(session) &&
          url.hash === "" &&
          providerFrameResponses.get(url.origin)?.status === 200 &&
          providerFrameResponses.get(url.origin)?.url === source
        );
      }),
    "Proof audit did not contain three exact-origin Provider documents.",
  );
  assert(
    new Set(frameSessions).size === 1,
    "Proof audit Provider documents did not share one exact browser session.",
  );

  for (let index = 0; index < PROVIDER_ORIGINS.length; index += 1) {
    const source = frameSources[index];
    const frame = page.frames().find((candidate) => candidate.url() === source);
    assert(
      frame,
      `Proof audit could not attach to the ${PROVIDERS[index]} Provider document.`,
    );
    const providerCard = frame.locator(".provider-embed");
    await providerCard.waitFor({
      state: "visible",
      timeout: OPERATION_TIMEOUT_MS,
    });
    assert(
      (await providerCard.getAttribute("data-provider")) === PROVIDERS[index] &&
        (await providerCard.getAttribute("data-connection")) ===
          "Manual connection" &&
        (await providerCard.getAttribute("data-operation")) ===
          (terminal === "confirm" ? "Confirmed" : "Released") &&
        (await frame.locator(".provider-embed__latest").innerText()).includes(
          terminal === "confirm"
            ? "Demo reservation confirmed"
            : "Hold released",
        ),
      `Proof audit ${PROVIDERS[index]} document did not render the ${terminal} manual result.`,
    );
  }

  const activities = await proof
    .locator(".activity-list > li")
    .allTextContents();
  const expected = [
    ["Manual search three providers", searchCorrelation],
    ["Manual hold three providers", holdCorrelation],
    [
      terminal === "confirm"
        ? "Manual confirm three providers"
        : "Manual release three providers",
      terminalCorrelation,
    ],
  ];
  assert(
    activities.length === expected.length,
    "Proof audit did not contain exactly three workflow events.",
  );
  expected.forEach(([name, correlationId], index) => {
    const text = activities[index] ?? "";
    assert(
      text.includes(name) &&
        text.includes("Manual fallback") &&
        text.includes("Complete") &&
        text.includes(HUB_ORIGIN) &&
        text.includes(`correlation ${correlationId}`),
      `Proof audit event ${index + 1} did not match its authoritative response.`,
    );
  });

  const proofText = await proof.innerText();
  assert(
    !proofText.includes(operatorSecret) &&
      ![
        "DEMO_OPERATOR_SECRET",
        "x-serendipity-operator-secret",
        "holdToken",
        "hold_token",
        "idempotencyKey",
        "idempotency_key",
      ].some((name) => proofText.includes(name)),
    "Proof audit exposed a private field name or operator credential.",
  );
  return performance.now() - startedAt;
};

const observeReleasingUi = async (page, iteration) => {
  const observed = await withHardTimeout(
    page.evaluate(
      ({ heading, notice, timeoutMs }) =>
        new Promise((resolve) => {
          let timeout;
          const inspect = () => {
            const headingElement =
              globalThis.document.querySelector(".release-heading");
            const noticeElement =
              globalThis.document.querySelector(".pending-notice");
            const actionLabels = [
              ...globalThis.document.querySelectorAll("button"),
            ].map((button) => button.textContent?.trim());
            if (
              headingElement?.textContent?.trim() === heading &&
              noticeElement?.textContent?.trim() === notice &&
              !actionLabels.includes("Confirm demo reservation") &&
              !actionLabels.includes("Release hold")
            ) {
              observer.disconnect();
              globalThis.clearTimeout(timeout);
              resolve(true);
            }
          };
          const observer = new globalThis.MutationObserver(inspect);
          observer.observe(globalThis.document.documentElement, {
            childList: true,
            subtree: true,
          });
          timeout = globalThis.setTimeout(() => {
            observer.disconnect();
            resolve(false);
          }, timeoutMs);
          inspect();
        }),
      {
        heading: "Releasing your hold…",
        notice: "Releasing all three temporary holds…",
        timeoutMs: OPERATION_TIMEOUT_MS - 1_000,
      },
    ),
    OPERATION_TIMEOUT_MS,
    `Iteration ${iteration} releasing UI observation timed out.`,
  );
  assert(
    observed === true,
    `Iteration ${iteration} did not expose the central releasing state with both terminal actions blocked.`,
  );
};

const runUiWorkflow = async (
  browser,
  iteration,
  operatorSecret,
  claimCorrelation,
  terminal,
) => {
  const context = await browser.newContext({
    acceptDownloads: false,
    ignoreHTTPSErrors: false,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
  page.setDefaultTimeout(OPERATION_TIMEOUT_MS);
  const unsafeBrowserEvents = [];
  const ignoredBrowserEvents = [];
  const providerFrameResponses = new Map();
  const terminalRequestCounts = { confirm: 0, release: 0 };
  context.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === HUB_ORIGIN && url.pathname === "/api/manual/confirm") {
      terminalRequestCounts.confirm += 1;
    }
    if (url.origin === HUB_ORIGIN && url.pathname === "/api/manual/release") {
      terminalRequestCounts.release += 1;
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      if (isKnownFavicon404(message, HUB_ORIGIN)) {
        ignoredBrowserEvents.push("hub-favicon-404");
        return;
      }
      unsafeBrowserEvents.push(
        `console-error:${safeBrowserDiagnostic(message.text())}:source=${safeBrowserDiagnostic(
          location.url || "unknown",
        )}:${location.lineNumber ?? 0}:${location.columnNumber ?? 0}`,
      );
    }
  });
  page.on("pageerror", (error) =>
    unsafeBrowserEvents.push(
      `page-error:${safeBrowserDiagnostic(error.message)}`,
    ),
  );
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (PROVIDER_ORIGINS.includes(url.origin) && url.pathname === "/embed") {
      providerFrameResponses.set(url.origin, {
        status: response.status(),
        url: response.url(),
      });
    }
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.origin === HUB_ORIGIN && url.pathname.startsWith("/api/manual/")) {
      unsafeBrowserEvents.push(
        `workflow-request-failed:${url.pathname}:${safeBrowserDiagnostic(request.failure()?.errorText)}`,
      );
    }
    if (PROVIDER_ORIGINS.includes(url.origin) && url.pathname === "/embed") {
      unsafeBrowserEvents.push(
        `provider-document-failed:${url.origin}${url.pathname}:${safeBrowserDiagnostic(request.failure()?.errorText)}`,
      );
    }
  });

  try {
    const navigation = await page.goto(PLANNER_URL, {
      timeout: NAVIGATION_TIMEOUT_MS,
      waitUntil: "domcontentloaded",
    });
    assert(
      navigation?.status() === 200 &&
        page.url() === PLANNER_URL &&
        (await page.locator(".provider-sticker").count()) === 3,
      `Iteration ${iteration} did not load the fixed Hub production page.`,
    );
    await page
      .locator('main[data-client-ready="true"]')
      .waitFor({ state: "attached", timeout: OPERATION_TIMEOUT_MS });
    await page.locator(".webmcp-proof > summary").click();
    await page
      .locator('main[data-bound-provider-count="3"]')
      .waitFor({ state: "attached", timeout: OPERATION_TIMEOUT_MS });
    const mode = await page.locator(".network-pill").getAttribute("data-mode");
    assert(
      mode === "manual" || mode === "webmcp",
      `Iteration ${iteration} did not expose a truthful connection mode.`,
    );
    assert(
      unsafeBrowserEvents.length === 0,
      `Iteration ${iteration} emitted a browser or workflow error before planning: ${browserEventSummary(unsafeBrowserEvents)}.`,
    );

    let clickToTerminalMs = 0;
    let userPathSegmentStartedAt = performance.now();
    const search = await captureUiOperation({
      button: page.getByRole("button", { exact: true, name: "Plan my night" }),
      claimCorrelation,
      dataIsValid: assertSearchData,
      operation: `Iteration ${iteration} search`,
      page,
      path: "/api/manual/search",
    });
    await page
      .getByRole("heading", { exact: true, name: "Tonight got interesting." })
      .waitFor({ state: "visible" });
    clickToTerminalMs += performance.now() - userPathSegmentStartedAt;
    const browserSessionId = (await context.cookies(HUB_ORIGIN)).find(
      ({ name }) => name === "serendipity-session",
    )?.value;
    assert(
      typeof browserSessionId === "string" &&
        UUID_PATTERN.test(browserSessionId) &&
        unsafeBrowserEvents.length === 0,
      `Iteration ${iteration} emitted a browser or workflow error during search: ${browserEventSummary(unsafeBrowserEvents)}.`,
    );

    userPathSegmentStartedAt = performance.now();
    const hold = await captureUiOperation({
      button: page.getByRole("button", {
        exact: true,
        name: "Hold for 90 seconds",
      }),
      claimCorrelation,
      dataIsValid: assertHoldData,
      operation: `Iteration ${iteration} hold`,
      page,
      path: "/api/manual/hold",
    });
    await page
      .getByRole("heading", { exact: true, name: "Your night is held." })
      .waitFor({ state: "visible" });
    clickToTerminalMs += performance.now() - userPathSegmentStartedAt;
    const workflow = assertHoldContinuity(search, hold, iteration);
    const auditors = await openProviderAuditors({
      browserSessionId,
      context,
      ignoredBrowserEvents,
      iteration,
      workflow,
    });
    const heldProviderStatuses = await readProviderStatuses({
      auditors,
      browserSessionId,
      claimCorrelation,
      expectedReservations: {},
      expectedStatus: "HELD",
      iteration,
    });
    assert(
      unsafeBrowserEvents.length === 0,
      `Iteration ${iteration} emitted a browser or workflow error during hold: ${browserEventSummary(unsafeBrowserEvents)}.`,
    );

    let result;
    userPathSegmentStartedAt = performance.now();
    if (terminal === "confirm") {
      const confirm = await captureUiOperation({
        button: page.getByRole("button", {
          exact: true,
          name: "Confirm demo reservation",
        }),
        claimCorrelation,
        dataIsValid: assertConfirmData,
        followupButton: page.getByRole("button", {
          exact: true,
          name: "Confirm demo route",
        }),
        operation: `Iteration ${iteration} confirm`,
        page,
        path: "/api/manual/confirm",
      });
      const reservationByProvider = assertConfirmContinuity(
        confirm,
        workflow,
        iteration,
      );
      const receiptHeading = page.getByRole("heading", {
        exact: true,
        name: "Your night is confirmed.",
      });
      await receiptHeading.waitFor({ state: "visible" });
      clickToTerminalMs += performance.now() - userPathSegmentStartedAt;
      await page.waitForFunction(
        () =>
          globalThis.document.activeElement?.classList.contains("receipt") ===
          true,
      );
      const receiptItems = await page
        .locator(".receipt > ul > li")
        .allTextContents();
      assert(
        (await page
          .locator('.provider-sticker[aria-label*="Confirmed"]')
          .count()) === 3 &&
          receiptItems.length === 3 &&
          Object.values(reservationByProvider).every((reference) =>
            receiptItems.some((text) => text.includes(reference)),
          ) &&
          unsafeBrowserEvents.length === 0,
        `Iteration ${iteration} receipt did not confirm all three Providers cleanly: ${browserEventSummary(unsafeBrowserEvents)}.`,
      );
      const confirmedProviderStatuses = await readProviderStatuses({
        auditors,
        browserSessionId,
        claimCorrelation,
        expectedReservations: reservationByProvider,
        expectedStatus: "CONFIRMED",
        iteration,
      });
      const proofAuditMs = await assertUiProof({
        holdCorrelation: hold.correlationId,
        operatorSecret,
        page,
        providerFrameResponses,
        searchCorrelation: search.correlationId,
        terminal,
        terminalCorrelation: confirm.correlationId,
      });
      assert(
        unsafeBrowserEvents.length === 0,
        `Iteration ${iteration} emitted a browser or workflow error during proof audit: ${browserEventSummary(unsafeBrowserEvents)}.`,
      );
      result = {
        correlations: {
          confirm: confirm.correlationId,
          hold: hold.correlationId,
          providerConfirmed: Object.fromEntries(
            confirmedProviderStatuses.map(({ correlationId, provider }) => [
              provider,
              correlationId,
            ]),
          ),
          providerHeld: Object.fromEntries(
            heldProviderStatuses.map(({ correlationId, provider }) => [
              provider,
              correlationId,
            ]),
          ),
          search: search.correlationId,
        },
        durationsMs: {
          clickToReceipt: clickToTerminalMs,
          confirm: confirm.durationMs,
          hold: hold.durationMs,
          providerConfirmed: confirmedProviderStatuses.map(
            ({ durationMs }) => durationMs,
          ),
          providerHeld: heldProviderStatuses.map(
            ({ durationMs }) => durationMs,
          ),
          proofAudit: proofAuditMs,
          search: search.durationMs,
        },
        iteration,
        ignoredBrowserEvents,
        mode,
        providerStateProof: {
          confirmed: confirmedProviderStatuses.map(({ provider, status }) => ({
            provider,
            status,
          })),
          held: heldProviderStatuses.map(({ provider, status }) => ({
            provider,
            status,
          })),
        },
        status: "PASS",
      };
    } else {
      const releasingUiObservation = observeReleasingUi(page, iteration);
      const releaseOperation = captureUiOperation({
        button: page.getByRole("button", {
          exact: true,
          name: "Release hold",
        }),
        claimCorrelation,
        dataIsValid: assertReleaseData,
        followupButton: page.getByRole("button", {
          exact: true,
          name: "Release all holds",
        }),
        operation: `Iteration ${iteration} release`,
        page,
        path: "/api/manual/release",
      });
      const [release] = await Promise.all([
        releaseOperation,
        releasingUiObservation,
      ]);
      const releasedStatusByProvider = assertReleaseContinuity(
        release,
        workflow,
        iteration,
      );
      await page
        .getByRole("button", {
          exact: true,
          name: "Search live availability again",
        })
        .waitFor({ state: "visible", timeout: OPERATION_TIMEOUT_MS });
      clickToTerminalMs += performance.now() - userPathSegmentStartedAt;
      assert(
        (await page
          .locator('.provider-sticker[aria-label*="Released"]')
          .count()) === 3 &&
          (await page
            .getByRole("button", {
              exact: true,
              name: "Confirm demo reservation",
            })
            .count()) === 0 &&
          (await page
            .getByRole("button", { exact: true, name: "Release hold" })
            .count()) === 0 &&
          terminalRequestCounts.confirm === 0 &&
          terminalRequestCounts.release === 1 &&
          unsafeBrowserEvents.length === 0,
        `Iteration ${iteration} did not finish in a clean release-only fresh-search state: confirmRequests=${terminalRequestCounts.confirm}; releaseRequests=${terminalRequestCounts.release}; browserEvents=${browserEventSummary(unsafeBrowserEvents)}.`,
      );
      const releasedProviderStatuses = await readProviderStatuses({
        auditors,
        browserSessionId,
        claimCorrelation,
        expectedReservations: {},
        expectedStatuses: releasedStatusByProvider,
        iteration,
      });
      const proofAuditMs = await assertUiProof({
        holdCorrelation: hold.correlationId,
        operatorSecret,
        page,
        providerFrameResponses,
        searchCorrelation: search.correlationId,
        terminal,
        terminalCorrelation: release.correlationId,
      });
      assert(
        terminalRequestCounts.confirm === 0 &&
          terminalRequestCounts.release === 1 &&
          unsafeBrowserEvents.length === 0,
        `Iteration ${iteration} emitted a browser, confirm, or duplicate release event during proof audit: confirmRequests=${terminalRequestCounts.confirm}; releaseRequests=${terminalRequestCounts.release}; browserEvents=${browserEventSummary(unsafeBrowserEvents)}.`,
      );
      result = {
        correlations: {
          hold: hold.correlationId,
          providerHeld: Object.fromEntries(
            heldProviderStatuses.map(({ correlationId, provider }) => [
              provider,
              correlationId,
            ]),
          ),
          providerReleased: Object.fromEntries(
            releasedProviderStatuses.map(({ correlationId, provider }) => [
              provider,
              correlationId,
            ]),
          ),
          release: release.correlationId,
          search: search.correlationId,
        },
        durationsMs: {
          clickToRelease: clickToTerminalMs,
          hold: hold.durationMs,
          providerHeld: heldProviderStatuses.map(
            ({ durationMs }) => durationMs,
          ),
          providerReleased: releasedProviderStatuses.map(
            ({ durationMs }) => durationMs,
          ),
          proofAudit: proofAuditMs,
          release: release.durationMs,
          search: search.durationMs,
        },
        iteration,
        ignoredBrowserEvents,
        mode,
        providerStateProof: {
          held: heldProviderStatuses.map(({ provider, status }) => ({
            provider,
            status,
          })),
          released: releasedProviderStatuses.map(({ provider, status }) => ({
            provider,
            status,
          })),
        },
        requestCounts: terminalRequestCounts,
        releasingUiObserved: true,
        requiresFreshSearch: true,
        status: "PASS",
      };
    }
    if (iteration < RUNS) {
      assert(
        await closeWithin(() => context.close(), 5_000),
        `Iteration ${iteration} browser context did not close within five seconds.`,
      );
    }
    return result;
  } catch (error) {
    void context.close().catch(() => undefined);
    throw error;
  }
};

const run = async () => {
  assert(
    process.argv.length === 2,
    "This command does not accept arguments or a configurable origin.",
  );
  const terminal =
    process.env.PRODUCTION_WORKFLOW_TERMINAL === "release"
      ? "release"
      : "confirm";
  if (terminal === "release") {
    assert(
      process.env.ALLOW_PRODUCTION_RELEASE_WORKFLOW ===
        PRODUCTION_RELEASE_WORKFLOW_OPT_IN,
      `Set ALLOW_PRODUCTION_RELEASE_WORKFLOW=${PRODUCTION_RELEASE_WORKFLOW_OPT_IN} to authorize the fixed 20-release production sequence explicitly.`,
    );
  } else {
    assert(
      process.env.ALLOW_PRODUCTION_WORKFLOW === PRODUCTION_WORKFLOW_OPT_IN,
      `Set ALLOW_PRODUCTION_WORKFLOW=${PRODUCTION_WORKFLOW_OPT_IN} to authorize the fixed 20-confirmation production sequence explicitly.`,
    );
  }
  const operatorSecret = readOperatorSecret();
  delete process.env.DEMO_OPERATOR_SECRET;
  const ledger = createCorrelationLedger();
  const resets = [];
  const runs = [];
  let browser;
  let primaryError = null;
  let finalResetError = null;
  let browserTerminationFailed = false;

  try {
    browser = await chromium.launch({
      channel: "chrome",
      headless: true,
      args: [
        "--enable-features=WebMCP,WebMCPTesting",
        "--enable-blink-features=WebMCP",
      ],
    });
    for (let index = 1; index <= RUNS; index += 1) {
      const reset = await resetProduction(operatorSecret, (value, operation) =>
        ledger.claim(value, operation),
      );
      resets.push(reset);
      runs.push(
        await runUiWorkflow(
          browser,
          index,
          operatorSecret,
          (value, operation) => ledger.claim(value, operation),
          terminal,
        ),
      );
    }
  } catch (error) {
    primaryError = error;
  } finally {
    let browserCloseAttempted = false;
    if (primaryError && browser) {
      browserCloseAttempted = true;
      browserTerminationFailed = !(await terminateFailedBrowser(browser));
      if (!browserTerminationFailed) {
        await wait(FAILURE_QUIESCENCE_MS);
      }
    }
    if (!browserTerminationFailed) {
      try {
        resets.push(
          await resetProduction(operatorSecret, (value, operation) =>
            ledger.claim(value, `Final ${operation.toLowerCase()}`),
          ),
        );
      } catch (error) {
        finalResetError = error;
      }
    }
    if (
      browser &&
      !browserCloseAttempted &&
      !(await closeWithin(() => browser.close(), 5_000)) &&
      !primaryError
    ) {
      primaryError = new SafeScriptError(
        "The production browser did not close within five seconds after the mandatory final reset.",
      );
    }
  }

  if (browserTerminationFailed) {
    throw new SafeScriptError(
      "The production workflow aborted, but browser termination could not be verified; the final reset was withheld to avoid racing a late mutation.",
    );
  }
  if (primaryError) {
    if (finalResetError) {
      throw new SafeScriptError(
        "The production workflow aborted and the mandatory final reset also failed.",
      );
    }
    const finalReset = resets.at(-1);
    process.stderr.write(
      `${JSON.stringify({
        correlationId: finalReset?.correlationId,
        finalReset: "PASS",
        restoredSlots: finalReset?.restoredSlots,
      })}\n`,
    );
    throw primaryError;
  }
  if (finalResetError) {
    throw new SafeScriptError(
      "All workflow iterations completed, but the mandatory final reset failed.",
    );
  }

  const expectedCorrelationCount = RUNS * 10 + 1;
  assert(
    ledger.values.length === expectedCorrelationCount &&
      new Set(ledger.values).size === expectedCorrelationCount,
    "The completed workflow did not produce the exact correlation coverage expected from resets, UI operations, and Provider status proofs.",
  );

  const sharedMetrics = {
    hold: metricSummary(runs.map((result) => result.durationsMs.hold)),
    providerHeld: metricSummary(
      runs.flatMap((result) => result.durationsMs.providerHeld),
    ),
    proofAudit: metricSummary(
      runs.map((result) => result.durationsMs.proofAudit),
    ),
    reset: metricSummary(resets.map((result) => result.durationMs)),
    search: metricSummary(runs.map((result) => result.durationsMs.search)),
  };
  const metrics =
    terminal === "confirm"
      ? {
          clickToReceipt: metricSummary(
            runs.map((result) => result.durationsMs.clickToReceipt),
          ),
          confirm: metricSummary(
            runs.map((result) => result.durationsMs.confirm),
          ),
          ...sharedMetrics,
          providerConfirmed: metricSummary(
            runs.flatMap((result) => result.durationsMs.providerConfirmed),
          ),
        }
      : {
          clickToRelease: metricSummary(
            runs.map((result) => result.durationsMs.clickToRelease),
          ),
          ...sharedMetrics,
          providerReleased: metricSummary(
            runs.flatMap((result) => result.durationsMs.providerReleased),
          ),
          release: metricSummary(
            runs.map((result) => result.durationsMs.release),
          ),
        };
  const sharedGates = {
    duplicateOrMissingCorrelations: 0,
    finalResetRestoredNineSlots: resets.at(-1)?.restoredSlots === 9,
    holdP95AtMost5Seconds: metrics.hold.p95Ms <= 5_000,
    invalidOrUnknownResults: 0,
    providerStateTransitions: `${runs.length}/${RUNS}`,
    searchP95AtMost3Seconds: metrics.search.p95Ms <= 3_000,
  };
  const gates =
    terminal === "confirm"
      ? {
          clickToReceiptP95AtMost20Seconds:
            metrics.clickToReceipt.p95Ms <= 20_000,
          confirmP95AtMost5Seconds: metrics.confirm.p95Ms <= 5_000,
          ...sharedGates,
          receiptCompletion: `${runs.length}/${RUNS}`,
        }
      : {
          clickToReleaseP95AtMost20Seconds:
            metrics.clickToRelease.p95Ms <= 20_000,
          confirmEndpointRequests: runs.reduce(
            (total, result) => total + result.requestCounts.confirm,
            0,
          ),
          ...sharedGates,
          releaseCompletion: `${runs.length}/${RUNS}`,
          releaseP95AtMost5Seconds: metrics.release.p95Ms <= 5_000,
          releasingUiObserved: `${
            runs.filter((result) => result.releasingUiObserved).length
          }/${RUNS}`,
          requiresFreshSearch: `${
            runs.filter((result) => result.requiresFreshSearch).length
          }/${RUNS}`,
        };
  const summary = {
    correlations: {
      duplicate: 0,
      missing: 0,
      total: ledger.values.length,
      unique: new Set(ledger.values).size,
    },
    fixedOrigin: HUB_ORIGIN,
    gates,
    metrics,
    mutations:
      terminal === "confirm"
        ? "20 sequential reset → Plan → Hold → Confirm workflows"
        : "20 sequential reset → Plan → Hold → Release workflows",
    runs,
    finalReset: resets.at(-1),
    ...(terminal === "release" ? { terminal } : {}),
    status: Object.values(gates).every(
      (value) => value === true || value === 0 || value === `${RUNS}/${RUNS}`,
    )
      ? "PASS"
      : "FAIL",
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  assert(
    summary.status === "PASS",
    "One or more production reliability gates failed.",
  );
};

try {
  await run();
} catch (error) {
  const message =
    error instanceof SafeScriptError
      ? error.message
      : `The production workflow stopped after an unexpected local failure: ${safeBrowserDiagnostic(
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error),
        )}.`;
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
