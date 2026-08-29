import type {
  BundleSummary,
  ErrorCode,
  Provider,
} from "@serendipity/contracts";

export type ConnectionLabel =
  "Connecting" | "Live site" | "Manual connection" | "Unavailable";

export type Mood = "Surprising" | "Cozy" | "Hands-on" | "Late";
export const MOOD_PRESETS = ["Surprising", "Cozy", "Hands-on", "Late"] as const;

export type PlanConstraints = {
  startTime: string;
  totalBudgetYen: number;
};

export const START_TIME_PRESETS = ["18:00", "18:30", "19:00"] as const;
export const BUDGET_PRESETS_YEN = [4500, 5000, 6000] as const;

export const DEFAULT_PLAN_CONSTRAINTS: PlanConstraints = {
  startTime: "18:00",
  totalBudgetYen: 5000,
};

export type OperationLabel =
  | "Ready"
  | "Checking"
  | "Found"
  | "Checked — no match"
  | "Holding"
  | "Held"
  | "Confirming"
  | "Confirmed"
  | "Releasing"
  | "Released"
  | "Needs attention"
  | "Unknown";

export type ProviderProjection = {
  connection: ConnectionLabel;
  operation: OperationLabel;
};

export type ToolActivityItem = {
  completedAt: string;
  correlationId: string;
  durationMs?: number;
  errorCode?: ErrorCode;
  origin?: string;
  provider?: Provider;
  status: "Complete" | "Failed" | "Started" | "Unknown";
  toolName: string;
  transport: "manual" | "site-tool";
};

export type RecoveryView = {
  failedProvider: Provider;
  replacement: BundleSummary | null;
};

export type ReceiptView = {
  confirmedAt: string;
  reservations: Array<{ provider: Provider; reservationRef: string }>;
};
