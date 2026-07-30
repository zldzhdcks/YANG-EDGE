/**
 * EDGE Assistant v0 — Rule-based research operations assistant.
 *
 * No external LLM. No free-text inference.
 * Deterministic answers from Artifact state + Task state.
 */

import type { ResearchLabData, Severity } from "./research-lab-reader";
import type { OperatorPresentation, OperatorActionCard } from "./research-lab-presenter";
import type { TaskStateEntry, UserStatus } from "./research-task-state";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QuestionId =
  | "QUESTION_TODAY_PRIORITY"
  | "QUESTION_OPEN_PROBLEMS"
  | "QUESTION_MLB_STATUS"
  | "QUESTION_KBO_READINESS"
  | "QUESTION_WHY_PRIORITY"
  | "QUESTION_WHAT_CHANGED";

export type QuestionDef = {
  id: QuestionId;
  label: string;
};

export const SUPPORTED_QUESTIONS: QuestionDef[] = [
  { id: "QUESTION_TODAY_PRIORITY", label: "오늘 뭐부터 해야 해?" },
  { id: "QUESTION_OPEN_PROBLEMS", label: "아직 해결하지 않은 문제는?" },
  { id: "QUESTION_MLB_STATUS", label: "MLB 상태는 어때?" },
  { id: "QUESTION_KBO_READINESS", label: "KBO 분석 준비됐어?" },
  { id: "QUESTION_WHY_PRIORITY", label: "왜 이 작업이 우선이야?" },
  { id: "QUESTION_WHAT_CHANGED", label: "오늘 무엇이 바뀌었어?" },
];

export type EvidenceItem = {
  fact: string;
  source: string | null;
};

export type AssistantAnswer = {
  answerTitle: string;
  answerSummary: string;
  evidence: EvidenceItem[];
  unknowns: string[];
  nextAction: string;
  relatedTaskKey: string | null;
  sourceArtifacts: string[];
};

export type AssistantBrief = {
  greeting: string;
  primaryRecommendation: string;
  primaryReason: string;
  secondaryRecommendation: string | null;
  warnings: string[];
  currentDateKst: string;
  sourceUpdatedAt: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TaskStates = Record<string, TaskStateEntry>;

function sortedOpenCards(
  cards: OperatorActionCard[],
  taskStates: TaskStates,
): OperatorActionCard[] {
  const priorityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
  return [...cards]
    .filter((c) => c.systemStatus === "OPEN")
    .sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 9;
      const pb = priorityOrder[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
      const ua = taskStates[a.taskKey]?.userStatus;
      const ub = taskStates[b.taskKey]?.userStatus;
      if (ua === "IN_PROGRESS" && ub !== "IN_PROGRESS") return -1;
      if (ub === "IN_PROGRESS" && ua !== "IN_PROGRESS") return 1;
      if (ua === "DEFERRED") return 1;
      if (ub === "DEFERRED") return -1;
      return 0;
    });
}

function cardEvidence(data: ResearchLabData, card: OperatorActionCard): EvidenceItem[] {
  const ev: EvidenceItem[] = [];
  ev.push({ fact: card.situation, source: null });
  if (card.relatedGame) ev.push({ fact: `관련 경기: ${card.relatedGame}`, source: null });

  const src = data.sourceArtifacts.find(
    (a) => a.status === "OK" && card.command?.includes(a.path.split("/").pop()?.split(".")[0] ?? "__"),
  );
  if (src) ev.push({ fact: `Artifact: ${src.name}`, source: src.path });
  return ev;
}

