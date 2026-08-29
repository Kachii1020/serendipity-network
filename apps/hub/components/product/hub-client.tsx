"use client";

import {
  PROVIDERS,
  SCHEMA_VERSION,
  contractValidators,
  type BundleReloadData,
  type BundleSummary,
  type ConfirmBundleData,
  type ConfirmBundleInput,
  type ErrorCode,
  type FindOptionsData,
  type HoldBundleData,
  type HoldBundleInput,
  type Intent,
  type Provider,
  type PublicError,
  type ReleaseBundleData,
  type ReleaseBundleInput,
  type ShowBundleData,
  type ShowBundleInput,
} from "@serendipity/contracts";
import { canonicalIntent } from "@serendipity/test-fixtures";
import { isWebMcpAvailable, normalizeWebMcpError } from "@serendipity/webmcp";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";

import {
  createManualBindMessage,
  createManualProviderStateMessage,
  readProviderReady,
  type ProviderReady,
} from "../../lib/manual-presentation";
import { type CandidateSession, explainBundle } from "../../lib/selection";
import { createHubStore, deriveHubUi } from "../../lib/store";
import {
  createHubFailureEnvelope,
  createHubSuccessEnvelope,
} from "../../lib/hub-envelope";
import {
  registerProductTools,
  type ProductToolDependencies,
  type ProductToolInput,
  type ProductToolName,
} from "../../lib/tools/product-tools";
import { ProductView } from "./product-view";
import type {
  Mood,
  OperationLabel,
  PlanConstraints,
  ProviderProjection,
  ReceiptView,
  RecoveryView,
  ToolActivityItem,
} from "./types";
import { DEFAULT_PLAN_CONSTRAINTS } from "./types";

type PublicEnvelope = {
  data?: unknown;
  error?: PublicError;
  meta?: { completedAt?: string; correlationId?: string; origin?: string };
  ok?: boolean;
};
type BoundProvider = ProviderReady & { source: WindowProxy };

const COMPENSATION_BLOCK_KEY = "serendipity-compensation-blocked-until-v1";
const COMPENSATION_SAFETY_WINDOW_MS = 90_000;
const RELEASE_RETRY_CODES = new Set<ErrorCode>([
  "CANCELLED",
  "COMPENSATION_INCOMPLETE",
  "PROVIDER_OFFLINE",
  "PROVIDER_TIMEOUT",
  "RECONCILIATION_REQUIRED",
]);

const moodTags: Record<Mood, Intent["preferredTags"]> = {
  Surprising: ["creative", "seasonal", "experimental"],
  Cozy: ["cozy", "seasonal", "tea"],
  "Hands-on": ["hands-on", "creative", "beginner"],
  Late: ["music", "intimate", "solo-friendly"],
};

const initialProjection = (
  connection: ProviderProjection["connection"] = "Manual connection",
): Record<Provider, ProviderProjection> => ({
  kiln: { connection, operation: "Ready" },
  nori: { connection, operation: "Ready" },
  loop: { connection, operation: "Ready" },
});

const tokyoServiceDate = (now = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Tokyo",
    year: "numeric",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
};

export const intentFor = (
  mood: Mood,
  constraints: PlanConstraints,
  now = new Date(),
): Intent => {
  const serviceDate = tokyoServiceDate(now);
  return {
    ...canonicalIntent,
    endAt: `${serviceDate}${canonicalIntent.endAt.slice(10)}`,
    preferredTags: moodTags[mood],
    startAt: `${serviceDate}T${constraints.startTime}:00+09:00`,
    totalBudgetYen: constraints.totalBudgetYen,
  };
};

const constraintsForIntent = (intent: Intent): PlanConstraints => ({
  startTime: new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(intent.startAt)),
  totalBudgetYen: intent.totalBudgetYen,
});

const moodForIntent = (intent: Intent): Mood =>
  (Object.entries(moodTags) as Array<[Mood, Intent["preferredTags"]]>).reduce(
    (best, candidate) => {
      const score = candidate[1].filter((tag) =>
        intent.preferredTags.includes(tag),
      ).length;
      const bestScore = best[1].filter((tag) =>
        intent.preferredTags.includes(tag),
      ).length;
      return score > bestScore ? candidate : best;
    },
  )[0];

const correlation = (): string => globalThis.crypto.randomUUID();

const readEnvelope = async (response: Response): Promise<PublicEnvelope> => {
  const value = (await response.json()) as unknown;
  if (!contractValidators.providerResultEnvelope(value)) {
    throw new Error("The Hub response did not match the public envelope.");
  }
  return value as PublicEnvelope;
};

const activityFor = (
  envelope: PublicEnvelope,
  toolName: string,
  status: ToolActivityItem["status"],
  options: {
    durationMs: number;
    fallbackOrigin: string;
    transport: ToolActivityItem["transport"];
  },
): ToolActivityItem => ({
  completedAt: envelope.meta?.completedAt ?? new Date().toISOString(),
  correlationId: envelope.meta?.correlationId ?? correlation(),
  durationMs: options.durationMs,
  ...(envelope.error?.code ? { errorCode: envelope.error.code } : {}),
  origin: envelope.meta?.origin ?? options.fallbackOrigin,
  ...(envelope.error?.provider ? { provider: envelope.error.provider } : {}),
  status,
  toolName,
  transport: options.transport,
});

