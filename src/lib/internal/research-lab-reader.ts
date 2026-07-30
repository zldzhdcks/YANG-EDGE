import "server-only";
import { readFile } from "node:fs/promises";
import { stat } from "node:fs/promises";
import path from "node:path";

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
  | "FILE_NOT_FOUND";

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
    domesticOddsGames: number | null;
    domesticOddsTotal: number | null;
    overseasOddsGames: number | null;
    overseasOddsTotal: number | null;
    starterGames: number | null;
    starterTotal: number | null;
    lineupStatus: KboArtifactStatus;
    bullpenStatus: KboArtifactStatus;
    predictionStatus: KboArtifactStatus;
    oddsArtifactUpdatedAt: string | null;
    scheduleArtifactUpdatedAt: string | null;
    starterArtifactUpdatedAt: string | null;
    overallStatus: "READY" | "PARTIAL" | "BLOCKED" | "UNKNOWN";
    predictionLock: { locked: boolean; reasons: string[] };
    bettingLinePipeline: KboPipelineStageStatus[];
    bugBoardItems: KboBugBoardItem[];
  };
  commands: { label: string; command: string | null }[];
  sourceArtifacts: { name: string; path: string; status: string }[];
  errors: string[];
};

export type KboArtifactStatus = "READY" | "PARTIAL" | "MISSING" | "NOT_AVAILABLE" | "UNKNOWN";

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

  if (!pred.ok) errors.push(`Prediction: ${pred.error}`);
  if (!review.ok) errors.push(`Review: ${review.error}`);
  if (!starter.ok) errors.push(`Starter: ${starter.error}`);

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
  function fileStatus(r: ReadResult<unknown>): PipelineStatus {
    if (!r.ok) return r.error === "FILE_NOT_FOUND" ? "FILE_NOT_FOUND" : "WARNING";
    return "COMPLETE";
  }
  function makeCard(
    name: string,
    r: ReadResult<unknown>,
    completed: number | null,
    total: number | null,
    msg?: string,
  ): PipelineCard {
    let s = fileStatus(r);
    if (s === "COMPLETE" && completed != null && total != null && completed < total) {
      s = "PARTIAL";
    }
    return {
      pipelineName: name,
      status: s,
      completedCount: completed,
      totalCount: total,
      message: !r.ok ? r.error : msg ?? "OK",
      sourceArtifact: r.path ? path.relative(cwd, r.path) : null,
      updatedAt: r.ok ? r.updatedAt : null,
    };
  }

  const pipelines: PipelineCard[] = [
    makeCard("Schedule", baseline, null, null, str(predMeta.note) ?? ""),
    makeCard("Starter", starter, num(starterSummary.probableRows), num(starterSummary.totalRows)),
    makeCard(
      "Bullpen",
      bullpen,
      bullpen.ok ? num(rec((bullpen.data as Pred).summary)?.totalRows) : null,
      null,
    ),
    makeCard("Odds", odds, null, null),
    makeCard("Weather", weather, null, null),
    makeCard("Travel", travel, null, null),
    makeCard("Prediction", pred, num(predSummary.total), num(predSummary.total)),
    makeCard("Result", pred, gradedCount, totalGames, `graded=${gradedCount} pending=${pendingResultCount}`),
    makeCard("Grade", review, num(reviewSummary.graded), num(reviewSummary.total)),
    makeCard("Review", review, 0, num(reviewSummary.total), "All PENDING_REVIEW"),
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

  // ---- KBO Readiness ----
  const kboOddsPath = path.join(cwd, "data", "research", "kbo", `${dateKst}-odds-comparison-v1.json`);
  const kboSchedulePath = path.join(cwd, "data", "research", "kbo", `${dateKst}-schedule-result-identity-v1-api-baseball.json`);
  const kboStarterPath = path.join(cwd, "data", "operator-input", "kbo", `${dateKst}-starter-confirmation-v1.json`);
  const kboLineupPath = path.join(cwd, "data", "operator-input", "kbo", `${dateKst}-lineup-confirmation-v1.json`);

  const kboOdds = await readJsonFile<Record<string, unknown>>(kboOddsPath);
  const kboSchedule = await readJsonFile<Record<string, unknown>>(kboSchedulePath);
  const kboStarter = await readJsonFile<Record<string, unknown>>(kboStarterPath);
  const kboLineup = await readJsonFile<Record<string, unknown>>(kboLineupPath);

  const kboOddsSummary = kboOdds.ok ? rec((kboOdds.data as Record<string, unknown>).summary) ?? {} : {};
  const kboScheduleSummary = kboSchedule.ok ? rec((kboSchedule.data as Record<string, unknown>).summary) ?? {} : {};
  const kboStarterGames = kboStarter.ok ? arr((kboStarter.data as Record<string, unknown>).games) : [];
  const kboLineupGames = kboLineup.ok ? arr((kboLineup.data as Record<string, unknown>).games) : [];

  const kboScheduleGames = num(kboScheduleSummary.datasetGamesCreated);
  const kboDomesticGames = num(kboOddsSummary.domesticGames);
  const kboDomesticTotal = num(kboOddsSummary.identityGames);
  const kboOverseasGames = num(kboOddsSummary.overseasGamesMatched);
  const kboOverseasTotal = num(kboOddsSummary.identityGames);
  const kboStarterCount = kboStarterGames.length > 0 ? kboStarterGames.length : null;
  const kboStarterTotal = kboScheduleGames;
  const lineupReviewStatus = kboLineup.ok ? str((kboLineup.data as Record<string, unknown>).reviewStatus) : null;

  function kboArtifactStatus(result: ReadResult<unknown>): KboArtifactStatus {
    if (!result.ok) return result.error === "FILE_NOT_FOUND" ? "MISSING" : "UNKNOWN";
    return "READY";
  }

  const kboPipelineStages: KboPipelineStageStatus[] = [];
  // OCR stage — we can't check directly, infer from domestic odds presence
  kboPipelineStages.push({
    stage: "OCR",
    status: kboDomesticGames != null && kboDomesticGames > 0 ? "PASS" : "WARN",
    detail: kboDomesticGames != null ? `${kboDomesticGames}경기` : "확인 불가",
  });
  kboPipelineStages.push({
    stage: "Parser",
    status: kboDomesticGames != null && kboDomesticGames > 0 ? "PASS" : "WARN",
    detail: kboDomesticGames != null ? `${kboDomesticGames}경기 파싱` : "확인 불가",
  });
  kboPipelineStages.push({
    stage: "Artifact",
    status: kboOdds.ok ? "PASS" : "FAIL",
    detail: kboOdds.ok ? "파일 존재" : (kboOdds as { error: string }).error,
  });
  kboPipelineStages.push({
    stage: "Reader",
    status: kboOdds.ok ? "PASS" : "FAIL",
    detail: kboOdds.ok ? "로드 성공" : "로드 실패",
  });
  kboPipelineStages.push({
    stage: "Presenter",
    status: kboOdds.ok ? "PASS" : "FAIL",
    detail: kboOdds.ok ? "데이터 전달 가능" : "데이터 없음",
  });
  kboPipelineStages.push({
    stage: "UI",
    status: kboOdds.ok ? "PASS" : "FAIL",
    detail: kboOdds.ok ? "표시 가능" : "표시 불가",
  });

  // Bug board
  const bugBoard: KboBugBoardItem[] = [];
  if (!kboOdds.ok || (kboDomesticGames != null && kboDomesticTotal != null && kboDomesticGames < kboDomesticTotal)) {
    bugBoard.push({
      id: "domestic-odds-missing",
      label: "Domestic Odds Missing",
      severity: !kboOdds.ok ? "RED" : "YELLOW",
      resolved: false,
    });
  } else if (kboDomesticGames != null && kboDomesticGames > 0) {
    bugBoard.push({ id: "domestic-odds-missing", label: "Domestic Odds", severity: "GREEN", resolved: true });
  }

  const hasPostponed = postponedCount > 0;
  bugBoard.push({
    id: "doubleheader-lifecycle",
    label: "Doubleheader Lifecycle",
    severity: hasPostponed ? "YELLOW" : "GREEN",
    resolved: !hasPostponed,
  });

  bugBoard.push({
    id: "mlb-review",
    label: "MLB Review",
    severity: "GREEN",
    resolved: true,
  });

  bugBoard.push({
    id: "starter-pipeline",
    label: "Starter Pipeline",
    severity: (missingStarters != null && missingStarters > 0) ? "YELLOW" : "GREEN",
    resolved: !(missingStarters != null && missingStarters > 0),
  });

  // Prediction lock
  const lockReasons: string[] = [];
  if (!kboOdds.ok || kboDomesticGames === 0) lockReasons.push("Domestic Odds Missing");
  if (!kboStarter.ok || kboStarterCount === 0) lockReasons.push("Starter Missing");
  if (!kboSchedule.ok || kboScheduleGames === 0) lockReasons.push("Game Identity Missing");
  if (errors.length > 0) lockReasons.push("Reader Error");

  // Overall readiness
  type KboOverall = "READY" | "PARTIAL" | "BLOCKED" | "UNKNOWN";
  let kboOverall: KboOverall = "UNKNOWN";
  if (kboSchedule.ok && kboOdds.ok && kboStarter.ok) {
    const domesticOk = kboDomesticGames != null && kboDomesticTotal != null && kboDomesticGames >= kboDomesticTotal;
    const overseasOk = kboOverseasGames != null && kboOverseasTotal != null && kboOverseasGames >= kboOverseasTotal;
    const starterOk = kboStarterCount != null && kboStarterTotal != null && kboStarterCount >= kboStarterTotal;
    if (domesticOk && overseasOk && starterOk) kboOverall = "READY";
    else kboOverall = "PARTIAL";
  } else if (kboSchedule.ok) {
    kboOverall = "PARTIAL";
  } else {
    kboOverall = "BLOCKED";
  }
  if (lockReasons.length > 0 && kboOverall === "READY") kboOverall = "PARTIAL";

  const kboLineupStatus: KboArtifactStatus =
    !kboLineup.ok
      ? kboLineup.error === "FILE_NOT_FOUND"
        ? "MISSING"
        : "UNKNOWN"
      : lineupReviewStatus === "CONFIRMED"
        ? "READY"
        : lineupReviewStatus === "PARTIAL"
          ? "PARTIAL"
          : "MISSING";

  const kboReadiness = {
    scheduleGames: kboScheduleGames,
    domesticOddsGames: kboDomesticGames,
    domesticOddsTotal: kboDomesticTotal,
    overseasOddsGames: kboOverseasGames,
    overseasOddsTotal: kboOverseasTotal,
    starterGames: kboStarterCount,
    starterTotal: kboStarterTotal,
    lineupStatus: kboLineupStatus,
    bullpenStatus: "UNKNOWN" as KboArtifactStatus,
    predictionStatus: "UNKNOWN" as KboArtifactStatus,
    oddsArtifactUpdatedAt: kboOdds.ok ? kboOdds.updatedAt : null,
    scheduleArtifactUpdatedAt: kboSchedule.ok ? kboSchedule.updatedAt : null,
    starterArtifactUpdatedAt: kboStarter.ok ? kboStarter.updatedAt : null,
    overallStatus: kboOverall,
    predictionLock: { locked: lockReasons.length > 0, reasons: lockReasons },
    bettingLinePipeline: kboPipelineStages,
    bugBoardItems: bugBoard,
  };

  // Add KBO source artifacts
  const kboArtifactList = [
    { name: "KBO Odds Comparison", result: kboOdds },
    { name: "KBO Schedule Identity", result: kboSchedule },
    { name: "KBO Starter Confirmation", result: kboStarter },
    { name: "KBO Lineup Confirmation", result: kboLineup },
  ];

  // ---- Commands ----
  const commands: { label: string; command: string | null }[] = [
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
    ...kboArtifactList,
  ];
  const sourceArtifacts = artifactList.map((a) => ({
    name: a.name,
    path: path.relative(cwd, a.result.path),
    status: a.result.ok ? "OK" : a.result.error,
  }));

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
          ? "FILE_NOT_FOUND"
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
  };
}
