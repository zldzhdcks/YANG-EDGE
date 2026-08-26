/**
 * YANG EDGE OS presentation layer.
 * Maps existing Research Lab DTOs → operator-first UX copy.
 * No engine / dataset / hash / pipeline mutation.
 */
import type { ResearchLabData, PipelineStatus } from "./research-lab-reader";
import type { OperatorPresentation } from "./research-lab-presenter";
import { buildAssistantBrief } from "./edge-assistant-presenter";
import { buildFootballIdentityOperationSlice } from "@/lib/football/foundation";
import { buildDefaultFootballOddsView } from "@/lib/football/odds-foundation-v0";
import { buildDefaultFootballResultView } from "@/lib/football/result-foundation-v0";
import { buildDefaultFootballReviewScorecardView } from "@/lib/football/review-scorecard-foundation-v0";
import { koreanStatusLabel } from "@/lib/internal/korean-status-display";
import type { PredictionContinuityAssessment } from "@/lib/mlb/prediction-continuity-guard-v1";
import type {
  MlbDailyOpsDayAssessment,
  MlbDailyOpsLifecycleStatus,
} from "@/lib/mlb/daily-ops-v1";

export type OsLevel = "READY" | "WARNING" | "BLOCKED" | "OFF";

export type OsPredictionContinuityCard = {
  status: string;
  snapshotExists: boolean;
  generatedAt: string | null;
  createdBeforeFirstStart: boolean | null;
  predictionHashSha256: string | null;
  opsFailure: boolean;
  plainLanguage: string;
};

export type OsMlbDailyOpsCard = {
  lifecycle: MlbDailyOpsLifecycleStatus;
  schedule: string;
  starter: string;
  odds: string;
  lineup: string;
  prediction: string;
  recommendationRecord: string;
  predictionHashShort: string | null;
  goodPickCount: number;
  strongPickCount: number;
  researchReadyPercent: number | null;
  nextAction: string;
  recentDays: Array<{
    dateKst: string;
    lifecycle: MlbDailyOpsLifecycleStatus;
    line: string;
  }>;
};

export type OsLeagueStatus = {
  league: string;
  level: OsLevel;
  label: string;
  detail: string;
};

export type OsChecklistItem = {
  id: string;
  title: string;
  done: boolean;
  level: OsLevel;
  href: string | null;
};

export type OsMissionItem = {
  id: string;
  title: string;
  priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
  estimatedMinutes: number;
  risk: OsLevel;
  blockedReason: string | null;
  nextStep: string;
  aiTip: string;
  href: string | null;
};

export type OsEngineVar = {
  id: string;
  name: string;
  status: "ACTIVE" | "COLLECTING" | "DISABLED" | "RESEARCH" | "READY";
  level: OsLevel;
  plainLanguage: string;
};

export type OsSportCoverage = {
  sport: string;
  games: number | null;
  coverageLabel: string;
  level: OsLevel;
  dataset: string;
  prediction: string;
  review: string;
  sampleNote: string;
};

export type OsDeprecatedItem = {
  id: string;
  label: string;
  reason: string;
  movedTo: string | null;
};

export type YangEdgeOsPresentation = {
  dateKst: string;
  overallLevel: OsLevel;
  overallLabel: string;
  canPredictToday: boolean;
  canPredictReason: string;
  predictionContinuity: OsPredictionContinuityCard;
  mlbDailyOps: OsMlbDailyOpsCard | null;
  leagueStatuses: OsLeagueStatus[];
  checklist: OsChecklistItem[];
  progressPercent: number | null;
  progressLabel: string;
  risks: { id: string; title: string; detail: string; level: OsLevel }[];
  aiBrief: string;
  weekSummaryLines: string[];
  missions: OsMissionItem[];
  cto: {
    sampleGrowth: string;
    accuracy: string;
    brier: string;
    logLoss: string;
    engineChanged: string;
    recommendations: string[];
    failureTop: string[];
    successTop: string[];
    footballProgress: string;
    nextWeekGoals: string[];
  };
  dataCenter: OsSportCoverage[];
  engines: OsEngineVar[];
  researchFocus: {
    pipelines: { name: string; status: string; plain: string; level: OsLevel }[];
    coverageNote: string;
    reviewPending: number | null;
    predictionNote: string;
  };
  developerNotes: string[];
  deprecated: OsDeprecatedItem[];
  naturalAlerts: string[];
};