export function HubClient({
  browserSessionId,
  initialConstraints = DEFAULT_PLAN_CONSTRAINTS,
  initialMood = "Surprising",
  providerOrigins,
}: {
  readonly browserSessionId: string;
  readonly initialConstraints?: PlanConstraints;
  readonly initialMood?: Mood;
  readonly providerOrigins: Record<Provider, string>;
}) {
  const router = useRouter();
  const storeRef = useRef<ReturnType<typeof createHubStore> | null>(null);
  if (!storeRef.current) storeRef.current = createHubStore();
  const state = useStore(storeRef.current, (value) => value);
  const candidateSession = useRef<CandidateSession | null>(null);
  const activeSearchId = useRef<number | null>(null);
  const nextSearchId = useRef(0);
  const boundProviders = useRef(new Map<Provider, BoundProvider>());
  const webMcpMode = useRef(false);
  const bundleHoldIdRef = useRef<string | null>(null);
  const actionControllerRef = useRef<ProductToolDependencies | null>(null);
  const [connectionMode, setConnectionMode] = useState<"manual" | "webmcp">(
    "manual",
  );
  const [clientReady, setClientReady] = useState(false);
  const [boundProviderCount, setBoundProviderCount] = useState(0);
  const [mood, setMood] = useState<Mood>(initialMood);
  const [constraints, setConstraints] =
    useState<PlanConstraints>(initialConstraints);
  const [projections, setProjections] = useState(initialProjection);
  const [activities, setActivities] = useState<ToolActivityItem[]>([]);
  const [receipt, setReceipt] = useState<ReceiptView | null>(null);
  const [recovery, setRecovery] = useState<RecoveryView | null>(null);
  const [compensationSeconds, setCompensationSeconds] = useState(0);
  const [leaveAfterRelease, setLeaveAfterRelease] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(COMPENSATION_BLOCK_KEY);
    if (stored && Number.isFinite(Date.parse(stored))) {
      if (Date.parse(stored) > Date.now()) {
        storeRef.current!.getState().dispatch({
          type: "COMPENSATION_BLOCK_RESTORED",
          blockedUntil: stored,
        });
      } else {
        sessionStorage.removeItem(COMPENSATION_BLOCK_KEY);
      }
    }
    setClientReady(true);
  }, []);

  useEffect(() => {
    const shouldWarn = [
      "held",
      "holding",
      "releasing",
      "confirming",
      "reconciling",
    ].includes(state.phase);
    if (!shouldWarn) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.phase]);

  useEffect(() => {
    if (
      leaveAfterRelease &&
      state.phase === "composed" &&
      state.requiresFreshSearch
    ) {
      setLeaveAfterRelease(false);
      router.push("/");
    }
  }, [leaveAfterRelease, router, state.phase, state.requiresFreshSearch]);

  useEffect(() => {
    const blockedUntil = state.compensationBlockedUntil;
    if (!blockedUntil) {
      setCompensationSeconds(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((Date.parse(blockedUntil) - Date.now()) / 1_000),
      );
      setCompensationSeconds(remaining);
      if (remaining === 0) {
        sessionStorage.removeItem(COMPENSATION_BLOCK_KEY);
        storeRef.current!.getState().dispatch({
          type: "COMPENSATION_BLOCK_ELAPSED",
        });
      }
    };
    tick();
    const interval = window.setInterval(tick, 1_000);
    return () => window.clearInterval(interval);
  }, [state.compensationBlockedUntil]);

  const setAllOperations = (operation: OperationLabel) => {
    setProjections(
      (current) =>
        Object.fromEntries(
          PROVIDERS.map((provider) => [
            provider,
            { ...current[provider], operation },
          ]),
        ) as Record<Provider, ProviderProjection>,
    );
  };

  const present = (
    action: "CONFIRM" | "HOLD" | "RELEASE" | "RESET" | "SEARCH",
    status:
      "AVAILABLE" | "CONFIRMED" | "ERROR" | "HELD" | "QUERYING" | "RELEASED",
    source: ToolActivityItem["transport"],
    expiresAt?: string,
  ) => {
    const correlationId = correlation();
    for (const provider of PROVIDERS) {
      const bound = boundProviders.current.get(provider);
      if (!bound) continue;
      bound.source.postMessage(
        createManualProviderStateMessage({
          action,
          browserSessionId,
          correlationId,
          ...(expiresAt ? { expiresAt } : {}),
          ready: bound,
          source,
          status,
        }),
        providerOrigins[provider],
      );
    }
  };

  useEffect(() => {
    webMcpMode.current = false;
    setConnectionMode("manual");
    setProjections(
      (current) =>
        Object.fromEntries(
          PROVIDERS.map((provider) => [
            provider,
            {
              ...current[provider],
              connection: "Manual connection",
            },
          ]),
        ) as Record<Provider, ProviderProjection>,
    );

    const onMessage = (event: MessageEvent<unknown>) => {
      const provider = PROVIDERS.find((candidate) => {
        const ready = readProviderReady(event.data, event.origin, {
          origin: providerOrigins[candidate],
          provider: candidate,
        });
        if (!ready || !event.source || !("postMessage" in event.source)) {
          return false;
        }
        const source = event.source as WindowProxy;
        boundProviders.current.set(candidate, { ...ready, source });
        setBoundProviderCount(boundProviders.current.size);
        source.postMessage(
          createManualBindMessage(ready, browserSessionId),
          providerOrigins[candidate],
        );
        return true;
      });
      if (!provider) return;
      setProjections((current) => ({
        ...current,
        [provider]: {
          ...current[provider],
          connection: webMcpMode.current ? "Live site" : "Manual connection",
          operation:
            current[provider].operation === "Unknown"
              ? "Ready"
              : current[provider].operation,
        },
      }));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [browserSessionId, providerOrigins]);

  const previousFocusState = useRef({
    phase: state.phase,
    receipt: false,
    recovery: false,
    selectedBundleId: state.selectedBundleId,
  });

  useEffect(() => {
    const previous = previousFocusState.current;
    const next = {
      phase: state.phase,
      receipt: receipt !== null,
      recovery: recovery !== null,
      selectedBundleId: state.selectedBundleId,
    };
    previousFocusState.current = next;

    const selectionChanged =
      state.phase === "composed" &&
      previous.selectedBundleId !== state.selectedBundleId;
    const selector =
      receipt !== null && (!previous.receipt || previous.phase !== state.phase)
        ? ".receipt"
        : recovery && (!previous.recovery || previous.phase !== state.phase)
          ? ".recovery"
          : state.phase === "idle" && previous.phase !== "idle"
            ? "#mood-heading"
            : state.phase === "composed" &&
                (previous.phase !== "composed" || selectionChanged)
              ? ".journey-summary"
              : state.phase === "held" && previous.phase !== "held"
                ? ".held-heading"
                : state.phase === "releasing" && previous.phase !== "releasing"
                  ? ".release-heading"
                  : state.phase === "no_results" &&
                      previous.phase !== "no_results"
                    ? ".empty-state"
                    : state.phase === "error" && previous.phase !== "error"
                      ? ".error-state"
                      : null;
    if (!selector) return;
    const frame = globalThis.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(selector);
      if (!target) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: "auto", block: "start" });
    });
    return () => globalThis.cancelAnimationFrame(frame);
  }, [receipt, recovery, state.phase, state.selectedBundleId]);

  const setActiveBundleHoldId = (value: string | null) => {
    bundleHoldIdRef.current = value;
  };

  const failureEnvelope = (
    error: PublicError,
    origin = window.location.origin,
  ): PublicEnvelope => createHubFailureEnvelope(error, { origin });

  const post = async (
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<PublicEnvelope> => {
    const response = await fetch(path, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
      ...(signal ? { signal } : {}),
    });
    return readEnvelope(response);
  };

  const get = async (
    path: string,
    signal?: AbortSignal,
  ): Promise<PublicEnvelope> => {
    const response = await fetch(path, {
      cache: "no-store",
      ...(signal ? { signal } : {}),
    });
    return readEnvelope(response);
  };

  const compensationDeadlineFor = (envelope: PublicEnvelope): string => {
    const completedAt = Date.parse(envelope.meta?.completedAt ?? "");
    const base = Number.isFinite(completedAt) ? completedAt : Date.now();
    return new Date(base + COMPENSATION_SAFETY_WINDOW_MS).toISOString();
  };

  const appendActivity = (
    envelope: PublicEnvelope,
    toolName: string,
    transport: ToolActivityItem["transport"],
    startedAt: number,
  ) => {
    setActivities((current) => [
      ...current.slice(-11),
      activityFor(envelope, toolName, envelope.ok ? "Complete" : "Failed", {
        durationMs: Math.max(0, Date.now() - startedAt),
        fallbackOrigin: window.location.origin,
        transport,
      }),
    ]);
  };

  const searchFailure = (
    code: "CANCELLED" | "VALIDATION_ERROR",
    message: string,
  ): PublicEnvelope =>
    failureEnvelope({
      code,
      message,
      retryable: code === "CANCELLED",
    });

  const hasV1EndTime = (intent: Intent): boolean => {
    const start = new Date(intent.startAt);
    const end = new Date(intent.endAt);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
      return false;
    }
    const selectedDate = tokyoServiceDate(start);
    const expectedEnd = new Date(`${selectedDate}T22:30:00+09:00`);
    return end.valueOf() === expectedEnd.valueOf();
  };

  const canStartSearch = (): boolean => {
    const current = storeRef.current!.getState();
    return (
      activeSearchId.current === null &&
      ["idle", "composed", "no_results", "error"].includes(current.phase) &&
      current.activeHolds.length === 0 &&
      !current.compensationIncomplete
    );
  };

  const search = async (
    intent: Intent,
    transport: ToolActivityItem["transport"],
    signal?: AbortSignal,
  ): Promise<PublicEnvelope> => {
    if (!hasV1EndTime(intent)) {
      return searchFailure(
        "VALIDATION_ERROR",
        "Serendipity v1 searches must end at 22:30 on the selected Tokyo date.",
      );
    }
    if (!canStartSearch()) {
      return searchFailure(
        "CANCELLED",
        "Finish the current operation before starting another search.",
      );
    }

    const searchId = ++nextSearchId.current;
    activeSearchId.current = searchId;
    const startedAt = Date.now();
    const dispatch = storeRef.current!.getState().dispatch;
    dispatch({ type: "DISCOVER" });
    candidateSession.current = null;
    setMood(moodForIntent(intent));
    setConstraints(constraintsForIntent(intent));
    setRecovery(null);
    setReceipt(null);
    setAllOperations("Checking");
    present("SEARCH", "QUERYING", transport);
    try {
      const envelope = await post("/api/manual/search", intent, signal);
      if (activeSearchId.current !== searchId) {
        return searchFailure(
          "CANCELLED",
          "A newer product state replaced this search.",
        );
      }
      appendActivity(
        envelope,
        transport === "site-tool"
          ? "find_serendipity_options"
          : "manual_search_three_providers",
        transport,
        startedAt,
      );
      if (!envelope.ok || !contractValidators.findOptionsData(envelope.data)) {
        if (envelope.error?.code === "NO_VALID_BUNDLE") {
          candidateSession.current = null;
          dispatch({
            type: "DISCOVER_SUCCEEDED",
            bundleSessionId: correlation(),
            candidates: [],
          });
          setAllOperations("Checked — no match");
          return envelope;
        }
        candidateSession.current = null;
        dispatch({
          type: "DISCOVER_FAILED",
          errorCode: envelope.error?.code ?? "INTERNAL_ERROR",
        });
        setAllOperations("Needs attention");
        present("SEARCH", "ERROR", transport);
        return envelope;
      }
      const data = envelope.data as FindOptionsData;
      const candidates = [data.selectedBundle, ...data.alternatives];
      candidateSession.current = {
        bundleSessionId: data.bundleSessionId,
        bundleVersion: data.bundleVersion,
        candidates,
        intent,
        selectedBundleId: data.selectedBundle.bundleId,
      };
      dispatch({
        type: "DISCOVER_SUCCEEDED",
        bundleSessionId: data.bundleSessionId,
        candidates,
      });
      setAllOperations("Found");
      present("SEARCH", "AVAILABLE", transport);
      return envelope;
    } catch (error) {
      if (activeSearchId.current !== searchId) {
        return searchFailure(
          "CANCELLED",
          "A newer product state replaced this search.",
        );
      }
      candidateSession.current = null;
      const code: ErrorCode =
        signal?.aborted ||
        (error instanceof Error && error.name === "AbortError")
          ? "CANCELLED"
          : "INTERNAL_ERROR";
      const envelope = failureEnvelope({
        code,
        message:
          code === "CANCELLED"
            ? "The search was cancelled."
            : "The Hub could not complete the search.",
        retryable: true,
      });
      appendActivity(
        envelope,
        transport === "site-tool"
          ? "find_serendipity_options"
          : "manual_search_three_providers",
        transport,
        startedAt,
      );
      dispatch({ type: "DISCOVER_FAILED", errorCode: code });
      setAllOperations("Needs attention");
      present("SEARCH", "ERROR", transport);
      return envelope;
    } finally {
      if (activeSearchId.current === searchId) activeSearchId.current = null;
    }
  };

  const select = (bundle: BundleSummary) => {
    storeRef.current!.getState().dispatch({
      type: "SELECT_BUNDLE",
      bundleId: bundle.bundleId,
      bundleVersion: bundle.bundleVersion,
    });
    if (candidateSession.current) {
      candidateSession.current = {
        ...candidateSession.current,
        selectedBundleId: bundle.bundleId,
      };
    }
    setRecovery(null);
  };

  const show = (input: ShowBundleInput): PublicEnvelope => {
    const startedAt = Date.now();
    const current = storeRef.current!.getState();
    const session = candidateSession.current;
    const sessionIsCurrent =
      current.phase === "composed" &&
      !current.requiresFreshSearch &&
      current.bundleSessionId === input.bundleSessionId &&
      session?.bundleSessionId === input.bundleSessionId;
    const selected = sessionIsCurrent
      ? session.candidates.find(
          (candidate) =>
            candidate.bundleId === input.bundleId &&
            candidate.bundleVersion === input.bundleVersion &&
            current.candidates.some(
              (visible) =>
                visible.bundleId === candidate.bundleId &&
                visible.bundleVersion === candidate.bundleVersion,
            ),
        )
      : undefined;
    const envelope =
      session?.bundleSessionId === input.bundleSessionId && selected
        ? createHubSuccessEnvelope<ShowBundleData>(
            {
              explanation: explainBundle(selected),
              selectedBundle: selected,
            },
            { origin: window.location.origin },
          )
        : failureEnvelope({
            code: session ? "STALE_BUNDLE" : "BUNDLE_NOT_FOUND",
            message: session
              ? "The selected route is stale or unknown."
              : "The candidate session was not found.",
            retryable: !session,
          });
    if (envelope.ok && selected) select(selected);
    appendActivity(envelope, "show_bundle", "site-tool", startedAt);
    return envelope;
  };

  const hold = async (
    input: HoldBundleInput,
    transport: ToolActivityItem["transport"],
    signal?: AbortSignal,
  ): Promise<PublicEnvelope> => {
    const startedAt = Date.now();
    const session = candidateSession.current;
    const current = storeRef.current!.getState();
    const selected = current.candidates.find(
      ({ bundleId }) => bundleId === input.bundleId,
    );
    if (
      !session ||
      !selected ||
      current.phase !== "composed" ||
      current.requiresFreshSearch ||
      current.bundleSessionId !== session.bundleSessionId ||
      session.bundleSessionId !== input.bundleSessionId ||
      selected.bundleVersion !== input.bundleVersion
    ) {
      return failureEnvelope({
        code: session ? "STALE_BUNDLE" : "BUNDLE_NOT_FOUND",
        message: session
          ? "Select a current route before holding."
          : "The candidate session was not found.",
        retryable: !session,
      });
    }
    current.dispatch({ type: "HOLD_STARTED" });
    if (storeRef.current!.getState().phase !== "holding") {
      return failureEnvelope({
        code: "CANCELLED",
        message: "Finish the current operation before holding this route.",
        retryable: true,
      });
    }
    setAllOperations("Holding");
    present("HOLD", "QUERYING", transport);
    try {
      const envelope = await post(
        "/api/manual/hold",
        {
          schemaVersion: SCHEMA_VERSION,
          bundleSessionId: session.bundleSessionId,
          bundleId: selected.bundleId,
          bundleVersion: selected.bundleVersion,
          bundleSession: session,
        },
        signal,
      );
      appendActivity(
        envelope,
        transport === "site-tool"
          ? "hold_bundle"
          : "manual_hold_three_providers",
        transport,
        startedAt,
      );
      if (!envelope.ok || !contractValidators.holdBundleData(envelope.data)) {
        const errorCode = envelope.error?.code ?? "INTERNAL_ERROR";
        const compensationBlockedUntil =
          errorCode === "COMPENSATION_INCOMPLETE"
            ? compensationDeadlineFor(envelope)
            : undefined;
        if (compensationBlockedUntil) {
          sessionStorage.setItem(
            COMPENSATION_BLOCK_KEY,
            compensationBlockedUntil,
          );
        }
        storeRef.current!.getState().dispatch({
          type: "HOLD_FAILED",
          errorCode,
          ...(compensationBlockedUntil ? { compensationBlockedUntil } : {}),
        });
        setAllOperations("Needs attention");
        present("HOLD", "ERROR", transport);
        return envelope;
      }
      const data = envelope.data as HoldBundleData;
      setActiveBundleHoldId(data.bundleHoldId);
      storeRef.current!.getState().dispatch({
        type: "HOLD_SUCCEEDED",
        expiresAt: data.expiresAt,
        holds: data.providerHolds.map((providerHold) => ({
          provider: providerHold.provider,
          safeReference: providerHold.holdSafeReference,
        })),
      });
      setAllOperations("Held");
      present("HOLD", "HELD", transport, data.expiresAt);
      return envelope;
    } catch (error) {
      const code: ErrorCode =
        signal?.aborted ||
        (error instanceof Error && error.name === "AbortError")
          ? "CANCELLED"
          : "INTERNAL_ERROR";
      const envelope = failureEnvelope({
        code,
        message:
          code === "CANCELLED"
            ? "The hold was cancelled."
            : "The Hub could not complete the hold.",
        retryable: true,
      });
      appendActivity(
        envelope,
        transport === "site-tool"
          ? "hold_bundle"
          : "manual_hold_three_providers",
        transport,
        startedAt,
      );
      storeRef.current!.getState().dispatch({
        type: "HOLD_FAILED",
        errorCode: code,
      });
      setAllOperations("Needs attention");
      present("HOLD", "ERROR", transport);
      return envelope;
    }
  };

  const confirm = async (
    input: ConfirmBundleInput,
    transport: ToolActivityItem["transport"],
    signal?: AbortSignal,
  ): Promise<PublicEnvelope> => {
    const startedAt = Date.now();
    const current = storeRef.current!.getState();
    if (
      !current.bundleSessionId ||
      !bundleHoldIdRef.current ||
      input.bundleSessionId !== current.bundleSessionId ||
      input.bundleHoldId !== bundleHoldIdRef.current
    ) {
      return failureEnvelope({
        code: "BUNDLE_NOT_FOUND",
        message: "The active bundle hold was not found.",
        retryable: false,
      });
    }
    current.dispatch({ type: "CONFIRM_STARTED" });
    if (storeRef.current!.getState().phase !== "confirming") {
      return failureEnvelope({
        code: "CANCELLED",
        message: "Finish the current operation before confirming this hold.",
        retryable: true,
      });
    }
    setAllOperations("Confirming");
    present("CONFIRM", "QUERYING", transport);
    try {
      const envelope = await post("/api/manual/confirm", input, signal);
      appendActivity(
        envelope,
        transport === "site-tool"
          ? "confirm_bundle"
          : "manual_confirm_three_providers",
        transport,
        startedAt,
      );
      if (
        !envelope.ok ||
        !contractValidators.confirmBundleData(envelope.data)
      ) {
        if (envelope.error?.code === "RECONCILIATION_REQUIRED") {
          storeRef.current!.getState().dispatch({ type: "CONFIRM_UNKNOWN" });
          setAllOperations("Unknown");
          return envelope;
        }
        storeRef.current!.getState().dispatch({ type: "CONFIRM_UNKNOWN" });
        storeRef.current!.getState().dispatch({
          type: "RECONCILIATION_FAILED",
          errorCode: envelope.error?.code ?? "INTERNAL_ERROR",
        });
        setAllOperations("Needs attention");
        present("CONFIRM", "ERROR", transport);
        return envelope;
      }
      const data = envelope.data as ConfirmBundleData;
      storeRef.current!.getState().dispatch({
        type: "CONFIRM_SUCCEEDED",
        reservations: data.reservations,
      });
      setReceipt({
        confirmedAt: data.confirmedAt,
        reservations: data.reservations,
      });
      setAllOperations("Confirmed");
      present("CONFIRM", "CONFIRMED", transport);
      setActiveBundleHoldId(null);
      return envelope;
    } catch (error) {
      const code: ErrorCode =
        signal?.aborted ||
        (error instanceof Error && error.name === "AbortError")
          ? "CANCELLED"
          : "RECONCILIATION_REQUIRED";
      const envelope = failureEnvelope({
        code,
        message:
          code === "CANCELLED"
            ? "The confirmation was cancelled."
            : "The confirmation result must be reconciled.",
        retryable: true,
      });
      appendActivity(
        envelope,
        transport === "site-tool"
          ? "confirm_bundle"
          : "manual_confirm_three_providers",
        transport,
        startedAt,
      );
      storeRef.current!.getState().dispatch({ type: "CONFIRM_UNKNOWN" });
      setAllOperations("Unknown");
      return envelope;
    }
  };

  const release = async (
    input: ReleaseBundleInput,
    transport: ToolActivityItem["transport"],
    signal?: AbortSignal,
  ): Promise<PublicEnvelope> => {
    const startedAt = Date.now();
    const current = storeRef.current!.getState();
    if (
      !current.bundleSessionId ||
      !bundleHoldIdRef.current ||
      input.bundleSessionId !== current.bundleSessionId ||
      input.bundleHoldId !== bundleHoldIdRef.current
    ) {
      return failureEnvelope({
        code: "BUNDLE_NOT_FOUND",
        message: "The active bundle hold was not found.",
        retryable: false,
      });
    }
    current.dispatch({ type: "RELEASE_STARTED" });
    if (storeRef.current!.getState().phase !== "releasing") {
      return failureEnvelope({
        code: "CANCELLED",
        message: "Finish the current operation before releasing this hold.",
        retryable: true,
      });
    }
    setAllOperations("Releasing");
    present("RELEASE", "QUERYING", transport);
    try {
      const envelope = await post("/api/manual/release", input, signal);
      appendActivity(
        envelope,
        transport === "site-tool"
          ? "release_bundle"
          : "manual_release_three_providers",
        transport,
        startedAt,
      );
      if (
        !envelope.ok ||
        !contractValidators.releaseBundleData(envelope.data)
      ) {
        const errorCode = envelope.error?.code ?? "INTERNAL_ERROR";
        storeRef.current!.getState().dispatch({
          type: "RELEASE_FAILED",
          errorCode,
          retryAvailable:
            Boolean(envelope.error?.retryable) ||
            RELEASE_RETRY_CODES.has(errorCode),
        });
        setAllOperations("Needs attention");
        present("RELEASE", "ERROR", transport);
        return envelope;
      }
      const data = envelope.data as ReleaseBundleData;
      storeRef.current!.getState().dispatch({ type: "RELEASE_COMPLETED" });
      setAllOperations("Released");
      present("RELEASE", "RELEASED", transport);
      setActiveBundleHoldId(null);
      void data;
      return envelope;
    } catch (error) {
      const code: ErrorCode =
        signal?.aborted ||
        (error instanceof Error && error.name === "AbortError")
          ? "CANCELLED"
          : "INTERNAL_ERROR";
      const envelope = failureEnvelope({
        code,
        message:
          code === "CANCELLED"
            ? "The release was cancelled."
            : "The Hub could not release the active hold.",
        retryable: true,
      });
      appendActivity(
        envelope,
        transport === "site-tool"
          ? "release_bundle"
          : "manual_release_three_providers",
        transport,
        startedAt,
      );
      storeRef.current!.getState().dispatch({
        type: "RELEASE_FAILED",
        errorCode: code,
        retryAvailable: true,
      });
      setAllOperations("Needs attention");
      present("RELEASE", "ERROR", transport);
      return envelope;
    }
  };

  const checkLatestStatus = async (
    transport: ToolActivityItem["transport"] = "manual",
    signal?: AbortSignal,
  ): Promise<PublicEnvelope> => {
    const startedAt = Date.now();
    const current = storeRef.current!.getState();
    if (!current.bundleSessionId || !bundleHoldIdRef.current) {
      return failureEnvelope({
        code: "BUNDLE_NOT_FOUND",
        message: "The active bundle hold was not found.",
        retryable: false,
      });
    }
    current.dispatch({ type: "RELEASE_STATUS_STARTED" });
    if (storeRef.current!.getState().phase !== "reconciling") {
      return failureEnvelope({
        code: "CANCELLED",
        message: "Provider status cannot be checked from the current state.",
        retryable: true,
      });
    }
    setAllOperations("Checking");
    try {
      const envelope = await get(
        `/api/bundle-sessions/${encodeURIComponent(current.bundleSessionId)}`,
        signal,
      );
      appendActivity(
        envelope,
        "manual_check_bundle_status",
        transport,
        startedAt,
      );
      if (!envelope.ok || !contractValidators.bundleReloadData(envelope.data)) {
        storeRef.current!.getState().dispatch({
          type: "RECONCILIATION_FAILED",
          errorCode: envelope.error?.code ?? "RECONCILIATION_REQUIRED",
        });
        setAllOperations("Needs attention");
        return envelope;
      }
      const data = envelope.data as BundleReloadData;
      if (
        data.bundleSessionId !== current.bundleSessionId ||
        data.bundleHoldId !== bundleHoldIdRef.current ||
        PROVIDERS.some(
          (provider) =>
            data.providerStates.filter((state) => state.provider === provider)
              .length !== 1,
        ) ||
        (data.phase === "held" &&
          data.providerStates.some((state) => state.status !== "HELD")) ||
        (data.phase === "confirmed" &&
          data.providerStates.some((state) => state.status !== "CONFIRMED")) ||
        (data.phase === "released" &&
          data.providerStates.some(
            (state) =>
              state.status !== "RELEASED" && state.status !== "EXPIRED",
          ))
      ) {
        storeRef.current!.getState().dispatch({
          type: "RECONCILIATION_FAILED",
          errorCode: "CONFIRMATION_INCONSISTENT",
        });
        setAllOperations("Needs attention");
        return failureEnvelope({
          code: "CONFIRMATION_INCONSISTENT",
          message: "The Provider status result did not match this hold.",
          retryable: false,
        });
      }
      if (data.phase === "released") {
        storeRef.current!.getState().dispatch({ type: "RELEASE_COMPLETED" });
        setAllOperations("Released");
        present("RELEASE", "RELEASED", transport);
        setActiveBundleHoldId(null);
        return envelope;
      }
      if (data.phase === "confirmed") {
        const reservations = data.providerStates.flatMap((providerState) =>
          providerState.reservationRef
            ? [
                {
                  provider: providerState.provider,
                  reservationRef: providerState.reservationRef,
                },
              ]
            : [],
        );
        if (reservations.length !== PROVIDERS.length) {
          storeRef.current!.getState().dispatch({
            type: "RECONCILIATION_FAILED",
            errorCode: "CONFIRMATION_INCONSISTENT",
          });
          setAllOperations("Needs attention");
          return failureEnvelope({
            code: "CONFIRMATION_INCONSISTENT",
            message: "The confirmed Provider references were incomplete.",
            retryable: false,
          });
        }
        storeRef.current!.getState().dispatch({
          type: "RECONCILIATION_CONFIRMED",
          reservations,
        });
        setReceipt({
          confirmedAt: envelope.meta?.completedAt ?? new Date().toISOString(),
          reservations,
        });
        setAllOperations("Confirmed");
        present("CONFIRM", "CONFIRMED", transport);
        setActiveBundleHoldId(null);
        return envelope;
      }
      storeRef.current!.getState().dispatch({ type: "RELEASE_STATUS_HELD" });
      setAllOperations("Held");
      if (data.expiresAt) present("HOLD", "HELD", transport, data.expiresAt);
      return envelope;
    } catch (error) {
      const code: ErrorCode =
        signal?.aborted ||
        (error instanceof Error && error.name === "AbortError")
          ? "CANCELLED"
          : "RECONCILIATION_REQUIRED";
      const envelope = failureEnvelope({
        code,
        message: "The latest Provider status could not be verified.",
        retryable: true,
      });
      appendActivity(
        envelope,
        "manual_check_bundle_status",
        transport,
        startedAt,
      );
      storeRef.current!.getState().dispatch({
        type: "RECONCILIATION_FAILED",
        errorCode: code,
      });
      setAllOperations("Needs attention");
      return envelope;
    }
  };

  const expire = () => {
    storeRef.current!.getState().dispatch({ type: "HOLD_EXPIRED" });
    setActiveBundleHoldId(null);
    setAllOperations("Unknown");
  };

  const reset = () => {
    activeSearchId.current = null;
    nextSearchId.current += 1;
    storeRef.current!.getState().dispatch({ type: "RESET" });
    if (storeRef.current!.getState().phase !== "idle") return;
    sessionStorage.removeItem(COMPENSATION_BLOCK_KEY);
    candidateSession.current = null;
    setActiveBundleHoldId(null);
    setReceipt(null);
    setRecovery(null);
    setActivities([]);
    setProjections(
      initialProjection(
        connectionMode === "webmcp" ? "Live site" : "Manual connection",
      ),
    );
    present("RESET", "AVAILABLE", "manual");
  };

  const stateFailure = (
    code: PublicError["code"],
    message: string,
    retryable = code === "BUNDLE_NOT_FOUND",
  ): { error: PublicError; ok: false } => ({
    error: { code, message, retryable },
    ok: false,
  });

  const checkProductToolState: NonNullable<
    ProductToolDependencies["checkState"]
  > = (name: ProductToolName, input: ProductToolInput) => {
    if (name === "find_serendipity_options") {
      const intent = input as Intent;
      if (!hasV1EndTime(intent)) {
        return stateFailure(
          "VALIDATION_ERROR",
          "Serendipity v1 searches must end at 22:30 on the selected Tokyo date.",
          false,
        );
      }
      return canStartSearch()
        ? { ok: true }
        : stateFailure(
            "CANCELLED",
            "Finish the current operation before starting another search.",
            true,
          );
    }
    const current = storeRef.current!.getState();
    const session = candidateSession.current;
    if (name === "show_bundle" || name === "hold_bundle") {
      const selection = input as {
        bundleId: string;
        bundleSessionId: string;
        bundleVersion: number;
      };
      if (
        !session ||
        current.bundleSessionId !== session.bundleSessionId ||
        session.bundleSessionId !== selection.bundleSessionId
      ) {
        return stateFailure(
          "BUNDLE_NOT_FOUND",
          "The current candidate session was not found.",
        );
      }
      const candidate = session.candidates.find(
        ({ bundleId, bundleVersion }) =>
          bundleId === selection.bundleId &&
          bundleVersion === selection.bundleVersion,
      );
      const visibleCandidate = current.candidates.find(
        ({ bundleId, bundleVersion }) =>
          bundleId === selection.bundleId &&
          bundleVersion === selection.bundleVersion,
      );
      if (
        !candidate ||
        !visibleCandidate ||
        current.phase !== "composed" ||
        current.requiresFreshSearch
      ) {
        return stateFailure(
          "STALE_BUNDLE",
          "Select a current route before continuing.",
        );
      }
      return { ok: true };
    }
    const mutation = input as ConfirmBundleInput | ReleaseBundleInput;
    const validPhase =
      name === "confirm_bundle"
        ? current.phase === "held"
        : current.phase === "held" ||
          (current.phase === "error" && current.releaseRetryAvailable);
    if (
      !validPhase ||
      !current.bundleSessionId ||
      !bundleHoldIdRef.current ||
      mutation.bundleSessionId !== current.bundleSessionId ||
      mutation.bundleHoldId !== bundleHoldIdRef.current
    ) {
      return stateFailure(
        "BUNDLE_NOT_FOUND",
        "The active bundle hold was not found.",
      );
    }
    return { ok: true };
  };

  actionControllerRef.current = {
    checkState: checkProductToolState,
    confirmBundle: (input, signal) => confirm(input, "site-tool", signal),
    findOptions: (input, signal) => search(input, "site-tool", signal),
    holdBundle: (input, signal) => hold(input, "site-tool", signal),
    hubOrigin: process.env.NEXT_PUBLIC_HUB_ORIGIN ?? "http://localhost:3100",
    releaseBundle: (input, signal) => release(input, "site-tool", signal),
    showBundle: (input) => show(input),
  };

  useEffect(() => {
    if (!isWebMcpAvailable(document)) return;
    let active = true;
    let registration: ReturnType<typeof registerProductTools> | undefined;
    const fallbackToManual = () => {
      webMcpMode.current = false;
      setConnectionMode("manual");
      setProjections(
        (current) =>
          Object.fromEntries(
            PROVIDERS.map((provider) => [
              provider,
              { ...current[provider], connection: "Manual connection" },
            ]),
          ) as Record<Provider, ProviderProjection>,
      );
    };
    const delegated: ProductToolDependencies = {
      checkState: (name, input) =>
        actionControllerRef.current!.checkState!(name, input),
      confirmBundle: (input, signal) =>
        actionControllerRef.current!.confirmBundle(input, signal),
      findOptions: (input, signal) =>
        actionControllerRef.current!.findOptions(input, signal),
      holdBundle: (input, signal) =>
        actionControllerRef.current!.holdBundle(input, signal),
      hubOrigin: window.location.origin,
      releaseBundle: (input, signal) =>
        actionControllerRef.current!.releaseBundle(input, signal),
      showBundle: (input, signal) =>
        actionControllerRef.current!.showBundle(input, signal),
    };
    try {
      registration = registerProductTools(delegated, document);
      void registration.ready
        .then(() => {
          if (!active) return;
          webMcpMode.current = true;
          setConnectionMode("webmcp");
          setProjections(
            (current) =>
              Object.fromEntries(
                PROVIDERS.map((provider) => [
                  provider,
                  {
                    ...current[provider],
                    connection: boundProviders.current.has(provider)
                      ? "Live site"
                      : "Connecting",
                    operation: boundProviders.current.has(provider)
                      ? current[provider].operation
                      : "Unknown",
                  },
                ]),
              ) as Record<Provider, ProviderProjection>,
          );
        })
        .catch((error: unknown) => {
          if (!active) return;
          const normalized = normalizeWebMcpError(error);
          console.warn(
            `Product Site Tool registration unavailable: ${normalized.code} · ${normalized.message}`,
          );
          fallbackToManual();
        });
    } catch (error) {
      const normalized = normalizeWebMcpError(error);
      console.warn(
        `Product Site Tool registration unavailable: ${normalized.code} · ${normalized.message}`,
      );
      fallbackToManual();
    }
    return () => {
      active = false;
      registration?.dispose();
    };
  }, [browserSessionId, providerOrigins]);

  const manualHold = () => {
    const current = storeRef.current!.getState();
    const session = candidateSession.current;
    const selected = current.candidates.find(
      ({ bundleId }) => bundleId === current.selectedBundleId,
    );
    if (!session || !selected) return;
    void hold(
      {
        bundleId: selected.bundleId,
        bundleSessionId: session.bundleSessionId,
        bundleVersion: selected.bundleVersion,
        schemaVersion: SCHEMA_VERSION,
      },
      "manual",
    );
  };

  const manualConfirm = () => {
    const current = storeRef.current!.getState();
    if (!current.bundleSessionId || !bundleHoldIdRef.current) return;
    void confirm(
      {
        bundleHoldId: bundleHoldIdRef.current,
        bundleSessionId: current.bundleSessionId,
        schemaVersion: SCHEMA_VERSION,
      },
      "manual",
    );
  };

  const manualRelease = () => {
    const current = storeRef.current!.getState();
    if (!current.bundleSessionId || !bundleHoldIdRef.current) return;
    void release(
      {
        bundleHoldId: bundleHoldIdRef.current,
        bundleSessionId: current.bundleSessionId,
        reason: "USER_CANCELLED",
        schemaVersion: SCHEMA_VERSION,
      },
      "manual",
    );
  };

  const selected =
    state.candidates.find(
      ({ bundleId }) => bundleId === state.selectedBundleId,
    ) ?? null;
  const alternatives = state.candidates.filter(
    ({ bundleId }) => bundleId !== state.selectedBundleId,
  );
  const ui = deriveHubUi(state);

  return (
    <ProductView
      activities={activities}
      alternatives={alternatives}
      browserSessionId={browserSessionId}
      boundProviderCount={boundProviderCount}
      candidateOrder={state.candidates.map(({ bundleId }) => bundleId)}
      clientReady={clientReady}
      connectionMode={connectionMode}
      compensationBlockedUntil={state.compensationBlockedUntil}
      compensationSeconds={compensationSeconds}
      constraints={constraints}
      errorCode={state.errorCode}
      expiresAt={state.expiresAt}
      mood={mood}
      onBudget={(totalBudgetYen) =>
        setConstraints((current) => ({ ...current, totalBudgetYen }))
      }
      onCheckStatus={() => void checkLatestStatus("manual")}
      onConfirm={manualConfirm}
      onExpired={expire}
      onHold={manualHold}
      onMood={setMood}
      onPlan={() => void search(intentFor(mood, constraints), "manual")}
      onRelease={manualRelease}
      onReleaseAndLeave={() => {
        setLeaveAfterRelease(true);
        manualRelease();
      }}
      onReset={reset}
      onRetryRelease={manualRelease}
      onSelect={select}
      onStartTime={(startTime) =>
        setConstraints((current) => ({ ...current, startTime }))
      }
      origins={providerOrigins}
      phase={state.phase}
      projections={projections}
      receipt={receipt}
      recovery={recovery}
      recoveryAction={
        ui.primaryAction === "retry-release" ||
        ui.primaryAction === "check-status"
          ? ui.primaryAction
          : null
      }
      requiresFreshSearch={state.requiresFreshSearch}
      selected={selected}
    />
  );
}
