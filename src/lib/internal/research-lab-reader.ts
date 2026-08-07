import "server-only";
import { readFile } from "node:fs/promises";
import { stat } from "node:fs/promises";
import path from "node:path";
import { loadMlbDailyResearchSummary } from "@/lib/mlb/load-mlb-daily-research-summary";
import type { MlbDailyResearchSummaryLoad } from "@/lib/mlb/mlb-daily-research-summary-types";
import {
  loadKboResearchLabOpsState,
  formatOpsStatusLabel,
  type KboResearchLabOpsState,
} from "@/lib/internal/load-kbo-research-lab-ops-state";

// ---------------------------------------------------------------------------
// Safe JSON reader
// ---------------------------------------------------------------------------

type ReadResult<T> =
  | { ok: true; data: T; path: string; updatedAt: string | null }
  | { ok: false; error: string; path: string };

async function readJsonFile<T>(filePath: string): Promise<ReadResult<T>> {
  try {
    const raw = await readFile(filePath, "utf8");
    const data = JSON.parse(raw) as T;
    let updatedAt: string | null = null;
    try {
      const s = await stat(filePath);
      updatedAt = s.mtime.toISOString();
    } catch {}
    return { ok: true, data, path: filePath, updatedAt };
  } catch (e) {
    const msg =
      e instanceof Error && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT"
        ? "FILE_NOT_FOUND"
        : e instanceof SyntaxError
          ? "JSON_PARSE_ERROR"
          : "READ_ERROR";
    return { ok: false, error: msg, path: filePath };
  }
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function rec(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PipelineStatus =
  | "COMPLETE"
  | "PARTIAL"
  | "WARNING"
  | "PENDING"
  | "NOT_AVAILABLE"
  | "FILE_NOT_FOUND"
  | "NOT_CREATED"
  | "NOT_READY"
  | "NOT_ENTERED";

export type Severity = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";

export type PipelineCard = {
  pipelineName: string;
  status: PipelineStatus;
  completedCount: number | null;
  totalCount: number | null;
  message: string;
  sourceArtifact: string | null;
  updatedAt: string | null;
};

export type TaskItem = {
  taskId: string;
  title: string;
  description: string;
  priority: Severity;
  status: "OPEN";
  source: string;
  recommendedCommand: string | null;
  generatedAt: string;
};

export type MissedItem = {
  id: string;
  label: string;
  count: number | null;
  severity: Severity;
  reason: string;
  sourceArtifact: string | null;
};

export type ReviewRow = {
  gameId: string;
  match: string;
  predictedTeam: string | null;
  confidence: number | null;
  gradeStatus: string;
  pickTier: string;
  reviewStatus: string;
};

export type ResearchLabData = {
  dateKst: string;
  generatedAt: string;
  summary: {
    totalGames: number | null;
    predictionCompletedGames: number | null;
    predictionPendingGames: number | null;
    passGames: number | null;
    strictEdgePickGames: number | null;
    researchCandidateGames: number | null;
    baselineCandidateGames: number | null;
    marketConflictGames: number | null;
    finalGames: number | null;
    pendingResultGames: number | null;
    gradedGames: number | null;
    reviewPendingGames: number | null;
    hitGames: number | null;
    missGames: number | null;
    accuracy: number | null;
    postponedGames: number | null;
    voidGames: number | null;
  };
  pipelines: PipelineCard[];
  starterHealth: {
    status: PipelineStatus;
    expectedRows: number | null;
    collectedRows: number | null;
    missingRows: number | null;
    probableCount: number | null;
    missingProbableCount: number | null;
    artifactUpdatedAt: string | null;
    sourceArtifact: string | null;
    warningCodes: string[];
  };
  tasks: TaskItem[];
  missedItems: MissedItem[];
  reviewQueue: {
    totalReviewRows: number | null;
    pendingReviewRows: number | null;
    completedReviewRows: number | null;
    hitReviewRows: number | null;
    missReviewRows: number | null;
    topCandidates: ReviewRow[];
  };
  kboReadiness: {
    scheduleGames: number | null;
    scheduleActiveGames: number | null;
    scheduleCancelledGames: number | null;
    scheduleStatus: string;
    domesticOddsGames: number | null;
    domesticOddsTotal: number | null;
    domesticOddsStatus: string;
    overseasOddsGames: number | null;
    overseasOddsTotal: number | null;
    overseasOddsStatus: string;
    starterGames: number | null;
    starterTotal: number | null;
    starterStatus: string;
    lineupGames: number | null;
    lineupTotal: number | null;
    lineupStatus: KboArtifactStatus | string;
    bullpenStatus: KboArtifactStatus | string;
    predictionStatus: KboArtifactStatus | string;
    reviewStatus: string;
    t45Status: string;
    oddsArtifactUpdatedAt: string | null;
    scheduleArtifactUpdatedAt: string | null;
    starterArtifactUpdatedAt: string | null;
    overallStatus: string;
    predictionLock: { locked: boolean; reasons: string[] };
    bettingLinePipeline: KboPipelineStageStatus[];
    bugBoardItems: KboBugBoardItem[];
    summaryLines: string[];
    waitingStates: { code: string; message: string }[];
    readyStates: { code: string; message: string }[];
    assistantBrief: string;
  };
  /** Full KBO ops-state (schedule-v1 / personnel-input aware). */
  kboOps: KboResearchLabOpsState;
  /** MLB Daily Builder summary — source of truth for Lab Ready UI. */
  mlbDailyResearchSummary: MlbDailyResearchSummaryLoad;
  commands: { label: string; command: string | null }[];
  sourceArtifacts: { name: string; path: string; status: string; displayStatus?: string }[];
  errors: string[];
  /** Non-blocking workflow waits (not shown as red Load Errors). */
  waitingStates: { code: string; message: string; league: "MLB" | "KBO" }[];
};

export type KboArtifactStatus =
  | "READY"
  | "PARTIAL"
  | "MISSING"
  | "NOT_AVAILABLE"
  | "UNKNOWN"
  | "NOT_ENTERED"
  | "NOT_CREATED"
  | "NOT_READY"
  | "NOT_APPLICABLE"
  | "READY_ADMIN_VERIFIED";

export type KboPipelineStageStatus = {
  stage: string;
  status: "PASS" | "WARN" | "FAIL";
  detail: string;
};

export type KboBugBoardItem = {
  id: string;
  label: string;
  severity: "RED" | "YELLOW" | "GREEN";
  resolved: boolean;
};

// ---------------------------------------------------------------------------
// Build dashboard data
// ---------------------------------------------------------------------------

export async function loadResearchLabData(
  dateKst: string,
): Promise<ResearchLabData> {
  const now = new Date().toISOString();
  const errors: string[] = [];
  const cwd = process.cwd();

  const predPath = path.join(cwd, "data", "predictions", "mlb", `${dateKst}.json`);
  const reviewPath = path.join(cwd, "data", "predictions", "mlb", `${dateKst}-review.json`);
  const starterPath = path.join(cwd, "data", "research", "mlb", `${dateKst}-starter-dataset-v1.json`);
  const bullpenPath = path.join(cwd, "data", "research", "mlb", `${dateKst}-bullpen-role-dataset-v1_1.json`);
  const oddsPath = path.join(cwd, "data", "research", "mlb", `${dateKst}-odds-history-dataset-v1.json`);
  const baselinePath = path.join(cwd, "data", "daily-tests", `${dateKst}-mlb-baseline-analysis.json`);
  const bettingFilterPath = path.join(cwd, "data", "daily-tests", `${dateKst}-mlb-betting-line-filter.json`);
  const weatherPath = path.join(cwd, "data", "research", "mlb", `${dateKst}-weather-dataset-v1.json`);
  const travelPath = path.join(cwd, "data", "research", "mlb", `${dateKst}-travel-rest-dataset-v1.json`);
  const coverageDashPath = path.join(cwd, "data", "research", "dataset-coverage-dashboard-v1.json");
  const learningPath = path.join(cwd, "data", "learning", "dashboard.json");
  const starterAuditPath = path.join(cwd, "data", "audits", `${dateKst}-starter-dataset-v1-audit.json`);

  const pred = await readJsonFile<Record<string, unknown>>(predPath);
  const review = await readJsonFile<Record<string, unknown>>(reviewPath);
  const starter = await readJsonFile<Record<string, unknown>>(starterPath);
  const bullpen = await readJsonFile<Record<string, unknown>>(bullpenPath);
  const odds = await readJsonFile<Record<string, unknown>>(oddsPath);
  const baseline = await readJsonFile<Record<string, unknown>>(baselinePath);
  const bettingFilter = await readJsonFile<Record<string, unknown>>(bettingFilterPath);
  const weather = await readJsonFile<Record<string, unknown>>(weatherPath);
  const travel = await readJsonFile<Record<string, unknown>>(travelPath);

  const waitingStates: ResearchLabData["waitingStates"] = [];

  function classifyMlbRead(
    label: string,
    r: ReadResult<unknown>,
    waitingCode: string,
  ) {
    if (r.ok) return;
    if (r.error === "FILE_NOT_FOUND") {
      waitingStates.push({
        code: waitingCode,
        message: `${label}: ${formatOpsStatusLabel("FILE_NOT_FOUND")}`,
        league: "MLB",
      });
      return;
    }
    errors.push(`${label}: ${r.error}`);
  }

  classifyMlbRead("Prediction", pred, "PREDICTION_NOT_CREATED");
  classifyMlbRead("Review", review, "REVIEW_NOT_READY");
  classifyMlbRead("Starter", starter, "STARTER_ARTIFACT_NOT_CREATED");

  // ---- Parse prediction snapshot ----
  type Pred = Record<string, unknown>;
  const predictions: Pred[] = pred.ok ? arr((pred.data as Pred).predictions).map((x) => rec(x) ?? {}) : [];
  const predMeta = pred.ok ? rec((pred.data as Pred).meta) ?? {} : {};
  const predSummary = pred.ok ? rec((pred.data as Pred).summary) ?? {} : {};

  const totalGames = predictions.length > 0 ? predictions.length : num(predSummary.total);

  let gradedCount = 0;
  let pendingResultCount = 0;
  let postponedCount = 0;
  let cancelledCount = 0;
  let hitCount = 0;
  let missCount = 0;
  let passCount = 0;
  let candidateCount = 0;
  let marketConflictCount = 0;
  let valueEdgeUnverifiedCount = 0;

  for (const p of predictions) {
    const rs = str(p.resultStatus);
    const bs = str(p.baselineStatus);
    const hit = p.predictionHit;
    if (rs === "graded") {
      gradedCount++;
      if (hit === true) hitCount++;
      if (hit === false) missCount++;
    } else if (rs === "postponed") {
      postponedCount++;
    } else if (rs === "cancelled") {
      cancelledCount++;
    } else {
      pendingResultCount++;
    }
    if (bs === "PASS") passCount++;
    if (bs === "BASELINE_CANDIDATE") candidateCount++;
    if (bs === "MARKET_CONFLICT") marketConflictCount++;

    if (p.openingOdds == null && p.valueEdge != null) {
      valueEdgeUnverifiedCount++;
    }
  }

  const accuracy =
    gradedCount > 0 ? Math.round((hitCount / gradedCount) * 1000) / 10 : null;

  // ---- Review data ----
  const reviewSummary = review.ok ? rec((review.data as Pred).summary) ?? {} : {};
  const reviewGames: Pred[] = review.ok ? arr((review.data as Pred).games).map((x) => rec(x) ?? {}) : [];

  // ---- Starter health ----
  const starterMeta = starter.ok ? rec((starter.data as Pred).meta) ?? {} : {};
  const starterSummary = starter.ok ? rec((starter.data as Pred).summary) ?? {} : {};
  const starterWarnings: string[] = [];
  if (!starter.ok) {
    starterWarnings.push(
      starter.error === "FILE_NOT_FOUND"
        ? "STARTER_ARTIFACT_NOT_FOUND"
        : "STARTER_STATUS_UNKNOWN",
    );
  } else {
    const total = num(starterSummary.totalRows);
    const prob = num(starterSummary.probableRows);
    const missing = num(starterSummary.missingRows);
    if (total === 0) starterWarnings.push("STARTER_DATASET_EMPTY");
    if (missing != null && missing > 0) starterWarnings.push("PROBABLE_STARTER_MISSING");
  }

  // ---- Pipeline cards ----
  function fileStatus(r: ReadResult<unknown>, waitingStatus: PipelineStatus): PipelineStatus {
    if (!r.ok) {
      if (r.error === "FILE_NOT_FOUND") return waitingStatus;
      return "WARNING";
    }
    return "COMPLETE";
  }
  function makeCard(
    name: string,
    r: ReadResult<unknown>,
    completed: number | null,
    total: number | null,
    msg?: string,
    waitingStatus: PipelineStatus = "NOT_CREATED",
  ): PipelineCard {
    let s = fileStatus(r, waitingStatus);
    if (s === "COMPLETE" && completed != null && total != null && completed < total) {
      s = "PARTIAL";
    }
    const waitingMsg =
      !r.ok && r.error === "FILE_NOT_FOUND"
        ? formatOpsStatusLabel(
            waitingStatus === "NOT_READY"
              ? "NOT_READY"
              : waitingStatus === "NOT_ENTERED"
                ? "NOT_ENTERED"
                : "FILE_NOT_FOUND",
          )
        : null;
    return {
      pipelineName: name,
      status: s,
      completedCount: completed,
      totalCount: total,
      message: !r.ok ? waitingMsg ?? r.error : msg ?? "OK",
      sourceArtifact: r.path ? path.relative(cwd, r.path) : null,
      updatedAt: r.ok ? r.updatedAt : null,
    };
  }

  const pipelines: PipelineCard[] = [
    makeCard("Schedule", baseline, null, null, str(predMeta.note) ?? "", "NOT_CREATED"),
    makeCard(
      "Starter",
      starter,
      num(starterSummary.probableRows),
      num(starterSummary.totalRows),
      undefined,
      "NOT_ENTERED",
    ),
    makeCard(
      "Bullpen",
      bullpen,
      bullpen.ok ? num(rec((bullpen.data as Pred).summary)?.totalRows) : null,
      null,
    ),
    makeCard("Odds", odds, null, null),
    makeCard("Weather", weather, null, null),
    makeCard("Travel", travel, null, null),
    makeCard(
      "Prediction",
      pred,
      num(predSummary.total),
      num(predSummary.total),
      undefined,
      "NOT_CREATED",
    ),
    makeCard(
      "Result",
      pred,
      gradedCount,
      totalGames,
      `graded=${gradedCount} pending=${pendingResultCount}`,
      "NOT_CREATED",
    ),
    makeCard(
      "Grade",
      review,
      num(reviewSummary.graded),
      num(reviewSummary.total),
      undefined,
      "NOT_READY",
    ),
    makeCard("Review", review, 0, num(reviewSummary.total), "All PENDING_REVIEW", "NOT_READY"),
  ];

  if (pendingResultCount > 0) {
    const resultCard = pipelines.find((c) => c.pipelineName === "Result");
    if (resultCard) resultCard.status = "PARTIAL";
  }
  const reviewCard = pipelines.find((c) => c.pipelineName === "Review");
  if (reviewCard && reviewCard.status === "COMPLETE") reviewCard.status = "PENDING";

  // ---- Tasks ----
  const tasks: TaskItem[] = [];
  if (pendingResultCount > 0) {
    tasks.push({
      taskId: "pending-result",
      title: `종료 대기 경기 ${pendingResultCount}건 재채점`,
      description: `${pendingResultCount}경기가 아직 종료되지 않았습니다. 경기 종료 후 재실행하세요.`,
      priority: "HIGH",
      status: "OPEN",
      source: predPath,
      recommendedCommand: `npm run research:postgame -- ${dateKst}`,
      generatedAt: now,
    });
  }
  if (postponedCount > 0) {
    const postponedGames = predictions
      .filter((p) => str(p.resultStatus) === "postponed")
      .map((p) => `${str(p.gameId)} (${str(p.awayTeam)} @ ${str(p.homeTeam)})`)
      .join(", ");
    tasks.push({
      taskId: "postponed-game",
      title: `기상 연기 경기 ${postponedCount}건 확인`,
      description: `${postponedGames} — 기상 악화로 연기되었습니다. 결과를 기다릴 필요가 없습니다. 재편성 경기가 신규 gameId로 등록되는지 내일 일정 수집 후 확인하세요.`,
      priority: "NORMAL",
      status: "OPEN",
      source: predPath,
      recommendedCommand: null,
      generatedAt: now,
    });
  }
  if (cancelledCount > 0) {
    tasks.push({
      taskId: "cancelled-game",
      title: `취소 경기 ${cancelledCount}건 채점 제외 확인`,
      description: `${cancelledCount}경기가 취소되었습니다. 채점 제외 상태를 확인하세요.`,
      priority: "NORMAL",
      status: "OPEN",
      source: predPath,
      recommendedCommand: null,
      generatedAt: now,
    });
  }
  const missingStarters = num(starterSummary.missingRows);
  if (missingStarters != null && missingStarters > 0) {
    tasks.push({
      taskId: "starter-missing",
      title: `Starter Dataset 누락 ${missingStarters}건`,
      description: `Probable Starter ${missingStarters}명이 누락되었습니다. 현재 Artifact만으로는 Provider 수집 실패와 Join 실패를 구분할 수 없습니다.`,
      priority: "NORMAL",
      status: "OPEN",
      source: starterPath,
      recommendedCommand: `npm run research:starter -- ${dateKst}`,
      generatedAt: now,
    });
  }
  if (gradedCount > 0) {
    tasks.push({
      taskId: "review-pending",
      title: `Review Queue ${gradedCount}건 검토 필요`,
      description: `채점 완료 ${gradedCount}경기의 성공/실패 원인 검수가 필요합니다.`,
      priority: "NORMAL",
      status: "OPEN",
      source: reviewPath,
      recommendedCommand: null,
      generatedAt: now,
    });
  }
  if (valueEdgeUnverifiedCount > 0) {
    tasks.push({
      taskId: "value-edge-unverified",
      title: `Value Edge 출처 미검증 ${valueEdgeUnverifiedCount}건`,
      description: `${valueEdgeUnverifiedCount}경기에서 openingOdds가 null인데 valueEdge가 표시됩니다. 별도 감사 필요.`,
      priority: "LOW",
      status: "OPEN",
      source: predPath,
      recommendedCommand: null,
      generatedAt: now,
    });
  }

  // ---- Missed items ----
  const missedItems: MissedItem[] = [];
  if (pendingResultCount > 0) {
    missedItems.push({
      id: "pending-result",
      label: "Pending Result",
      count: pendingResultCount,
      severity: "HIGH",
      reason: "경기 미종료",
      sourceArtifact: path.relative(cwd, predPath),
    });
  }
  if (postponedCount > 0) {
    missedItems.push({
      id: "postponed-game",
      label: "Postponed Game",
      count: postponedCount,
      severity: "NORMAL",
      reason: "기상 악화 등으로 연기 — 채점 제외, 재편성 확인 필요",
      sourceArtifact: path.relative(cwd, predPath),
    });
  }
  if (missingStarters != null && missingStarters > 0) {
    missedItems.push({
      id: "starter-missing",
      label: "Starter Missing",
      count: missingStarters,
      severity: "NORMAL",
      reason: "Probable starter 데이터 누락",
      sourceArtifact: path.relative(cwd, starterPath),
    });
  }
  if (!odds.ok) {
    missedItems.push({
      id: "odds-missing",
      label: "Odds Missing",
      count: null,
      severity: "NORMAL",
      reason: odds.error === "FILE_NOT_FOUND" ? "Odds artifact 미생성" : odds.error,
      sourceArtifact: path.relative(cwd, oddsPath),
    });
  }
  if (valueEdgeUnverifiedCount > 0) {
    missedItems.push({
      id: "value-edge-unverified",
      label: "Value Edge Source Unverified",
      count: valueEdgeUnverifiedCount,
      severity: "LOW",
      reason: "openingOdds null이지만 valueEdge 존재",
      sourceArtifact: path.relative(cwd, predPath),
    });
  }

  // ---- Review queue ----
  const topCandidates: ReviewRow[] = reviewGames
    .filter((g) => str(g.resultStatus) === "graded")
    .sort((a, b) => (num(b.confidence) ?? 0) - (num(a.confidence) ?? 0))
    .slice(0, 5)
    .map((g) => ({
      gameId: str(g.gameId) ?? "",
      match: str(g.match) ?? "",
      predictedTeam: str(g.baselinePick),
      confidence: num(g.confidence) ?? num((rec(g) ?? {}).confidence),
      gradeStatus:
        g.predictionHit === true
          ? "HIT"
          : g.predictionHit === false
            ? "MISS"
            : "INCONCLUSIVE",
      pickTier: str(g.baselineStatus) ?? "UNKNOWN",
      reviewStatus: "PENDING_REVIEW",
    }));

  // Try loading confidence from predictions for review rows
  const predByGameId = new Map(predictions.map((p) => [str(p.gameId), p]));
  for (const row of topCandidates) {
    if (row.confidence == null) {
      const p = predByGameId.get(row.gameId);
      if (p) row.confidence = num(p.confidence);
    }
  }

  // ---- KBO Ops State (schedule-v1 + personnel-input aware) ----
  const kboOps = await loadKboResearchLabOpsState(dateKst, cwd);

  for (const e of kboOps.hardErrors) {
    errors.push(`KBO ${e.code}: ${e.message}`);
  }
  for (const w of kboOps.waitingStates) {
    waitingStates.push({
      code: w.code,
      message: w.message,
      league: "KBO",
    });
  }

  // Merge KBO open (TODO) tasks into today tasks
  for (const t of kboOps.tasks) {
    if (t.category !== "TODO") continue;
    tasks.push({
      taskId: t.taskId,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: "OPEN",
      source: t.source,
      recommendedCommand: t.recommendedCommand,
      generatedAt: t.generatedAt,
    });
  }

  const kboPipelineStages: KboPipelineStageStatus[] = [
    {
      stage: "Schedule",
      status: kboOps.schedule.status === "READY" ? "PASS" : "FAIL",
      detail: `${kboOps.schedule.totalGames}경기 · active ${kboOps.schedule.activeGames} · cancelled ${kboOps.schedule.cancelledGames}`,
    },
    {
      stage: "Domestic Proto",
      status:
        kboOps.domesticProto.status === "READY" ||
        kboOps.domesticProto.status === "READY_ADMIN_VERIFIED"
          ? "PASS"
          : kboOps.domesticProto.status === "PARTIAL"
            ? "WARN"
            : "FAIL",
      detail: `${kboOps.domesticProto.entered}/${kboOps.domesticProto.required} · ${kboOps.domesticProto.source}`,
    },
    {
      stage: "Starter",
      status:
        kboOps.starter.status === "READY" ||
        kboOps.starter.status === "READY_ADMIN_VERIFIED"
          ? "PASS"
          : kboOps.starter.status === "NOT_ENTERED"
            ? "WARN"
            : "WARN",
      detail: `${kboOps.starter.entered}/${kboOps.starter.required} · ${kboOps.starter.reason}`,
    },
    {
      stage: "Lineup",
      status:
        kboOps.lineup.status === "READY"
          ? "PASS"
          : kboOps.lineup.status === "NOT_ENTERED"
            ? "WARN"
            : "WARN",
      detail: `${kboOps.lineup.entered}/${kboOps.lineup.required} · ${kboOps.lineup.reason}`,
    },
    {
      stage: "Prediction",
      status: kboOps.prediction.status === "READY" ? "PASS" : "WARN",
      detail: kboOps.prediction.reason,
    },
  ];

  const bugBoard: KboBugBoardItem[] = [
    {
      id: "kbo-schedule",
      label: "KBO Schedule",
      severity: kboOps.schedule.status === "READY" ? "GREEN" : "RED",
      resolved: kboOps.schedule.status === "READY",
    },
    {
      id: "domestic-odds",
      label: "Domestic Proto",
      severity:
        kboOps.domesticProto.status === "READY" ||
        kboOps.domesticProto.status === "READY_ADMIN_VERIFIED"
          ? "GREEN"
          : kboOps.domesticProto.status === "PARTIAL"
            ? "YELLOW"
            : "RED",
      resolved:
        kboOps.domesticProto.status === "READY" ||
        kboOps.domesticProto.status === "READY_ADMIN_VERIFIED",
    },
    {
      id: "kbo-starter",
      label: "Starter Intake",
      severity:
        kboOps.starter.status === "READY" ||
        kboOps.starter.status === "READY_ADMIN_VERIFIED"
          ? "GREEN"
          : "YELLOW",
      resolved:
        kboOps.starter.status === "READY" ||
        kboOps.starter.status === "READY_ADMIN_VERIFIED",
    },
    {
      id: "kbo-lineup",
      label: "Lineup Intake",
      severity: kboOps.lineup.status === "READY" ? "GREEN" : "YELLOW",
      resolved: kboOps.lineup.status === "READY",
    },
    {
      id: "kbo-cancelled",
      label: `Cancelled NOT_APPLICABLE (${kboOps.schedule.cancelledGames})`,
      severity: "GREEN",
      resolved: true,
    },
  ];

  const kboReadiness: ResearchLabData["kboReadiness"] = {
    scheduleGames: kboOps.schedule.totalGames,
    scheduleActiveGames: kboOps.schedule.activeGames,
    scheduleCancelledGames: kboOps.schedule.cancelledGames,
    scheduleStatus: kboOps.schedule.status,
    domesticOddsGames: kboOps.domesticProto.entered,
    domesticOddsTotal: kboOps.domesticProto.required,
    domesticOddsStatus: kboOps.domesticProto.status,
    overseasOddsGames: kboOps.overseasOdds.entered,
    overseasOddsTotal: kboOps.overseasOdds.required,
    overseasOddsStatus: kboOps.overseasOdds.status,
    starterGames: kboOps.starter.entered,
    starterTotal: kboOps.starter.required,
    starterStatus: kboOps.starter.status,
    lineupGames: kboOps.lineup.entered,
    lineupTotal: kboOps.lineup.required,
    lineupStatus: kboOps.lineup.status,
    bullpenStatus: kboOps.bullpen.status,
    predictionStatus: kboOps.prediction.status,
    reviewStatus: kboOps.review.status,
    t45Status: kboOps.t45.status,
    oddsArtifactUpdatedAt: null,
    scheduleArtifactUpdatedAt: null,
    starterArtifactUpdatedAt: null,
    overallStatus: kboOps.overallStatus,
    predictionLock: {
      locked: kboOps.lockReasons.length > 0,
      reasons: kboOps.lockReasons,
    },
    bettingLinePipeline: kboPipelineStages,
    bugBoardItems: bugBoard,
    summaryLines: kboOps.summaryLines,
    waitingStates: kboOps.waitingStates,
    readyStates: kboOps.readyStates,
    assistantBrief: kboOps.assistantBrief,
  };

  // ---- MLB Daily Research Summary (Lab SoT — no dataset recalculation) ----
  const mlbDailyResearchSummary = await loadMlbDailyResearchSummary(dateKst);

  // ---- Commands ----
  const commands: { label: string; command: string | null }[] = [
    { label: "MLB Daily Research Builder", command: `npm run research:mlb-daily -- ${dateKst}` },
    { label: "Postgame Pipeline (결과+채점+리뷰)", command: `npm run research:postgame -- ${dateKst}` },
    { label: "Starter Dataset 수집", command: `npm run research:starter -- ${dateKst}` },
    { label: "Bullpen Dataset 수집", command: `npm run research:bullpen -- ${dateKst}` },
    { label: "Lineup Dataset 수집", command: `npm run research:lineup -- ${dateKst}` },
    { label: "Pipeline Status 확인", command: `npm run research:status -- ${dateKst}` },
    { label: "Ops Pipeline", command: `npm run research:ops -- ${dateKst}` },
    { label: "Coverage Dashboard", command: `npm run research:dashboard -- ${dateKst}` },
    { label: "Feedback/Learning 갱신", command: `npm run refresh:feedback-learning -- ${dateKst}` },
  ];

  // ---- Source artifacts ----
  const artifactList = [
    { name: "Prediction Snapshot", result: pred },
    { name: "Review", result: review },
    { name: "Starter Dataset", result: starter },
    { name: "Bullpen Dataset", result: bullpen },
    { name: "Odds History", result: odds },
    { name: "Weather", result: weather },
    { name: "Travel/Rest", result: travel },
    { name: "Baseline Analysis", result: baseline },
    { name: "Betting Line Filter", result: bettingFilter },
  ];
  const sourceArtifacts: ResearchLabData["sourceArtifacts"] = artifactList.map((a) => ({
    name: a.name,
    path: path.relative(cwd, a.result.path).replace(/\\/g, "/"),
    status: a.result.ok
      ? "OK"
      : a.result.error === "FILE_NOT_FOUND"
        ? "NOT_CREATED"
        : a.result.error,
    displayStatus: a.result.ok
      ? "사용 가능"
      : a.result.error === "FILE_NOT_FOUND"
        ? formatOpsStatusLabel("FILE_NOT_FOUND")
        : a.result.error,
  }));
  for (const a of kboOps.sourceArtifacts) {
    sourceArtifacts.push({
      name: a.name,
      path: a.path,
      status: a.status,
      displayStatus: a.displayStatus,
    });
  }
  sourceArtifacts.unshift({
    name: "MLB Daily Research Summary",
    path: `data/research/mlb/${dateKst}-daily-research-summary-v1.json`,
    status:
      mlbDailyResearchSummary.kind === "ok" ||
      mlbDailyResearchSummary.kind === "pipeline_failed"
        ? "OK"
        : mlbDailyResearchSummary.kind === "missing"
          ? "NOT_CREATED"
          : mlbDailyResearchSummary.kind === "unsupported"
            ? "UNSUPPORTED_VERSION"
            : "INVALID",
    displayStatus:
      mlbDailyResearchSummary.kind === "missing"
        ? formatOpsStatusLabel("FILE_NOT_FOUND")
        : undefined,
  });

  return {
    dateKst,
    generatedAt: now,
    summary: {
      totalGames,
      predictionCompletedGames: totalGames,
      predictionPendingGames: 0,
      passGames: passCount || null,
      strictEdgePickGames: 0,
      researchCandidateGames: candidateCount || null,
      baselineCandidateGames: candidateCount || null,
      marketConflictGames: marketConflictCount || null,
      finalGames: gradedCount || null,
      pendingResultGames: pendingResultCount || null,
      gradedGames: gradedCount || null,
      reviewPendingGames: gradedCount || null,
      hitGames: hitCount || null,
      missGames: missCount || null,
      accuracy,
      postponedGames: postponedCount || null,
      voidGames: cancelledCount || null,
    },
    pipelines,
    starterHealth: {
      status: !starter.ok
        ? starter.error === "FILE_NOT_FOUND"
          ? "NOT_CREATED"
          : "WARNING"
        : missingStarters != null && missingStarters > 0
          ? "PARTIAL"
          : "COMPLETE",
      expectedRows: num(starterSummary.totalRows),
      collectedRows: num(starterSummary.probableRows),
      missingRows: num(starterSummary.missingRows),
      probableCount: num(starterSummary.probableRows),
      missingProbableCount: num(starterSummary.missingRows),
      artifactUpdatedAt: starter.ok ? starter.updatedAt : null,
      sourceArtifact: starter.ok ? path.relative(cwd, starter.path) : null,
      warningCodes: starterWarnings,
    },
    kboReadiness,
    kboOps,
    mlbDailyResearchSummary,
    tasks,
    missedItems,
    reviewQueue: {
      totalReviewRows: reviewGames.length || null,
      pendingReviewRows: reviewGames.length || null,
      completedReviewRows: 0,
      hitReviewRows: num(reviewSummary.hits),
      missReviewRows: num(reviewSummary.fails),
      topCandidates,
    },
    commands,
    sourceArtifacts,
    errors,
    waitingStates,
  };
}