function pipelineLevel(status: PipelineStatus): OsLevel {
  switch (status) {
    case "COMPLETE":
      return "READY";
    case "PARTIAL":
    case "PENDING":
    case "NOT_READY":
    case "NOT_ENTERED":
    case "NOT_CREATED":
      return "WARNING";
    case "WARNING":
      return "BLOCKED";
    case "FILE_NOT_FOUND":
    default:
      return "OFF";
  }
}

function overallFromOp(op: OperatorPresentation): { level: OsLevel; label: string } {
  switch (op.overallStatus) {
    case "정상 진행":
      return { level: "READY", label: "오늘 운영은 정상입니다" };
    case "확인 필요":
      return { level: "WARNING", label: "오늘 확인이 필요한 항목이 있습니다" };
    case "작업 필요":
      return { level: "WARNING", label: "오늘 처리할 작업이 남아 있습니다" };
    case "중요 문제 있음":
      return { level: "BLOCKED", label: "오늘 중요한 문제가 있습니다" };
    default:
      return { level: "OFF", label: "상태를 확인할 수 없습니다" };
  }
}

/** Convert technical pipeline messages into owner-facing Korean. */
export function naturalizePipelineMessage(
  pipelineName: string,
  status: PipelineStatus,
  message: string,
): string {
  const name = pipelineName.toLowerCase();
  const msg = message.toLowerCase();

  if (name.includes("starter")) {
    if (msg.includes("hash") || msg.includes("exit 1") || msg.includes("integrity")) {
      return "Starter 정보는 모두 수집되었습니다. 무결성(Hash) 검증이 실패하여 오늘 Prediction에는 사용하지 않습니다.";
    }
    if (status === "COMPLETE") return "선발투수 정보가 준비되었습니다.";
    if (status === "PARTIAL") return "선발투수 정보가 일부만 준비되었습니다. 확인이 필요합니다.";
    if (status === "FILE_NOT_FOUND" || status === "NOT_CREATED") {
      return "선발투수 정보가 아직 없습니다.";
    }
  }

  if (name.includes("odds") || name.includes("배당")) {
    if (
      msg.includes("0/") ||
      msg.includes("not collected") ||
      msg.includes("0 collected")
    ) {
      return "오늘 해외 배당을 가져오지 못했습니다. Prediction은 생성하지 않습니다.";
    }
    if (status === "COMPLETE") return "해외 배당 정보가 준비되었습니다.";
    if (status === "PARTIAL") return "해외 배당이 일부 경기만 수집되었습니다.";
  }

  if (name.includes("lineup")) {
    if (msg.includes("after") || msg.includes("post")) {
      return "라인업은 확인됐지만 경기 시작 이후에 수집된 기록이 있습니다. Pregame 표본으로는 쓰지 않습니다.";
    }
    if (status === "COMPLETE") return "라인업이 확정되었습니다.";
  }

  if (name.includes("schedule")) {
    if (status === "COMPLETE") return "오늘 일정이 준비되었습니다.";
    if (status === "FILE_NOT_FOUND") return "오늘 일정이 아직 없습니다.";
  }

  if (name.includes("prediction")) {
    if (status === "COMPLETE") return "오늘 Prediction Snapshot이 있습니다.";
    if (status === "FILE_NOT_FOUND" || status === "NOT_CREATED") {
      return "오늘 Prediction은 아직 없습니다.";
    }
  }

  if (name.includes("review")) {
    if (status === "COMPLETE") return "오늘 리뷰가 준비되었습니다.";
    if (status === "PENDING" || status === "PARTIAL") {
      return "리뷰가 일부만 끝났습니다. 확인이 필요합니다.";
    }
  }

  // Fallback: strip jargon lightly
  if (status === "COMPLETE") return `${pipelineName} 준비 완료`;
  if (status === "PARTIAL") return `${pipelineName} 일부만 준비됨 — 확인 필요`;
  if (status === "WARNING") return `${pipelineName}에 문제가 있습니다`;
  if (status === "FILE_NOT_FOUND" || status === "NOT_CREATED") {
    return `${pipelineName} 아직 없음`;
  }
  return message || `${pipelineName}: ${status}`;
}

