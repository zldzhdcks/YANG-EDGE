/**
 * KBO Unified Operational State — shared status vocabulary.
 */

export type KboOperationalStatus =
  | "READY"
  | "READY_ADMIN_VERIFIED"
  | "PARTIAL"
  | "NOT_ENTERED"
  | "NOT_CREATED"
  | "NOT_READY"
  | "NOT_APPLICABLE"
  | "NOT_AVAILABLE"
  | "NOT_COLLECTED"
  | "BLOCKED"
  | "ERROR"
  | "PARTIAL_READY"
  | "WAITING_FOR_LINEUP"
  | "WAITING_FOR_PREDICTION"
  | "UNKNOWN";

export type KboOperationalErrorCode =
  | "MALFORMED_JSON"
  | "SCHEMA_INVALID"
  | "HASH_MISMATCH"
  | "PERMISSION_ERROR"
  | "IDENTITY_MISMATCH"
  | "READ_ERROR"
  | "SCHEDULE_MISSING";

export type KboOperationalWaitingCode =
  | "PREDICTION_NOT_CREATED"
  | "REVIEW_NOT_READY"
  | "STARTER_NOT_ENTERED"
  | "LINEUP_NOT_ENTERED"
  | "T45_NOT_RUN"
  | "T30_NOT_LOCKED"
  | "DOMESTIC_PROTO_SNAPSHOT_NOT_GENERATED"
  | "OPERATOR_PROTO_AVAILABLE"
  | "OVERSEAS_ODDS_NOT_COLLECTED"
  | "KBO_PREDICTION_PIPELINE_NOT_IMPLEMENTED";

export type KboArtifactSourceType =
  | "SCHEDULE_V1"
  | "SCHEDULE_IDENTITY_LEGACY"
  | "PERSONNEL_SNAPSHOT"
  | "PERSONNEL_INPUT"
  | "STARTER_CONFIRMATION_LEGACY"
  | "LINEUP_CONFIRMATION_LEGACY"
  | "DOMESTIC_PROTO_SNAPSHOT"
  | "ODDS_HISTORY"
  | "ODDS_COMPARISON_LEGACY"
  | "PREDICTION"
  | "REVIEW"
  | "NONE";

export type KboOperationalComponentState = {
  status: KboOperationalStatus;
  reason: string;
  score: number;
  maxScore: number;
  applicable: boolean;
  sourceType: KboArtifactSourceType;
  sourcePath: string | null;
  detail?: string | null;
  entered?: number | null;
  required?: number | null;
  values?: Record<string, unknown>;
};

export type KboOperationalGameState = {
  dateKst: string;
  gameId: string;
  homeTeam: string | null;
  awayTeam: string | null;
  scheduledStartTime: string | null;
  operatingStatus:
    | "ACTIVE_PREGAME"
    | "CANCELLED"
    | "POSTPONED"
    | "STARTED"
    | "FINAL"
    | "UNKNOWN";
  activeRequirement: boolean;
  schedule: KboOperationalComponentState;
  domesticOdds: KboOperationalComponentState;
  overseasOdds: KboOperationalComponentState;
  starter: KboOperationalComponentState;
  lineup: KboOperationalComponentState;
  prediction: KboOperationalComponentState;
  review: KboOperationalComponentState;
  readinessPercent: number;
  overallStatus: KboOperationalStatus;
  blockingReasons: string[];
  waitingReasons: string[];
  warnings: string[];
  hardErrors: { code: KboOperationalErrorCode; message: string; path: string }[];
  sources: {
    name: string;
    path: string;
    sourceType: KboArtifactSourceType;
    status: string;
  }[];
};

export type KboOperationalDayState = {
  dateKst: string;
  games: KboOperationalGameState[];
  schedule: {
    status: KboOperationalStatus;
    totalGames: number;
    activeGames: number;
    cancelledGames: number;
    postponedGames: number;
    sourcePath: string | null;
    reason: string;
  };
  aggregates: {
    protoEntered: number;
    protoRequired: number;
    starterEntered: number;
    starterRequired: number;
    lineupEntered: number;
    lineupRequired: number;
    predictionCreated: boolean;
  };
  overallStatus: KboOperationalStatus;
  hardErrors: { code: KboOperationalErrorCode; message: string; path: string }[];
  waitingReasons: string[];
  tasks: {
    taskId: string;
    title: string;
    description: string;
    priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
    category: "DONE" | "TODO";
    source: string;
    recommendedCommand: string | null;
  }[];
  assistantBrief: string;
  summaryLines: string[];
  sourceArtifacts: {
    name: string;
    path: string;
    status: string;
    displayStatus: string;
  }[];
};

export function isReadyStatus(s: KboOperationalStatus): boolean {
  return s === "READY" || s === "READY_ADMIN_VERIFIED";
}

export function component(
  partial: Omit<KboOperationalComponentState, "score" | "maxScore"> & {
    score?: number;
    maxScore?: number;
  },
): KboOperationalComponentState {
  const maxScore = partial.maxScore ?? 20;
  const applicable = partial.applicable;
  let score = partial.score ?? 0;
  if (!applicable) {
    score = 0;
  } else if (partial.score == null) {
    score = isReadyStatus(partial.status) ? maxScore : 0;
  }
  return {
    status: partial.status,
    reason: partial.reason,
    score,
    maxScore: applicable ? maxScore : 0,
    applicable,
    sourceType: partial.sourceType,
    sourcePath: partial.sourcePath,
    detail: partial.detail ?? null,
    entered: partial.entered ?? null,
    required: partial.required ?? null,
    values: partial.values,
  };
}
