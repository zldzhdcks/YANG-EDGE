/**
 * Research Lab KBO ops-state — thin adapter over Unified Operational Day State.
 * @deprecated Direct file reads removed; use @/lib/kbo/operational-state.
 */
import { loadKboOperationalDayState } from "@/lib/kbo/operational-state";
import type { KboOperationalStatus } from "@/lib/kbo/operational-state";

export type HardLoadErrorCode =
  | "MALFORMED_JSON"
  | "READ_PERMISSION_ERROR"
  | "SCHEMA_INVALID"
  | "IDENTITY_MISMATCH"
  | "READ_ERROR";

export type WaitingStateCode =
  | "PREDICTION_NOT_CREATED"
  | "REVIEW_NOT_READY"
  | "STARTER_NOT_ENTERED"
  | "LINEUP_NOT_ENTERED"
  | "T45_NOT_RUN"
  | "T30_NOT_LOCKED"
  | "DOMESTIC_PROTO_SNAPSHOT_NOT_GENERATED"
  | "OPERATOR_PROTO_AVAILABLE"
  | "KBO_PREDICTION_PIPELINE_NOT_IMPLEMENTED";

export type ReadyStateCode =
  | "SCHEDULE_READY"
  | "DOMESTIC_PROTO_ADMIN_VERIFIED"
  | "CANCELLED_NOT_APPLICABLE"
  | "STARTER_ENTERED"
  | "LINEUP_ENTERED"
  | "T45_READY";

export type ComponentDisplayStatus =
  | "READY"
  | "READY_ADMIN_VERIFIED"
  | "NOT_ENTERED"
  | "NOT_CREATED"
  | "NOT_READY"
  | "NOT_APPLICABLE"
  | "MISSING"
  | "PARTIAL"
  | "UNKNOWN"
  | "WAITING_FOR_LINEUP"
  | "PARTIAL_READY"
  | "BLOCKED"
  | "WAITING_FOR_PREDICTION"
  | "NOT_AVAILABLE"
  | "NOT_COLLECTED"
  | "ERROR";

export type KboOpsTask = {
  taskId: string;
  title: string;
  description: string;
  priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
  status: "OPEN" | "DONE";
  category: "DONE" | "TODO";
  source: string;
  recommendedCommand: string | null;
  generatedAt: string;
};

export type KboOpsSourceArtifact = {
  name: string;
  path: string;
  status: string;
  displayStatus: string;
};

export type KboResearchLabOpsState = {
  dateKst: string;
  schedule: {
    status: ComponentDisplayStatus;
    totalGames: number;
    activeGames: number;
    cancelledGames: number;
    postponedGames: number;
    sourcePath: string | null;
    reason: string;
  };
  domesticProto: {
    status: ComponentDisplayStatus;
    entered: number;
    required: number;
    cancelledNotApplicable: number;
    source: "SNAPSHOT" | "OPERATOR_INPUT" | "NONE";
    sourcePath: string | null;
    reason: string;
    commercialUseStatus: string | null;
    confirmationMethod: string | null;
    snapshotGenerated: boolean;
  };
  overseasOdds: {
    status: ComponentDisplayStatus;
    entered: number | null;
    required: number | null;
    sourcePath: string | null;
    reason: string;
  };
  starter: {
    status: ComponentDisplayStatus;
    entered: number;
    required: number;
    source: "PERSONNEL_SNAPSHOT" | "OPERATOR_INPUT" | "STARTER_CONFIRMATION" | "NONE";
    sourcePath: string | null;
    reason: string;
  };
  lineup: {
    status: ComponentDisplayStatus;
    entered: number;
    required: number;
    source: "PERSONNEL_SNAPSHOT" | "OPERATOR_INPUT" | "LINEUP_CONFIRMATION" | "NONE";
    sourcePath: string | null;
    reason: string;
  };
  bullpen: {
    status: ComponentDisplayStatus;
    reason: string;
  };
  prediction: {
    status: ComponentDisplayStatus;
    reason: string;
    sourcePath: string | null;
  };
  review: {
    status: ComponentDisplayStatus;
    reason: string;
  };
  t45: {
    status: ComponentDisplayStatus;
    reason: string;
  };
  overallStatus: ComponentDisplayStatus;
  hardErrors: { code: HardLoadErrorCode; message: string; path: string }[];
  waitingStates: { code: WaitingStateCode | string; message: string }[];
  readyStates: { code: ReadyStateCode | string; message: string }[];
  tasks: KboOpsTask[];
  sourceArtifacts: KboOpsSourceArtifact[];
  lockReasons: string[];
  summaryLines: string[];
  assistantBrief: string;
};

function asDisplay(s: KboOperationalStatus): ComponentDisplayStatus {
  return s as ComponentDisplayStatus;
}

function mapSource(
  t: string,
): "SNAPSHOT" | "OPERATOR_INPUT" | "NONE" {
  if (t.includes("SNAPSHOT") && !t.includes("CONFIRMATION")) return "SNAPSHOT";
  if (t === "PERSONNEL_INPUT" || t.includes("OPERATOR")) return "OPERATOR_INPUT";
  return "NONE";
}