function estimateMinutes(priority: string, title: string): number {
  if (priority === "CRITICAL") return 20;
  if (title.toLowerCase().includes("review")) return 25;
  if (title.toLowerCase().includes("odds") || title.includes("배당")) return 15;
  if (title.toLowerCase().includes("schedule") || title.includes("일정")) return 10;
  if (priority === "HIGH") return 15;
  return 10;
}

function findPipeline(data: ResearchLabData, needle: string) {
  return data.pipelines.find((p) =>
    p.pipelineName.toLowerCase().includes(needle.toLowerCase()),
  );
}

function buildMlbDailyOpsCard(
  day: MlbDailyOpsDayAssessment | null | undefined,
  recent: MlbDailyOpsDayAssessment[] | null | undefined,
): OsMlbDailyOpsCard | null {
  if (!day) return null;
  return {
    lifecycle: day.lifecycle,
    schedule: day.games > 0 ? `${day.games} games` : "MISSING",
    starter: `${day.starter.ready}/${day.starter.total}`,
    odds: `${day.odds.ready}/${day.odds.total}`,
    lineup: `${day.lineup.ready}/${day.lineup.total}`,
    prediction: day.snapshotVerified
      ? "PRE_GAME_SNAPSHOT_VERIFIED"
      : day.provenanceStatus,
    recommendationRecord: day.recommendationRecord,
    predictionHashShort: day.predictionHashShort,
    goodPickCount: day.goodPickCount,
    strongPickCount: day.strongPickCount,
    researchReadyPercent: day.researchReadyPercent,
    nextAction: day.nextAction,
    recentDays: (recent ?? []).map((d) => ({
      dateKst: d.dateKst,
      lifecycle: d.lifecycle,
      line: d.line,
    })),
  };
}