function getCardUnknowns(card: OperatorActionCard): string[] {
  switch (card.taskType) {
    case "STARTER_MISSING":
      return ["Provider 수집 실패인지 Join 실패인지 확인되지 않음"];
    case "POSTPONED_GAME":
      return ["재편성 경기의 새 gameId가 아직 확인되지 않음"];
    case "PENDING_RESULT":
      return ["경기 종료 시각이 확인되지 않음"];
    case "VALUE_EDGE_UNVERIFIED":
      return ["fallback 계산이 사용되었는지 확인 필요"];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Brief
// ---------------------------------------------------------------------------

export function buildAssistantBrief(
  data: ResearchLabData,
  op: OperatorPresentation,
  taskStates: TaskStates,
): AssistantBrief {
  const warnings: string[] = [];

  // Check for OPEN+COMPLETED conflicts
  for (const card of op.actionCards) {
    const us = taskStates[card.taskKey]?.userStatus;
    if (card.systemStatus === "OPEN" && (us === "COMPLETED" || us === "ACKNOWLEDGED")) {
      warnings.push("확인 완료로 표시했지만 시스템 문제는 아직 남아 있습니다.");
      break;
    }
  }

  const inProgress = op.actionCards.find(
    (c) => taskStates[c.taskKey]?.userStatus === "IN_PROGRESS",
  );

  const sorted = sortedOpenCards(op.actionCards, taskStates);
  const top = inProgress ?? sorted[0];

  let primary: string;
  let reason: string;

  if (inProgress) {
    primary = `이미 진행 중인 "${inProgress.title}" 작업을 먼저 마무리하는 것을 추천합니다.`;
    reason = inProgress.reason || inProgress.situation;
  } else if (top) {
    primary = `${top.title}을(를) 먼저 확인하세요.`;
    reason = top.reason || top.situation;
  } else {
    primary = "현재 확인이 필요한 긴급 작업이 없습니다.";
    reason = "모든 Task가 완료되었거나 시스템에서 자동 해결되었습니다.";
  }

  const secondary = sorted.length > 1 && !inProgress
    ? `그 다음: ${sorted[1].title}`
    : null;

  return {
    greeting: "안녕하세요, 찬양님.",
    primaryRecommendation: primary,
    primaryReason: reason,
    secondaryRecommendation: secondary,
    warnings,
    currentDateKst: data.dateKst,
    sourceUpdatedAt: data.generatedAt,
  };
}

// ---------------------------------------------------------------------------
// Answer builders
// ---------------------------------------------------------------------------

export function answerQuestion(
  questionId: QuestionId,
  data: ResearchLabData,
  op: OperatorPresentation,
  taskStates: TaskStates,
): AssistantAnswer {
  switch (questionId) {
    case "QUESTION_TODAY_PRIORITY":
      return answerTodayPriority(data, op, taskStates);
    case "QUESTION_OPEN_PROBLEMS":
      return answerOpenProblems(data, op, taskStates);
    case "QUESTION_MLB_STATUS":
      return answerMlbStatus(data, op);
    case "QUESTION_KBO_READINESS":
      return answerKboReadiness(data);
    case "QUESTION_WHY_PRIORITY":
      return answerWhyPriority(data, op, taskStates);
    case "QUESTION_WHAT_CHANGED":
      return answerWhatChanged(data, op);
  }
}

function answerTodayPriority(
  data: ResearchLabData,
  op: OperatorPresentation,
  taskStates: TaskStates,
): AssistantAnswer {
  const inProgress = op.actionCards.find(
    (c) => taskStates[c.taskKey]?.userStatus === "IN_PROGRESS",
  );
  const sorted = sortedOpenCards(op.actionCards, taskStates);
  const top = inProgress ?? sorted[0];

  if (!top) {
    return {
      answerTitle: "오늘 우선 작업",
      answerSummary: "현재 확인이 필요한 작업이 없습니다.",
      evidence: [],
      unknowns: [],
      nextAction: "새로운 Artifact가 생성되면 다시 확인하세요.",
      relatedTaskKey: null,
      sourceArtifacts: [],
    };
  }

  const summary = inProgress
    ? `이미 진행 중인 "${top.title}" 작업을 먼저 마무리하세요.`
    : `"${top.title}"을(를) 먼저 진행하세요.`;

  return {
    answerTitle: "오늘 우선 작업",
    answerSummary: summary,
    evidence: cardEvidence(data, top),
    unknowns: getCardUnknowns(top),
    nextAction: top.nextAction,
    relatedTaskKey: top.taskKey,
    sourceArtifacts: data.sourceArtifacts.filter((a) => a.status === "OK").map((a) => a.path),
  };
}

function answerOpenProblems(
  data: ResearchLabData,
  op: OperatorPresentation,
  taskStates: TaskStates,
): AssistantAnswer {
  const open = op.actionCards.filter((c) => c.systemStatus === "OPEN");
  const notCompleted = open.filter((c) => {
    const us = taskStates[c.taskKey]?.userStatus;
    return us !== "COMPLETED" && us !== "ACKNOWLEDGED";
  });

  const evidence: EvidenceItem[] = open.map((c) => {
    const us = taskStates[c.taskKey]?.userStatus;
    const tag = us === "COMPLETED" || us === "ACKNOWLEDGED"
      ? " (확인 완료했지만 시스템 미해결)"
      : "";
    return { fact: `${c.priority} · ${c.title}${tag}`, source: null };
  });

  return {
    answerTitle: "미해결 문제",
    answerSummary: open.length === 0
      ? "현재 열린 문제가 없습니다."
      : `${open.length}건의 열린 문제 중 ${notCompleted.length}건이 아직 처리되지 않았습니다.`,
    evidence,
    unknowns: [],
    nextAction: notCompleted.length > 0
      ? `"${notCompleted[0].title}"부터 확인하세요.`
      : "모든 문제를 확인했습니다. 시스템 해결을 기다리세요.",
    relatedTaskKey: notCompleted[0]?.taskKey ?? null,
    sourceArtifacts: [],
  };
}

function answerMlbStatus(
  data: ResearchLabData,
  op: OperatorPresentation,
): AssistantAnswer {
  const s = data.summary;
  const rs = op.resultSummary;
  const evidence: EvidenceItem[] = [];

  if (s.totalGames != null) {
    evidence.push({ fact: `총 ${s.totalGames}경기`, source: null });
  }
  if (s.gradedGames != null) {
    evidence.push({ fact: `채점 완료 ${s.gradedGames}경기`, source: null });
  }
  if (s.pendingResultGames != null && s.pendingResultGames > 0) {
    evidence.push({ fact: `종료 대기 ${s.pendingResultGames}경기`, source: null });
  }
  if (s.postponedGames != null && s.postponedGames > 0) {
    evidence.push({ fact: `연기 ${s.postponedGames}경기`, source: null });
  }
  if (rs.accuracy != null) {
    evidence.push({ fact: `적중률 ${rs.accuracy}% (단일 날짜)`, source: null });
  }
  if (data.starterHealth.missingRows != null && data.starterHealth.missingRows > 0) {
    evidence.push({
      fact: `선발투수 ${data.starterHealth.missingRows}명 누락`,
      source: data.starterHealth.sourceArtifact,
    });
  }

  const pipelineSummary = op.pipelineGroups
    .map((g) => `${g.label}: ${g.status}`)
    .join(" · ");
  evidence.push({ fact: pipelineSummary, source: null });

  let summary: string;
  if (s.totalGames == null) {
    summary = "MLB Prediction Artifact가 없어 상태를 확인할 수 없습니다.";
  } else if (s.gradedGames === s.totalGames) {
    summary = `MLB ${s.totalGames}경기 연구가 모두 완료되었습니다.`;
  } else {
    summary = `MLB ${s.totalGames}경기 중 ${s.gradedGames ?? 0}경기 채점 완료.`;
  }

  return {
    answerTitle: "MLB 상태",
    answerSummary: summary,
    evidence,
    unknowns: s.pendingResultGames != null && s.pendingResultGames > 0
      ? ["종료 대기 경기의 종료 시각이 확인되지 않음"]
      : [],
    nextAction: s.pendingResultGames != null && s.pendingResultGames > 0
      ? "경기 종료 후 postgame pipeline 재실행"
      : data.starterHealth.missingRows != null && data.starterHealth.missingRows > 0
        ? "Starter Dataset 재수집 확인"
        : "추가 확인 사항 없음",
    relatedTaskKey: null,
    sourceArtifacts: data.sourceArtifacts.filter((a) => a.status === "OK").map((a) => a.path),
  };
}

function answerKboReadiness(data: ResearchLabData): AssistantAnswer {
  const kr = data.kboReadiness;
  const evidence: EvidenceItem[] = [];

  function fmtCount(got: number | null, total: number | null): string {
    if (got == null && total == null) return "MISSING";
    return `${got ?? 0} / ${total ?? "?"}`;
  }

  evidence.push({ fact: `Schedule: ${kr.scheduleGames ?? "MISSING"}경기`, source: null });
  evidence.push({ fact: `국내 배당: ${fmtCount(kr.domesticOddsGames, kr.domesticOddsTotal)}`, source: null });
  evidence.push({ fact: `해외 배당: ${fmtCount(kr.overseasOddsGames, kr.overseasOddsTotal)}`, source: null });
  evidence.push({ fact: `선발: ${fmtCount(kr.starterGames, kr.starterTotal)}`, source: null });
  evidence.push({ fact: `라인업: ${kr.lineupStatus}`, source: null });
  evidence.push({ fact: `불펜: ${kr.bullpenStatus}`, source: null });
  evidence.push({ fact: `Prediction: ${kr.predictionStatus}`, source: null });

  const unknowns: string[] = [];
  if (kr.lineupStatus === "UNKNOWN") unknowns.push("KBO Lineup Artifact 반영 여부 확인 필요");
  if (kr.bullpenStatus === "UNKNOWN") unknowns.push("KBO Bullpen Artifact 반영 여부 확인 필요");
  if (kr.predictionStatus === "UNKNOWN") unknowns.push("KBO Prediction 생성 여부 확인 필요");
  unknowns.push("라인업 이미지가 확인되었더라도 프로젝트 Artifact 반영은 별도 확인 필요");

  let summary: string;
  if (kr.overallStatus === "READY") {
    summary = "KBO 분석 준비가 완료되었습니다.";
  } else if (kr.overallStatus === "PARTIAL") {
    summary = "KBO 분석 준비가 일부만 완료되었습니다.";
  } else if (kr.overallStatus === "BLOCKED") {
    summary = "KBO 분석을 시작할 수 없습니다. 필수 데이터가 없습니다.";
  } else {
    summary = "KBO 분석 준비 상태를 완전히 확인할 수 없습니다.";
  }

  if (kr.predictionLock.locked) {
    summary += ` Prediction 시작 불가: ${kr.predictionLock.reasons.join(", ")}.`;
  }

  let nextAction: string;
  if (kr.predictionLock.locked) {
    nextAction = `다음 항목 해결 필요: ${kr.predictionLock.reasons.join(", ")}`;
  } else if (kr.overallStatus === "READY") {
    nextAction = "Prediction 실행 가능";
  } else {
    nextAction = "KBO Artifact 생성 또는 기존 Pipeline 상태 확인";
  }

  return {
    answerTitle: "KBO 분석 준비 상태",
    answerSummary: summary,
    evidence,
    unknowns,
    nextAction,
    relatedTaskKey: null,
    sourceArtifacts: data.sourceArtifacts
      .filter((a) => a.name.startsWith("KBO") && a.status === "OK")
      .map((a) => a.path),
  };
}

function answerWhyPriority(
  data: ResearchLabData,
  op: OperatorPresentation,
  taskStates: TaskStates,
): AssistantAnswer {
  const sorted = sortedOpenCards(op.actionCards, taskStates);
  const top = sorted[0];

  if (!top) {
    return {
      answerTitle: "우선순위 설명",
      answerSummary: "현재 열린 작업이 없습니다.",
      evidence: [],
      unknowns: [],
      nextAction: "추가 확인 사항 없음",
      relatedTaskKey: null,
      sourceArtifacts: [],
    };
  }

  const reasons: EvidenceItem[] = [
    { fact: `우선도: ${top.priority}`, source: null },
    { fact: `시스템 상태: ${top.systemStatus}`, source: null },
  ];

  if (top.taskType === "POSTPONED_GAME") {
    reasons.push({
      fact: "연기 경기는 당장 결과 재수집이 불필요합니다. 다음 일정 identity 확인 시점이 중요합니다.",
      source: null,
    });
  } else if (top.taskType === "STARTER_MISSING") {
    reasons.push({
      fact: "선발투수 누락은 분석 신뢰도에 직접 영향을 줍니다.",
      source: null,
    });
  } else if (top.taskType === "REVIEW_PENDING") {
    reasons.push({
      fact: "리뷰는 채점 완료 후 검토하는 것이 효율적입니다.",
      source: null,
    });
  } else if (top.taskType === "VALUE_EDGE_UNVERIFIED") {
    reasons.push({
      fact: "Value Edge 미검증은 운영 중단 사유가 아닙니다. 별도 감사 작업으로 분류됩니다.",
      source: null,
    });
  }

  const inProgressOther = op.actionCards.find(
    (c) => taskStates[c.taskKey]?.userStatus === "IN_PROGRESS" && c.taskKey !== top.taskKey,
  );
  if (inProgressOther) {
    reasons.push({
      fact: `참고: "${inProgressOther.title}"이 현재 진행 중입니다.`,
      source: null,
    });
  }

  return {
    answerTitle: "우선순위 설명",
    answerSummary: `"${top.title}"이(가) 현재 가장 높은 우선순위입니다.`,
    evidence: reasons,
    unknowns: getCardUnknowns(top),
    nextAction: top.nextAction,
    relatedTaskKey: top.taskKey,
    sourceArtifacts: [],
  };
}

function answerWhatChanged(
  data: ResearchLabData,
  op: OperatorPresentation,
): AssistantAnswer {
  const evidence: EvidenceItem[] = [];

  // Report artifact timestamps we have
  for (const a of data.sourceArtifacts) {
    if (a.status === "OK") {
      evidence.push({ fact: `${a.name}: 존재함`, source: a.path });
    } else {
      evidence.push({ fact: `${a.name}: ${a.status}`, source: a.path });
    }
  }

  // Pipeline statuses that are notable
  for (const p of data.pipelines) {
    if (p.status === "PARTIAL" || p.status === "WARNING" || p.status === "FILE_NOT_FOUND") {
      evidence.push({ fact: `${p.pipelineName}: ${p.status} — ${p.message}`, source: p.sourceArtifact });
    }
  }

  return {
    answerTitle: "오늘 변경사항",
    answerSummary:
      "이전 상태 기록이 없어 변경 전후를 비교할 수 없습니다. " +
      "현재 확인 가능한 Artifact 상태를 아래에 표시합니다.",
    evidence,
    unknowns: [
      "이전 Snapshot이 저장되지 않아 diff 불가",
      "Task userStatus 변경 이력은 localStorage에만 존재",
    ],
    nextAction: "향후 Snapshot 비교 기능이 추가되면 변경 내역을 자동 표시할 수 있습니다.",
    relatedTaskKey: null,
    sourceArtifacts: data.sourceArtifacts.filter((a) => a.status === "OK").map((a) => a.path),
  };
}
