import type { ResearchLabData, Severity, KboBugBoardItem } from "./research-lab-reader";

// ---------------------------------------------------------------------------
// Operator-friendly types
// ---------------------------------------------------------------------------

export type OverallStatus = "정상 진행" | "확인 필요" | "작업 필요" | "중요 문제 있음";

export type OperatorSummaryLine = string;

export type OperatorActionCard = {
  id: string;
  taskKey: string;
  taskType: string;
  relatedEntityId: string;
  title: string;
  situation: string;
  reason: string;
  nextAction: string;
  priority: Severity;
  relatedGame: string | null;
  command: string | null;
  systemStatus: "OPEN" | "RESOLVED" | "STALE" | "UNKNOWN";
};

export type PipelineGroup = {
  label: string;
  status: "완료" | "일부 확인 필요" | "대기" | "문제 있음" | "정보 없음";
  pipelines: string[];
  detail: string;
};

export type MissedExplanation = {
  id: string;
  title: string;
  impact: string;
  knownFacts: string;
  unknowns: string;
  nextAction: string;
  severity: Severity;
};

export type OperatorPresentation = {
  overallStatus: OverallStatus;
  summaryLines: OperatorSummaryLine[];
  actionCards: OperatorActionCard[];
  pipelineGroups: PipelineGroup[];
  missedExplanations: MissedExplanation[];
  resultSummary: {
    totalGames: number | null;
    gradedGames: number | null;
    hits: number | null;
    misses: number | null;
    accuracy: number | null;
    passGames: number | null;
    candidateGames: number | null;
    postponedGames: number | null;
    reviewPending: number | null;
  };
  kboReadiness: {
    overallStatus: "READY" | "PARTIAL" | "BLOCKED" | "UNKNOWN";
    domesticOdds: string;
    overseasOdds: string;
    starter: string;
    lineup: string;
    bullpen: string;
    prediction: string;
    predictionLocked: boolean;
    lockReasons: string[];
    bugBoard: KboBugBoardItem[];
  };
};

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export function buildOperatorPresentation(
  data: ResearchLabData,
): OperatorPresentation {
  const s = data.summary;

  // --- Overall status ---
  let overallStatus: OverallStatus = "정상 진행";
  const hasCriticalMissed = data.missedItems.some((m) => m.severity === "CRITICAL");
  const hasHighMissed = data.missedItems.some((m) => m.severity === "HIGH");
  if (hasCriticalMissed) overallStatus = "중요 문제 있음";
  else if (hasHighMissed || data.tasks.some((t) => t.priority === "HIGH"))
    overallStatus = "확인 필요";
  else if (data.tasks.length > 0) overallStatus = "작업 필요";

  // --- Summary lines ---
  const lines: string[] = [];
  if (s.totalGames != null && s.gradedGames != null) {
    if (s.gradedGames === s.totalGames) {
      lines.push(`오늘 MLB ${s.totalGames}경기 연구가 모두 완료되었습니다.`);
    } else {
      lines.push(
        `오늘 MLB ${s.totalGames}경기 중 ${s.gradedGames}경기의 채점이 끝났습니다.`,
      );
    }
  }
  if (s.postponedGames != null && s.postponedGames > 0) {
    lines.push(
      `${s.postponedGames}경기는 기상 악화로 연기되었습니다.`,
    );
  }
  if (s.pendingResultGames != null && s.pendingResultGames > 0) {
    lines.push(
      `${s.pendingResultGames}경기가 아직 종료되지 않았습니다.`,
    );
  }
  const missingStarters = data.starterHealth.missingRows;
  if (missingStarters != null && missingStarters > 0) {
    lines.push(
      `선발투수 정보 ${missingStarters}명이 누락되어 재확인이 필요합니다.`,
    );
  }
  if (s.hitGames != null && s.missGames != null && s.accuracy != null) {
    lines.push(
      `적중 ${s.hitGames} / 실패 ${s.missGames} (${s.accuracy}%)`,
    );
  }

  // --- Action cards ---
  const actions: OperatorActionCard[] = [];
  const dateKst = data.dateKst;

  const taskMeta: Record<string, { type: string; entity: string; title: string; reason: string; next: string; game: string | null; sys: OperatorActionCard["systemStatus"] }> = {
    "postponed-game": { type: "POSTPONED_GAME", entity: "mlb-179616", title: "기상 연기 경기 확인", reason: "오늘 결과를 기다릴 필요가 없습니다. 내일 더블헤더 2경기가 신규 경기로 등록되는지 확인해야 합니다.", next: "내일 일정 수집 후 Game 1 / Game 2 identity 확인", game: "mlb-179616 (Braves @ Mets)", sys: "OPEN" },
    "pending-result": { type: "PENDING_RESULT", entity: "mlb-prediction", title: "종료 대기 경기 재채점", reason: "경기가 종료되면 결과를 수집하고 자동 채점을 실행해야 합니다.", next: "경기 종료 후 postgame pipeline 재실행", game: null, sys: "OPEN" },
    "starter-missing": { type: "STARTER_MISSING", entity: "starter-dataset-v1", title: "선발투수 정보 누락 확인", reason: "선발 관련 분석의 신뢰도가 낮아질 수 있습니다.", next: "Starter Dataset 재수집 후 동일 인원인지 확인", game: null, sys: "OPEN" },
    "review-pending": { type: "REVIEW_PENDING", entity: "mlb-review", title: "리뷰 검토 필요", reason: "채점 완료 경기의 성공/실패 원인 검수가 운영 판단에 도움됩니다.", next: "Review Queue에서 주요 경기 검수", game: null, sys: "OPEN" },
    "cancelled-game": { type: "CANCELLED_GAME", entity: "mlb-prediction", title: "취소 경기 채점 제외 확인", reason: "취소된 경기의 채점 제외 상태를 확인해야 합니다.", next: "채점 제외 확인", game: null, sys: "OPEN" },
    "value-edge-unverified": { type: "VALUE_EDGE_UNVERIFIED", entity: "mlb-prediction", title: "Value Edge 출처 확인 필요", reason: "배당 정보 없이 계산된 Value Edge가 있습니다.", next: "별도 감사 미션으로 출처 확인", game: null, sys: "OPEN" },
  };

  for (const t of data.tasks) {
    const meta = taskMeta[t.taskId];
    if (meta) {
      actions.push({
        id: t.taskId,
        taskKey: `${dateKst}:${meta.type}:${meta.entity}`,
        taskType: meta.type,
        relatedEntityId: meta.entity,
        title: meta.title,
        situation: t.description,
        reason: meta.reason,
        nextAction: meta.next,
        priority: t.priority,
        relatedGame: meta.game,
        command: t.recommendedCommand,
        systemStatus: meta.sys,
      });
    } else {
      actions.push({
        id: t.taskId,
        taskKey: `${dateKst}:OTHER:${t.taskId}`,
        taskType: "OTHER",
        relatedEntityId: t.taskId,
        title: t.title,
        situation: t.description,
        reason: "",
        nextAction: "",
        priority: t.priority,
        relatedGame: null,
        command: t.recommendedCommand,
        systemStatus: "OPEN",
      });
    }
  }

  // --- Pipeline groups ---
  const pipelineMap = new Map(data.pipelines.map((p) => [p.pipelineName, p]));

  function groupStatus(names: string[]): PipelineGroup["status"] {
    const cards = names.map((n) => pipelineMap.get(n)).filter(Boolean);
    if (cards.length === 0) return "정보 없음";
    if (cards.every((c) => c!.status === "COMPLETE")) return "완료";
    if (cards.some((c) => c!.status === "WARNING" || c!.status === "FILE_NOT_FOUND"))
      return "문제 있음";
    if (cards.some((c) => c!.status === "PARTIAL")) return "일부 확인 필요";
    if (cards.some((c) => c!.status === "PENDING")) return "대기";
    return "완료";
  }

  function groupDetail(names: string[]): string {
    const cards = names.map((n) => pipelineMap.get(n)).filter(Boolean);
    return cards
      .map((c) => {
        const count =
          c!.completedCount != null && c!.totalCount != null
            ? ` (${c!.completedCount}/${c!.totalCount})`
            : "";
        return `${c!.pipelineName}: ${c!.status}${count}`;
      })
      .join(" · ");
  }

  const pipelineGroups: PipelineGroup[] = [
    {
      label: "경기 준비",
      status: groupStatus(["Schedule"]),
      pipelines: ["Schedule"],
      detail: groupDetail(["Schedule"]),
    },
    {
      label: "경기 전 데이터",
      status: groupStatus(["Starter", "Bullpen", "Odds", "Weather", "Travel"]),
      pipelines: ["Starter", "Bullpen", "Odds", "Weather", "Travel"],
      detail: groupDetail(["Starter", "Bullpen", "Odds", "Weather", "Travel"]),
    },
    {
      label: "분석",
      status: groupStatus(["Prediction"]),
      pipelines: ["Prediction"],
      detail: groupDetail(["Prediction"]),
    },
    {
      label: "경기 결과",
      status: groupStatus(["Result", "Grade"]),
      pipelines: ["Result", "Grade"],
      detail: groupDetail(["Result", "Grade"]),
    },
    {
      label: "리뷰",
      status: groupStatus(["Review"]),
      pipelines: ["Review"],
      detail: groupDetail(["Review"]),
    },
  ];

  // --- Missed explanations ---
  const explanations: MissedExplanation[] = [];

  for (const m of data.missedItems) {
    if (m.id === "postponed-game") {
      explanations.push({
        id: m.id,
        title: "기상 연기 경기",
        impact: "해당 경기는 채점 대상에서 제외됩니다.",
        knownFacts: `${m.reason}`,
        unknowns: "재편성 경기의 새 gameId가 아직 확인되지 않았습니다.",
        nextAction: "내일 일정 수집 후 더블헤더 identity 확인",
        severity: m.severity,
      });
    } else if (m.id === "starter-missing") {
      explanations.push({
        id: m.id,
        title: `선발투수 정보 ${m.count ?? "?"}명 누락`,
        impact: "선발 관련 분석의 신뢰도가 낮아질 수 있습니다.",
        knownFacts: `총 ${data.starterHealth.expectedRows ?? "?"}명 중 ${data.starterHealth.collectedRows ?? "?"}명 확보`,
        unknowns: "Provider 수집 실패인지 Join 실패인지 구분되지 않음",
        nextAction: "Starter Dataset 재수집 후 동일 인원인지 확인",
        severity: m.severity,
      });
    } else if (m.id === "value-edge-unverified") {
      explanations.push({
        id: m.id,
        title: `Value Edge 출처 미검증 ${m.count ?? "?"}건`,
        impact: "Value Edge 수치의 신뢰도를 검증할 수 없습니다.",
        knownFacts: `${m.count ?? "?"}경기에서 openingOdds가 null`,
        unknowns: "fallback 계산이 사용되었는지 확인 필요",
        nextAction: "별도 감사 미션으로 Value Edge 출처 확인",
        severity: m.severity,
      });
    } else {
      explanations.push({
        id: m.id,
        title: m.label,
        impact: m.reason,
        knownFacts: m.count != null ? `${m.count}건 감지` : "수량 미확인",
        unknowns: "",
        nextAction: "",
        severity: m.severity,
      });
    }
  }

  // --- KBO readiness for operator ---
  const kr = data.kboReadiness;
  function fmtCount(got: number | null, total: number | null): string {
    if (got == null && total == null) return "MISSING";
    if (got == null) return `0 / ${total ?? "?"}`;
    if (total == null) return `${got}`;
    return `${got} / ${total}`;
  }

  return {
    overallStatus,
    summaryLines: lines,
    actionCards: actions,
    pipelineGroups,
    missedExplanations: explanations,
    resultSummary: {
      totalGames: s.totalGames,
      gradedGames: s.gradedGames,
      hits: s.hitGames,
      misses: s.missGames,
      accuracy: s.accuracy,
      passGames: s.passGames,
      candidateGames: s.baselineCandidateGames,
      postponedGames: s.postponedGames ?? null,
      reviewPending: s.reviewPendingGames,
    },
    kboReadiness: {
      overallStatus: kr.overallStatus,
      domesticOdds: fmtCount(kr.domesticOddsGames, kr.domesticOddsTotal),
      overseasOdds: fmtCount(kr.overseasOddsGames, kr.overseasOddsTotal),
      starter: fmtCount(kr.starterGames, kr.starterTotal),
      lineup: kr.lineupStatus,
      bullpen: kr.bullpenStatus,
      prediction: kr.predictionStatus,
      predictionLocked: kr.predictionLock.locked,
      lockReasons: kr.predictionLock.reasons,
      bugBoard: kr.bugBoardItems,
    },
  };
}