export function buildYangEdgeOsPresentation(
  data: ResearchLabData,
  op: OperatorPresentation,
  extras?: {
    continuity?: PredictionContinuityAssessment | null;
    mlbDailyOpsDay?: MlbDailyOpsDayAssessment | null;
    mlbDailyOpsRecent?: MlbDailyOpsDayAssessment[] | null;
  },
): YangEdgeOsPresentation {
  const { level: overallLevel, label: overallLabel } = overallFromOp(op);
  const briefObj = buildAssistantBrief(data, op, {});
  const brief = [
    briefObj.primaryRecommendation,
    briefObj.primaryReason,
    briefObj.secondaryRecommendation,
    ...briefObj.warnings,
  ]
    .filter(Boolean)
    .join(" ");

  const mlbSchedule = findPipeline(data, "schedule");
  const mlbStarter = findPipeline(data, "starter");
  const mlbOdds = findPipeline(data, "odds");
  const mlbPrediction = findPipeline(data, "prediction");
  const mlbReview = findPipeline(data, "review");

  const oddsMissing =
    mlbOdds &&
    (mlbOdds.status === "PARTIAL" || mlbOdds.status === "WARNING") &&
    /0\s*\/|not collected|0 collected/i.test(mlbOdds.message ?? "");

  const starterIntegrityIssue =
    mlbStarter &&
    /hash|exit 1|integrity/i.test(mlbStarter.message ?? "");

  const continuity = extras?.continuity ?? null;
  const predictionContinuity: OsPredictionContinuityCard = continuity
    ? {
        status: continuity.status,
        snapshotExists: continuity.snapshotExists,
        generatedAt: continuity.generatedAt ?? continuity.predictedAt,
        createdBeforeFirstStart: continuity.createdBeforeFirstStart,
        predictionHashSha256: continuity.predictionHashSha256,
        opsFailure: continuity.opsFailure,
        plainLanguage: continuity.plainLanguage,
      }
    : {
        status: "UNKNOWN",
        snapshotExists: mlbPrediction?.status === "COMPLETE",
        generatedAt: null,
        createdBeforeFirstStart: null,
        predictionHashSha256: null,
        opsFailure: mlbPrediction?.status !== "COMPLETE",
        plainLanguage: "Continuity 평가 없음",
      };

  // Continuity: LIMITED_INPUT still allows research prediction; missing snapshot is ops failure
  const canPredictToday =
    overallLevel !== "BLOCKED" &&
    !starterIntegrityIssue &&
    (mlbPrediction?.status === "COMPLETE" ||
      predictionContinuity.snapshotExists ||
      (!predictionContinuity.opsFailure && !oddsMissing));

  const canPredictReason = predictionContinuity.opsFailure
    ? `오늘 Prediction Continuity: FAIL — ${predictionContinuity.plainLanguage}`
    : predictionContinuity.snapshotExists
      ? `오늘 Prediction Snapshot: YES — 생성 ${predictionContinuity.generatedAt ?? "시각 미상"}${
          predictionContinuity.createdBeforeFirstStart === true
            ? " · 경기 시작 전"
            : predictionContinuity.createdBeforeFirstStart === false
              ? " · 시작 후 생성(주의)"
              : ""
        }${
          predictionContinuity.predictionHashSha256
            ? ` · hash ${predictionContinuity.predictionHashSha256.slice(0, 12)}…`
            : ""
        }`
      : oddsMissing
        ? "오늘 Prediction: LIMITED_INPUT 가능 — 배당 부족이어도 Continuity Snapshot은 생성해야 합니다."
        : starterIntegrityIssue
          ? "오늘 Prediction 생성 가능: NO — Starter 무결성 검증이 실패했습니다."
          : "오늘 Prediction Snapshot이 아직 없습니다.";

  const footballId = buildFootballIdentityOperationSlice();
  const footballOdds = buildDefaultFootballOddsView(data.dateKst);
  const footballResult = buildDefaultFootballResultView(data.dateKst, {
    identityStage: footballId.stage,
    oddsStage: footballOdds.slice.oddsStage,
  });
  const footballReview = buildDefaultFootballReviewScorecardView(data.dateKst);

  // Elevate overall when continuity ops failure
  let continuityOverallLevel = overallLevel;
  let continuityOverallLabel = overallLabel;
  if (predictionContinuity.opsFailure) {
    continuityOverallLevel = "BLOCKED";
    continuityOverallLabel = "PREDICTION SNAPSHOT MISSING";
  }

  const leagueStatuses: OsLeagueStatus[] = [
    {
      league: "MLB",
      level:
        overallLevel === "BLOCKED"
          ? "BLOCKED"
          : oddsMissing || starterIntegrityIssue
            ? "WARNING"
            : mlbSchedule?.status === "COMPLETE"
              ? "READY"
              : "WARNING",
      label:
        overallLevel === "BLOCKED"
          ? "BLOCKED"
          : oddsMissing
            ? "INPUT REQUIRED"
            : mlbSchedule?.status === "COMPLETE"
              ? "READY"
              : "PREPARING",
      detail: naturalizePipelineMessage(
        mlbSchedule?.pipelineName ?? "Schedule",
        mlbSchedule?.status ?? "FILE_NOT_FOUND",
        mlbSchedule?.message ?? "",
      ),
    },
    {
      league: "KBO",
      level:
        data.kboOps.overallStatus === "BLOCKED"
          ? "BLOCKED"
          : data.kboOps.overallStatus === "READY"
            ? "READY"
            : data.kboOps.schedule.totalGames > 0
              ? "WARNING"
              : "OFF",
      label:
        data.kboOps.overallStatus === "BLOCKED"
          ? "BLOCKED"
          : data.kboOps.overallStatus === "READY"
            ? "READY"
            : data.kboOps.schedule.totalGames > 0
              ? "INPUT REQUIRED"
              : "OFF",
      detail:
        op.kboDailyOps?.overall ??
        (data.kboOps.schedule.totalGames > 0
          ? "입력·확인 작업이 남아 있습니다."
          : "오늘 KBO 일정이 없거나 아직 수집되지 않았습니다."),
    },
    {
      league: "Football",
      level: footballReview.slice.gate.status,
      label: `Review ${footballReview.slice.reviewStage}`,
      detail: footballReview.slice.plainLanguage,
    },
    {
      league: "NBA",
      level: "OFF",
      label: "OFFSEASON",
      detail: "시즌오프 · 일일 운영 대상이 아닙니다.",
    },
  ];

  const checklist: OsChecklistItem[] = [
    {
      id: "mlb-review",
      title: "MLB Review",
      done: (data.summary.reviewPendingGames ?? 0) === 0 && (data.summary.gradedGames ?? 0) > 0,
      level:
        (data.summary.reviewPendingGames ?? 0) > 0 ? "WARNING" : "READY",
      href: `/internal/research?date=${data.dateKst}`,
    },
    {
      id: "kbo-odds",
      title: "KBO Odds",
      done: !/NOT_|MISSING|WAITING/i.test(op.kboReadiness.domesticOdds),
      level: /NOT_|MISSING|WAITING/i.test(op.kboReadiness.domesticOdds)
        ? "WARNING"
        : "READY",
      href: `/internal/research/kbo/input?date=${data.dateKst}`,
    },
    {
      id: "epl-schedule",
      title: "Football Identity",
      done: footballId.stage === "FOUNDATION" || footballId.stage === "READY",
      level: footballId.osLevel,
      href: `/internal/developer?date=${data.dateKst}`,
    },
    ...op.actionCards.slice(0, 5).map((a) => ({
      id: a.id,
      title: a.title,
      done: a.systemStatus === "RESOLVED",
      level:
        a.priority === "CRITICAL"
          ? ("BLOCKED" as const)
          : a.priority === "HIGH"
            ? ("WARNING" as const)
            : ("READY" as const),
      href: a.command?.includes("personnel")
        ? `/internal/kbo/personnel?date=${data.dateKst}`
        : `/internal/mission?date=${data.dateKst}`,
    })),
  ];

  const completed = checklist.filter((c) => c.done).length;
  const progressPercent =
    checklist.length > 0
      ? Math.round((completed / checklist.length) * 100)
      : null;

  const risks = [
    ...op.missedExplanations.map((m) => ({
      id: m.id,
      title: m.title,
      detail: m.impact,
      level:
        m.severity === "CRITICAL"
          ? ("BLOCKED" as const)
          : m.severity === "HIGH"
            ? ("WARNING" as const)
            : ("READY" as const),
    })),
    ...data.waitingStates.slice(0, 5).map((w) => ({
      id: `${w.league}-${w.code}`,
      title: `[${w.league}] 대기`,
      detail: w.message,
      level: "WARNING" as const,
    })),
  ];

  const naturalAlerts: string[] = [];
  for (const p of data.pipelines) {
    const plain = naturalizePipelineMessage(p.pipelineName, p.status, p.message);
    if (
      p.status === "PARTIAL" ||
      p.status === "WARNING" ||
      /hash|0\/|not collected/i.test(p.message)
    ) {
      naturalAlerts.push(plain);
    }
  }
  naturalAlerts.push(canPredictReason);

  const missions: OsMissionItem[] = op.actionCards.map((a) => ({
    id: a.id,
    title: a.title,
    priority: a.priority,
    estimatedMinutes: estimateMinutes(a.priority, a.title),
    risk:
      a.priority === "CRITICAL"
        ? "BLOCKED"
        : a.priority === "HIGH"
          ? "WARNING"
          : "READY",
    blockedReason: a.systemStatus === "OPEN" ? a.situation : null,
    nextStep: a.nextAction || a.situation,
    aiTip: a.reason || brief.slice(0, 120),
    href:
      a.taskType.startsWith("KBO")
        ? `/internal/kbo/personnel?date=${data.dateKst}`
        : `/internal/research?date=${data.dateKst}`,
  }));

  const rs = op.resultSummary;
  const cto = {
    sampleGrowth:
      rs.gradedGames != null
        ? `오늘 채점 표본 ${rs.gradedGames}경기 (누적 집계는 데이터 현황에서 확인)`
        : "오늘 채점 표본 없음 — 주간 누적은 데이터가 쌓이면 표시됩니다.",
    accuracy:
      rs.accuracy != null
        ? `오늘 관측 적중률 ${rs.accuracy}% (공식 성과 아님 · 연구 관찰)`
        : "오늘 Accuracy 없음",
    brier: "Brier는 Scorecard/Review artifact 기준으로만 확인 (이 화면은 요약)",
    logLoss: "LogLoss는 Scorecard/Review artifact 기준으로만 확인 (이 화면은 요약)",
    engineChanged: "Engine 변경 없음 (이번 OS 전환은 UX만)",
    recommendations: [
      ...missions.slice(0, 3).map((m) => m.title),
      "08-04부터 경기 전 Daily Pregame Freeze 유지",
    ],
    failureTop: op.missedExplanations.slice(0, 3).map((m) => m.title),
    successTop:
      rs.hits != null && rs.hits > 0
        ? [`적중 ${rs.hits}경기 관찰`, "시장·선발 정렬 패턴은 Review Detail에서 확인"]
        : ["아직 성공 패턴 요약 없음"],
    footballProgress: `복기 ${koreanStatusLabel(footballReview.slice.reviewStage)} · 스코어카드 ${koreanStatusLabel(footballReview.slice.scorecardStage)} · 예측 ${koreanStatusLabel(footballReview.slice.prediction)}`,
    nextWeekGoals: [
      "매일 경기 전 Prediction Freeze",
      "대시보드 5초 루틴 정착",
      "개발자 진단은 개발자만 사용",
    ],
  };

  const dataCenter: OsSportCoverage[] = [
    {
      sport: "MLB",
      games: rs.totalGames,
      coverageLabel:
        mlbSchedule?.status === "COMPLETE" ? "일정 준비됨" : "일정 확인 필요",
      level: pipelineLevel(mlbSchedule?.status ?? "FILE_NOT_FOUND"),
      dataset: mlbStarter
        ? naturalizePipelineMessage("Starter", mlbStarter.status, mlbStarter.message)
        : "Starter 정보 없음",
      prediction: mlbPrediction
        ? naturalizePipelineMessage(
            "Prediction",
            mlbPrediction.status,
            mlbPrediction.message,
          )
        : "Prediction 없음",
      review: mlbReview
        ? naturalizePipelineMessage("Review", mlbReview.status, mlbReview.message)
        : "Review 없음",
      sampleNote:
        rs.gradedGames != null
          ? `채점 ${rs.gradedGames} · 적중 ${rs.hits ?? "—"} · 실패 ${rs.misses ?? "—"}`
          : "누적 표본 요약 없음",
    },
    {
      sport: "KBO",
      games: op.kboDailyOps?.scheduleGames ?? data.kboOps.schedule.totalGames,
      coverageLabel: op.kboDailyOps?.overall ?? data.kboOps.overallStatus,
      level:
        data.kboOps.overallStatus === "READY"
          ? "READY"
          : data.kboOps.overallStatus === "BLOCKED"
            ? "BLOCKED"
            : "WARNING",
      dataset: `Starter ${op.kboReadiness.starter} · Lineup ${op.kboReadiness.lineup}`,
      prediction: op.kboReadiness.prediction,
      review: op.kboReadiness.review,
      sampleNote: `활성 ${op.kboDailyOps?.activeGames ?? data.kboOps.schedule.activeGames}경기`,
    },
    {
      sport: "Football",
      games: null,
      coverageLabel: `Review ${footballReview.slice.reviewStage}`,
      level: footballReview.slice.gate.status,
      dataset: `Identity ${footballId.stage} · Odds ${footballOdds.slice.oddsStage} · Result ${footballResult.slice.resultStage} · Review ${footballReview.slice.reviewStage}`,
      prediction: "NONE",
      review: `Foundation ${footballReview.slice.reviewStage} · Scorecard ${footballReview.slice.scorecardStage}`,
      sampleNote: footballReview.slice.plainLanguage,
    },
    {
      sport: "NBA",
      games: null,
      coverageLabel: "OFFSEASON",
      level: "OFF",
      dataset: "시즌오프",
      prediction: "—",
      review: "—",
      sampleNote: "일일 운영 없음",
    },
    {
      sport: "Volleyball",
      games: null,
      coverageLabel: "OFF",
      level: "OFF",
      dataset: "미연결",
      prediction: "—",
      review: "—",
      sampleNote: "미연결",
    },
  ];

  const engines: OsEngineVar[] = [
    {
      id: "starter",
      name: "Starter",
      status: starterIntegrityIssue
        ? "COLLECTING"
        : mlbStarter?.status === "COMPLETE"
          ? "READY"
          : mlbStarter
            ? "COLLECTING"
            : "DISABLED",
      level: starterIntegrityIssue
        ? "BLOCKED"
        : pipelineLevel(mlbStarter?.status ?? "FILE_NOT_FOUND"),
      plainLanguage: mlbStarter
        ? naturalizePipelineMessage("Starter", mlbStarter.status, mlbStarter.message)
        : "Starter 모듈 상태 없음",
    },
    {
      id: "bullpen",
      name: "Bullpen",
      status: "DISABLED",
      level: "OFF",
      plainLanguage: "v0에서 weight=0 · 연구만 가능 (엔진 반영 금지)",
    },
    {
      id: "weather",
      name: "Weather",
      status: "RESEARCH",
      level: "OFF",
      plainLanguage: "연구 수집 단계 · 운영 Prediction에 미반영",
    },
    {
      id: "travel",
      name: "Travel",
      status: "RESEARCH",
      level: "OFF",
      plainLanguage: "연구 수집 단계 · 운영 Prediction에 미반영",
    },
    {
      id: "marketPrior",
      name: "Market Prior",
      status: oddsMissing
        ? "COLLECTING"
        : mlbOdds?.status === "COMPLETE"
          ? "ACTIVE"
          : "COLLECTING",
      level: oddsMissing
        ? "BLOCKED"
        : pipelineLevel(mlbOdds?.status ?? "FILE_NOT_FOUND"),
      plainLanguage: mlbOdds
        ? naturalizePipelineMessage("Odds", mlbOdds.status, mlbOdds.message)
        : "해외 배당 상태 없음",
    },
    {
      id: "lineup",
      name: "Lineup",
      status: "RESEARCH",
      level: "WARNING",
      plainLanguage: "라인업은 수집·표시 가능 · v0 weight=0으로 엔진 미반영",
    },
  ];

  const researchFocus = {
    pipelines: data.pipelines.map((p) => ({
      name: p.pipelineName,
      status: p.status,
      plain: naturalizePipelineMessage(p.pipelineName, p.status, p.message),
      level: pipelineLevel(p.status),
    })),
    coverageNote:
      progressPercent != null
        ? `오늘 체크리스트 진행 ${progressPercent}%`
        : "커버리지 요약을 만들 수 없습니다.",
    reviewPending: data.summary.reviewPendingGames,
    predictionNote: canPredictReason,
  };

  const deprecated: OsDeprecatedItem[] = [
    {
      id: "operator-home-tab",
      label: "연구실 › 운영 홈 탭",
      reason: "대표는 대시보드 / 작업 관리를 사용",
      movedTo: "/internal/dashboard",
    },
    {
      id: "system-detail-tab",
      label: "연구실 › 시스템 상세 탭",
      reason: "개발자 전용 정보를 개발자 진단으로 이동",
      movedTo: "/internal/developer",
    },
    {
      id: "recommended-commands-owner",
      label: "운영 화면의 Recommended Commands",
      reason: "대표 기본 화면에 CLI 노출 금지",
      movedTo: "/internal/developer",
    },
  ];

  const mlbDailyOps = buildMlbDailyOpsCard(
    extras?.mlbDailyOpsDay,
    extras?.mlbDailyOpsRecent,
  );

  return {
    dateKst: data.dateKst,
    overallLevel: continuityOverallLevel,
    overallLabel: continuityOverallLabel,
    canPredictToday,
    canPredictReason,
    predictionContinuity,
    mlbDailyOps,
    leagueStatuses,
    checklist,
    progressPercent,
    progressLabel:
      progressPercent != null
        ? `오늘 할 일 ${completed}/${checklist.length} 완료`
        : "진행률을 계산할 수 없습니다",
    risks: risks.slice(0, 8),
    aiBrief: brief,
    weekSummaryLines: [
      ...op.summaryLines.slice(0, 4),
      cto.engineChanged,
      "주간 Accuracy/Brier/LogLoss 공식 성과로 해석하지 않습니다.",
    ],
    missions,
    cto,
    dataCenter,
    engines,
    researchFocus,
    developerNotes: [
      "Hash / Artifact / Provider / Runtime / Logs / Replay / Raw / Cache는 개발자 진단에서만 기본 노출",
      "대표 모드에서는 고급 정보 토글로만 표시",
    ],
    deprecated,
    naturalAlerts: [...new Set(naturalAlerts)].slice(0, 8),
  };
}