function mapStarterSource(
  t: string,
): "PERSONNEL_SNAPSHOT" | "OPERATOR_INPUT" | "STARTER_CONFIRMATION" | "NONE" {
  if (t === "PERSONNEL_SNAPSHOT") return "PERSONNEL_SNAPSHOT";
  if (t === "STARTER_CONFIRMATION_LEGACY") return "STARTER_CONFIRMATION";
  if (t === "PERSONNEL_INPUT") return "OPERATOR_INPUT";
  return "NONE";
}

function mapLineupSource(
  t: string,
): "PERSONNEL_SNAPSHOT" | "OPERATOR_INPUT" | "LINEUP_CONFIRMATION" | "NONE" {
  if (t === "PERSONNEL_SNAPSHOT") return "PERSONNEL_SNAPSHOT";
  if (t === "LINEUP_CONFIRMATION_LEGACY") return "LINEUP_CONFIRMATION";
  if (t === "PERSONNEL_INPUT") return "OPERATOR_INPUT";
  return "NONE";
}

export async function loadKboResearchLabOpsState(
  dateKst: string,
  cwd = process.cwd(),
): Promise<KboResearchLabOpsState> {
  const day = await loadKboOperationalDayState(dateKst, cwd);
  const now = new Date().toISOString();
  const active = day.games.filter((g) => g.activeRequirement);

  const protoGame = active.find((g) =>
    ["READY", "READY_ADMIN_VERIFIED"].includes(g.domesticOdds.status),
  );
  const starterGame = active.find((g) =>
    ["READY", "READY_ADMIN_VERIFIED"].includes(g.starter.status),
  );
  const lineupGame = active.find((g) =>
    ["READY", "READY_ADMIN_VERIFIED"].includes(g.lineup.status),
  );

  const overseasEntered = active.filter((g) => g.overseasOdds.status === "READY")
    .length;
  const overseasStatus =
    overseasEntered > 0
      ? overseasEntered >= active.length
        ? "READY"
        : "PARTIAL"
      : active[0]?.overseasOdds.status ?? "NOT_AVAILABLE";

  const lockReasons = [...new Set(day.games.flatMap((g) => [
    ...g.blockingReasons,
    ...g.waitingReasons,
  ]))];

  const readyStates: KboResearchLabOpsState["readyStates"] = [];
  if (day.schedule.status === "READY") {
    readyStates.push({
      code: "SCHEDULE_READY",
      message: `Schedule ${day.schedule.totalGames}경기`,
    });
  }
  if (day.schedule.cancelledGames > 0) {
    readyStates.push({
      code: "CANCELLED_NOT_APPLICABLE",
      message: `취소 ${day.schedule.cancelledGames}경기 NOT_APPLICABLE`,
    });
  }
  if (
    day.aggregates.protoEntered === day.aggregates.protoRequired &&
    day.aggregates.protoRequired > 0
  ) {
    readyStates.push({
      code: "DOMESTIC_PROTO_ADMIN_VERIFIED",
      message: `Domestic Proto ${day.aggregates.protoEntered}/${day.aggregates.protoRequired}`,
    });
  }
  if (
    day.aggregates.starterEntered === day.aggregates.starterRequired &&
    day.aggregates.starterRequired > 0
  ) {
    readyStates.push({
      code: "STARTER_ENTERED",
      message: `Starter ${day.aggregates.starterEntered}/${day.aggregates.starterRequired}`,
    });
  }
  if (
    day.aggregates.lineupEntered === day.aggregates.lineupRequired &&
    day.aggregates.lineupRequired > 0
  ) {
    readyStates.push({
      code: "LINEUP_ENTERED",
      message: `Lineup ${day.aggregates.lineupEntered}/${day.aggregates.lineupRequired}`,
    });
  }

  const waitingStates = day.waitingReasons.map((message) => ({
    code: message,
    message,
  }));

  const t45Status: ComponentDisplayStatus =
    day.aggregates.lineupEntered === day.aggregates.lineupRequired &&
    day.aggregates.starterEntered === day.aggregates.starterRequired
      ? "READY"
      : day.overallStatus === "WAITING_FOR_LINEUP"
        ? "PARTIAL_READY"
        : "PARTIAL_READY";

  return {
    dateKst,
    schedule: {
      status: asDisplay(day.schedule.status),
      totalGames: day.schedule.totalGames,
      activeGames: day.schedule.activeGames,
      cancelledGames: day.schedule.cancelledGames,
      postponedGames: day.schedule.postponedGames,
      sourcePath: day.schedule.sourcePath,
      reason: day.schedule.reason,
    },
    domesticProto: {
      status: asDisplay(
        day.aggregates.protoEntered >= day.aggregates.protoRequired &&
          day.aggregates.protoRequired > 0
          ? protoGame?.domesticOdds.status === "READY"
            ? "READY"
            : "READY_ADMIN_VERIFIED"
          : day.aggregates.protoEntered > 0
            ? "PARTIAL"
            : "NOT_ENTERED",
      ),
      entered: day.aggregates.protoEntered,
      required: day.aggregates.protoRequired,
      cancelledNotApplicable: day.schedule.cancelledGames,
      source: mapSource(protoGame?.domesticOdds.sourceType ?? "NONE"),
      sourcePath: protoGame?.domesticOdds.sourcePath ?? null,
      reason: protoGame?.domesticOdds.reason ?? "DOMESTIC_PROTO_NOT_ENTERED",
      commercialUseStatus: "INTERNAL_ONLY",
      confirmationMethod: "ADMIN_VERIFIED",
      snapshotGenerated: protoGame?.domesticOdds.sourceType === "DOMESTIC_PROTO_SNAPSHOT",
    },
    overseasOdds: {
      status: asDisplay(overseasStatus as KboOperationalStatus),
      entered: overseasEntered,
      required: active.length,
      sourcePath: active[0]?.overseasOdds.sourcePath ?? null,
      reason: active[0]?.overseasOdds.reason ?? "OVERSEAS_ODDS_NOT_COLLECTED",
    },
    starter: {
      status: asDisplay(
        day.aggregates.starterEntered >= day.aggregates.starterRequired &&
          day.aggregates.starterRequired > 0
          ? starterGame?.starter.status ?? "READY"
          : day.aggregates.starterEntered > 0
            ? "PARTIAL"
            : "NOT_ENTERED",
      ),
      entered: day.aggregates.starterEntered,
      required: day.aggregates.starterRequired,
      source: mapStarterSource(starterGame?.starter.sourceType ?? "NONE"),
      sourcePath: starterGame?.starter.sourcePath ?? null,
      reason: starterGame?.starter.reason ?? "STARTER_NOT_ENTERED",
    },
    lineup: {
      status: asDisplay(
        day.aggregates.lineupEntered >= day.aggregates.lineupRequired &&
          day.aggregates.lineupRequired > 0
          ? lineupGame?.lineup.status ?? "READY"
          : day.aggregates.lineupEntered > 0
            ? "PARTIAL"
            : "NOT_ENTERED",
      ),
      entered: day.aggregates.lineupEntered,
      required: day.aggregates.lineupRequired,
      source: mapLineupSource(lineupGame?.lineup.sourceType ?? "NONE"),
      sourcePath: lineupGame?.lineup.sourcePath ?? null,
      reason: lineupGame?.lineup.reason ?? "LINEUP_NOT_ENTERED",
    },
    bullpen: { status: "MISSING", reason: "BULLPEN_NOT_CREATED" },
    prediction: {
      status: day.aggregates.predictionCreated ? "READY" : "NOT_CREATED",
      reason: day.aggregates.predictionCreated
        ? "PREDICTION_PRESENT"
        : "PREDICTION_NOT_CREATED",
      sourcePath: day.games[0]?.prediction.sourcePath ?? null,
    },
    review: {
      status: "NOT_READY",
      reason: "WAITING_FOR_POSTGAME",
    },
    t45: {
      status: t45Status,
      reason: `T45 ${t45Status}`,
    },
    overallStatus: asDisplay(day.overallStatus),
    hardErrors: day.hardErrors.map((e) => ({
      code: (e.code === "PERMISSION_ERROR"
        ? "READ_PERMISSION_ERROR"
        : e.code === "SCHEDULE_MISSING"
          ? "SCHEMA_INVALID"
          : e.code) as HardLoadErrorCode,
      message: e.message,
      path: e.path,
    })),
    waitingStates,
    readyStates,
    tasks: day.tasks.map((t) => ({
      ...t,
      status: t.category === "DONE" ? ("DONE" as const) : ("OPEN" as const),
      generatedAt: now,
    })),
    sourceArtifacts: day.sourceArtifacts,
    lockReasons,
    summaryLines: day.summaryLines,
    assistantBrief: day.assistantBrief,
  };
}

export function formatOpsStatusLabel(status: string): string {
  switch (status) {
    case "FILE_NOT_FOUND":
      return "아직 생성되지 않음";
    case "MISSING":
      return "미입력";
    case "UNKNOWN":
      return "확인 필요";
    case "BLOCKED":
      return "준비 중";
    case "NOT_ENTERED":
      return "미입력";
    case "NOT_CREATED":
      return "아직 생성되지 않음";
    case "NOT_READY":
      return "대기";
    case "NOT_APPLICABLE":
      return "해당 없음";
    case "READY_ADMIN_VERIFIED":
      return "관리자 확인 완료";
    case "WAITING_FOR_LINEUP":
      return "라인업 대기";
    case "WAITING_FOR_PREDICTION":
      return "예측 대기";
    case "PARTIAL_READY":
      return "부분 준비";
    case "PREDICTION_NOT_CREATED":
      return "예측 미생성";
    default:
      return status;
  }
}
