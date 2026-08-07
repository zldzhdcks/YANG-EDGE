/**
 * Build Operation Memory v0 view from loaded sources + OS presentation.
 * Never invents scores; never marks AI proposals as APPROVED.
 */
import type { YangEdgeOsPresentation } from "../yang-edge-os-presenter";
import { buildFootballIdentityOperationSlice } from "@/lib/football/foundation";
import { buildDefaultFootballOddsView } from "@/lib/football/odds-foundation-v0";
import { buildDefaultFootballResultView } from "@/lib/football/result-foundation-v0";
import { buildDefaultFootballReviewScorecardView } from "@/lib/football/review-scorecard-foundation-v0";
import {
  APPROVAL_REQUEST_REGISTRY_V0,
  DECISION_LOG_REGISTRY_V0,
  listApprovedDecisions,
} from "./decision-registry";
import type { OperationMemorySourcesLoaded } from "./load-operation-memory";
import type {
  OperationMemoryItem,
  OperationMemoryV0,
  OperationRisk,
} from "./types";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function isInvalidPregame(validity: Record<string, unknown> | null): boolean {
  return asString(validity?.researchValidity) === "INVALID_FOR_PREGAME";
}

/** Owner-facing copy for known developer codes. */
export function plainLanguageForCode(code: string): string {
  const map: Record<string, string> = {
    MULTIPLE_PREGAME_GATES_FAILED:
      "경기 시작 후 예측이 만들어졌고 해외 배당과 선발 무결성도 부족해, 이번 예측은 연구 표본에서 제외했습니다.",
    LATE_OBSERVATION_INVALID_FOR_PREGAME:
      "경기가 이미 시작된 뒤에 예측이 만들어져, Pregame 연구 표본으로 쓰지 않습니다.",
    ODDS_MISSING_ALL:
      "오늘 해외 배당을 가져오지 못했습니다. Prediction은 생성하지 않습니다.",
    STARTER_INTEGRITY_FAILED:
      "같은 선발 데이터를 다시 확인했을 때 검증값이 달라져, 예측 입력으로 사용하지 않았습니다.",
    NON_DETERMINISTIC_HASH_INPUT:
      "같은 선발 데이터를 다시 확인했을 때 검증값이 달라져, 예측 입력으로 사용하지 않았습니다.",
    PREDICTION_AFTER_START:
      "경기 시작 시각 이후에 예측이 기록되어 Pregame으로 인정하지 않습니다.",
    BLOCKED_AFTER_START: "경기가 이미 시작된 뒤에는 Prediction Freeze를 하지 않습니다.",
  };
  return map[code] ?? code;
}

export function buildOperationMemoryV0(input: {
  dateKst: string;
  generatedAt?: string;
  sources: OperationMemorySourcesLoaded;
  os: YangEdgeOsPresentation;
}): OperationMemoryV0 {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const { sources, os, dateKst } = input;
  const invalidToday = isInvalidPregame(sources.validity);

  const completed: OperationMemoryItem[] = [];
  const pending: OperationMemoryItem[] = [];
  const blocked: OperationMemoryItem[] = [];
  const achievements: OperationMemoryItem[] = [];
  const failures: OperationMemoryItem[] = [];
  const lessons: OperationMemoryItem[] = [];
  const risks: OperationRisk[] = [];

  // --- From validity / audit (08-03 style) ---
  if (sources.validity && invalidToday) {
    const codes = Array.isArray(sources.validity.reasonCodes)
      ? sources.validity.reasonCodes.map(String)
      : [];
    const primary =
      codes.find((c) => c === "MULTIPLE_PREGAME_GATES_FAILED") ??
      codes[0] ??
      "INVALID_FOR_PREGAME";
    blocked.push({
      id: `blocked-invalid-pregame-${dateKst}`,
      title: "오늘 MLB Prediction은 연구 표본 제외",
      plainLanguage: plainLanguageForCode(
        codes.includes("MULTIPLE_PREGAME_GATES_FAILED")
          ? "MULTIPLE_PREGAME_GATES_FAILED"
          : primary,
      ),
      kind: "FACT",
      sourceRefs: [sources.validityPath!].filter(Boolean),
      dateKst,
      developerCode: codes.join(","),
    });
    failures.push({
      id: `fail-invalid-pregame-${dateKst}`,
      title: "Invalid Pregame Snapshot 격리",
      plainLanguage:
        "늦게 만들어진 예측과 부족한 입력을 정상 연구 표본에 넣지 않도록 격리했습니다.",
      kind: "FACT",
      sourceRefs: [
        sources.validityPath,
        sources.pregameAuditPath,
      ].filter((x): x is string => Boolean(x)),
      dateKst,
      developerCode: "INVALID_FOR_PREGAME",
    });
    lessons.push({
      id: "lesson-artifact-vs-usable",
      title: "파일이 있어도 쓸 수 없을 수 있다",
      plainLanguage:
        "배당 파일이 있어도 수집 0건이면 준비 완료로 보면 안 됩니다. 존재와 사용 가능을 구분합니다.",
      kind: "FACT",
      sourceRefs: [
        "DEC-ARTIFACT-VS-USABLE",
        sources.pregameAuditPath ?? sources.validityPath ?? "",
      ].filter(Boolean),
      dateKst,
      developerCode: null,
    });
    for (const code of [
      "ODDS_MISSING_ALL",
      "STARTER_INTEGRITY_FAILED",
      "LATE_OBSERVATION_INVALID_FOR_PREGAME",
    ]) {
      if (!codes.includes(code)) continue;
      risks.push({
        id: `risk-${code}`,
        title: code === "ODDS_MISSING_ALL" ? "해외 배당 없음" : code === "STARTER_INTEGRITY_FAILED" ? "선발 무결성 실패" : "경기 시작 후 예측",
        plainLanguage: plainLanguageForCode(code),
        level: "BLOCKED",
        sourceRefs: [sources.validityPath!],
        developerCode: code,
      });
    }
  }

  // --- From review summary (valid research days only) ---
  const review = sources.reviewSummary;
  if (review && !invalidToday) {
    const gradeCounts = asRecord(review.gradeCounts);
    const researchGraded = asNumber(gradeCounts?.researchGraded);
    const researchCorrect = asNumber(gradeCounts?.researchCorrect);
    const researchIncorrect = asNumber(gradeCounts?.researchIncorrect);
    const reviewStatus = asString(review.reviewStatus);
    if (reviewStatus === "VALID_REVIEW" && researchGraded != null && researchGraded > 0) {
      completed.push({
        id: `completed-review-${dateKst}`,
        title: `MLB ${dateKst} Review 완료`,
        plainLanguage: `연구 채점 ${researchGraded}경기 관찰 (적중 ${researchCorrect ?? "—"} / 실패 ${researchIncorrect ?? "—"}). 공식 성과가 아닙니다.`,
        kind: "FACT",
        sourceRefs: [sources.reviewPath!],
        dateKst,
        developerCode: null,
      });
      achievements.push({
        id: `ach-review-${dateKst}`,
        title: "Research Review VALID",
        plainLanguage: `${dateKst} 연구 복기가 유효하게 기록되었습니다. Accuracy는 연구 관찰일 뿐입니다.`,
        kind: "FACT",
        sourceRefs: [sources.reviewPath!],
        dateKst,
        developerCode: reviewStatus,
      });
    }
  }

  // Week memory: 08-02 review if present in sources list
  const weekReviewSrc = sources.sources.find(
    (s) => s.id === "review-summary-2026-08-02" && s.present,
  );
  if (weekReviewSrc && dateKst !== "2026-08-02") {
    achievements.push({
      id: "ach-2026-08-02-review",
      title: "MLB 08-02 Research Review 기록",
      plainLanguage:
        "08-02 연구 복기·Scorecard·Review Detail이 저장되어 있습니다. 공식 성과로 해석하지 않습니다.",
      kind: "FACT",
      sourceRefs: [weekReviewSrc.path],
      dateKst: "2026-08-02",
      developerCode: null,
    });
    completed.push({
      id: "completed-0802-review-memory",
      title: "이번 주: 08-02 Review 완료 (기록)",
      plainLanguage: "지난 슬레이트 연구 복기가 저장되어 오늘 기억에 참고로 표시합니다.",
      kind: "FACT",
      sourceRefs: [weekReviewSrc.path],
      dateKst: "2026-08-02",
      developerCode: null,
    });
  }

  const weekValidity = sources.sources.find(
    (s) => s.id === "validity-2026-08-03" && s.present,
  );
  if (weekValidity && dateKst !== "2026-08-03") {
    failures.push({
      id: "fail-0803-invalid",
      title: "08-03 Invalid Pregame 격리",
      plainLanguage:
        "08-03 예측은 연구 표본에서 제외하도록 격리되어 있습니다.",
      kind: "FACT",
      sourceRefs: [weekValidity.path],
      dateKst: "2026-08-03",
      developerCode: "INVALID_FOR_PREGAME",
    });
  }

  // OS UX transition as operational fact if we're past that work (always true in this repo state)
  achievements.push({
    id: "ach-os-ux",
    title: "YANG EDGE OS 운영 UX 구조",
    plainLanguage:
      "Dashboard / Mission / CTO / Research / Developer 화면이 분리되어 있습니다.",
    kind: "FACT",
    sourceRefs: ["src/constants/yang-edge-os-nav.ts"],
    dateKst: null,
    developerCode: null,
  });

  // Pending from OS missions / checklist (facts about open work)
  for (const m of os.missions.slice(0, 8)) {
    if (m.risk === "BLOCKED") {
      blocked.push({
        id: `blocked-mission-${m.id}`,
        title: m.title,
        plainLanguage: m.blockedReason ?? m.nextStep,
        kind: "FACT",
        sourceRefs: ["yang-edge-os-presenter missions"],
        dateKst,
        developerCode: null,
      });
    } else {
      pending.push({
        id: `pending-mission-${m.id}`,
        title: m.title,
        plainLanguage: m.nextStep,
        kind: "FACT",
        sourceRefs: ["yang-edge-os-presenter missions"],
        dateKst,
        developerCode: null,
      });
    }
  }

  // Structural pendings grounded in ROADMAP
  if (sources.roadmapPresent) {
    pending.push({
      id: "pending-next-pregame-freeze",
      title: "다음 MLB Pregame 정상 Freeze",
      plainLanguage: "다음 슬레이트는 경기 시작 전에 Daily Pregame Freeze를 해야 합니다.",
      kind: "FACT",
      sourceRefs: ["ROADMAP.md", sources.validityPath ?? "operation-memory"],
      dateKst: null,
      developerCode: null,
    });
    pending.push({
      id: "pending-football-foundation",
      title: "Football Review/Scorecard · Prediction 대기",
      plainLanguage:
        "Result Foundation 계약 진행 중. Review/Scorecard와 Prediction은 후속 미션입니다.",
      kind: "FACT",
      sourceRefs: ["ROADMAP.md", "src/lib/football/result-foundation-v0/"],
      dateKst: null,
      developerCode: "RESULT_FOUNDATION",
    });
  }

  // Risks from OS
  for (const r of os.risks.slice(0, 5)) {
    risks.push({
      id: `os-risk-${r.id}`,
      title: r.title,
      plainLanguage: r.detail,
      level: r.level,
      sourceRefs: ["yang-edge-os-presenter risks"],
      developerCode: null,
    });
  }

  const approvals = APPROVAL_REQUEST_REGISTRY_V0.slice();
  // Guard: never surface APPROVED on approvalRequests unless registry says so
  for (const a of approvals) {
    if (a.kind === "AI_PROPOSAL" && a.status === "APPROVED") {
      throw new Error("INVARIANT: AI_PROPOSAL must not be APPROVED");
    }
  }

  const decisions = DECISION_LOG_REGISTRY_V0.slice().sort((a, b) =>
    b.decidedAt.localeCompare(a.decidedAt),
  );
  const approved = listApprovedDecisions();

  const aiProposals: OperationMemoryItem[] = approvals
    .filter((a) => a.status === "NEEDS_OWNER_DECISION" || a.kind === "AI_PROPOSAL")
    .map((a) => ({
      id: `proposal-${a.id}`,
      title: a.title,
      plainLanguage: a.plainLanguage,
      kind: "AI_PROPOSAL" as const,
      sourceRefs: a.sourceRefs,
      dateKst: null,
      developerCode: a.status,
    }));

  const footballIdentity = buildFootballIdentityOperationSlice();
  const footballOddsView = buildDefaultFootballOddsView(dateKst);
  const footballOdds = {
    identityStage: footballIdentity.stage,
    oddsStage: footballOddsView.slice.oddsStage,
    prediction: "NONE" as const,
    usableMatchCount: footballOddsView.slice.usableMatchCount,
    blockedReasonPlain: footballOddsView.slice.blockedReasonPlain,
    plainLanguage: footballOddsView.slice.gate.plainLanguage,
    gateStatus: footballOddsView.slice.gate.status,
    progressPercent: null,
    sourceRefs: footballOddsView.slice.sourceRefs,
  };
  const footballResultView = buildDefaultFootballResultView(dateKst, {
    identityStage: footballIdentity.stage,
    oddsStage: footballOdds.oddsStage,
  });
  const footballResult = {
    resultStage: footballResultView.slice.resultStage,
    prediction: "NONE" as const,
    usableFinalCount: footballResultView.slice.usableFinalCount,
    notFinalCount: footballResultView.slice.notFinalCount,
    voidOrCancelledOrPostponedCount:
      footballResultView.slice.voidOrCancelledOrPostponedCount,
    abandonedReviewCount: footballResultView.slice.abandonedReviewCount,
    plainLanguage: footballResultView.slice.plainLanguage,
    gateStatus: footballResultView.slice.gate.status,
    progressPercent: null,
    sourceRefs: footballResultView.slice.sourceRefs,
  };
  const footballReviewView = buildDefaultFootballReviewScorecardView(dateKst);
  const footballReviewScorecard = {
    reviewStage: footballReviewView.slice.reviewStage,
    scorecardStage: footballReviewView.slice.scorecardStage,
    prediction: "NONE" as const,
    plainLanguage: footballReviewView.slice.plainLanguage,
    gateStatus: footballReviewView.slice.gate.status,
    progressPercent: null,
    sourceRefs: footballReviewView.slice.sourceRefs,
  };

  if (footballIdentity.stage === "FOUNDATION" || footballIdentity.stage === "READY") {
    completed.push({
      id: "completed-football-identity-foundation",
      title: "Football Identity Foundation 완료",
      plainLanguage: footballIdentity.plainLanguage,
      kind: "FACT",
      sourceRefs: footballIdentity.sourceRefs,
      dateKst: null,
      developerCode: footballIdentity.stage,
    });
    achievements.push({
      id: "ach-football-identity-foundation",
      title: "Football Identity Foundation",
      plainLanguage: footballIdentity.plainLanguage,
      kind: "FACT",
      sourceRefs: footballIdentity.sourceRefs,
      dateKst: null,
      developerCode: footballIdentity.stage,
    });
  }

  completed.push({
    id: "completed-football-1x2-odds-foundation",
    title: "Football 1X2 Odds Foundation 완료",
    plainLanguage:
      "1X2 계약·Usability Gate·Domestic/Overseas 분리가 정의되었습니다. 실데이터 수집은 별도입니다.",
    kind: "FACT",
    sourceRefs: footballOdds.sourceRefs,
    dateKst: null,
    developerCode: "ODDS_FOUNDATION_CONTRACT",
  });
  achievements.push({
    id: "ach-football-1x2-odds-foundation",
    title: "Football 1X2 Odds Foundation",
    plainLanguage: "Odds Foundation 계약 계층 완료 (실 ingestion 전).",
    kind: "FACT",
    sourceRefs: footballOdds.sourceRefs,
    dateKst: null,
    developerCode: "ODDS_FOUNDATION_CONTRACT",
  });

  completed.push({
    id: "completed-football-result-foundation",
    title: "Football Result Foundation 완료",
    plainLanguage:
      "정규시간 1X2와 advancement 분리·FINAL Gate 계약이 정의되었습니다.",
    kind: "FACT",
    sourceRefs: footballResult.sourceRefs,
    dateKst: null,
    developerCode: "RESULT_FOUNDATION_CONTRACT",
  });
  achievements.push({
    id: "ach-football-result-foundation",
    title: "Football Result Foundation",
    plainLanguage: "Result Foundation 계약 계층 완료.",
    kind: "FACT",
    sourceRefs: footballResult.sourceRefs,
    dateKst: null,
    developerCode: "RESULT_FOUNDATION_CONTRACT",
  });

  completed.push({
    id: "completed-football-review-foundation",
    title: "Football Review Foundation 완료",
    plainLanguage:
      "Research/Official Review 분리·3-way Grade 계약이 정의되었습니다.",
    kind: "FACT",
    sourceRefs: footballReviewScorecard.sourceRefs,
    dateKst: null,
    developerCode: "REVIEW_FOUNDATION_CONTRACT",
  });
  completed.push({
    id: "completed-football-scorecard-foundation",
    title: "Football Scorecard Foundation 완료",
    plainLanguage:
      "Accuracy/Brier/LogLoss/Calibration/Confidence Framework (Observation Only)가 정의되었습니다. Prediction Formula 미연결.",
    kind: "FACT",
    sourceRefs: footballReviewScorecard.sourceRefs,
    dateKst: null,
    developerCode: "SCORECARD_FOUNDATION_CONTRACT",
  });
  achievements.push({
    id: "ach-football-review-scorecard-foundation",
    title: "Football Review & Scorecard Foundation",
    plainLanguage: footballReviewScorecard.plainLanguage,
    kind: "FACT",
    sourceRefs: footballReviewScorecard.sourceRefs,
    dateKst: null,
    developerCode: "FOUNDATION",
  });

  pending.push({
    id: "pending-football-prediction-v0",
    title: "Football Prediction Baseline v0",
    plainLanguage:
      "Prediction은 Review/Scorecard Foundation 이후 별도 미션입니다. 현재 Prediction NONE.",
    kind: "FACT",
    sourceRefs: footballReviewScorecard.sourceRefs,
    dateKst: null,
    developerCode: "NONE",
  });

  blocked.push({
    id: "blocked-football-provider-ingestion",
    title: "실제 provider ingestion 미연결",
    plainLanguage:
      "배당·결과 Provider 수집이 아직 연결되지 않아 운영 표본이 없습니다.",
    kind: "FACT",
    sourceRefs: [
      ...footballOdds.sourceRefs,
      ...footballResult.sourceRefs,
    ],
    dateKst: null,
    developerCode: "INGESTION_NOT_CONNECTED",
  });

  for (const r of footballIdentity.risksTop) {
    risks.push({
      id: `fb-id-risk-${r.id}`,
      title: r.title,
      plainLanguage: `Football Identity 리스크 (${r.severity})`,
      level: r.severity === "CRITICAL" ? "BLOCKED" : "WARNING",
      sourceRefs: ["src/lib/football/foundation/risk-register.ts"],
      developerCode: r.id,
    });
  }

  const completedCountWeek =
    achievements.length > 0 ? achievements.length : null;

  const needsDecision = approvals.filter(
    (a) => a.status === "NEEDS_OWNER_DECISION",
  );

  return {
    schemaVersion: "yang-edge-operation-memory-v0",
    generatedAt,
    dateKst,
    currentGoal: {
      title: "8월: MLB Pregame · OS · Football Review/Scorecard Foundation",
      description:
        "Identity·Odds·Result·Review·Scorecard Foundation 계약 완료. Prediction Baseline은 대기이며 Engine 연결은 금지입니다.",
      targetDate: "2026-08-31",
      status: invalidToday ? "BLOCKED" : "ACTIVE",
      sourceRefs: sources.roadmapPresent
        ? [
            "ROADMAP.md",
            "DEC-PRIVATE-BETA-OWNER-ONLY",
            "src/lib/football/review-scorecard-foundation-v0/",
          ]
        : [
            "DEC-PRIVATE-BETA-OWNER-ONLY",
            "src/lib/football/review-scorecard-foundation-v0/",
          ],
    },
    today: {
      completed,
      pending,
      blocked,
    },
    thisWeek: {
      completedCount: completedCountWeek,
      completedCountStatus:
        completedCountWeek == null ? "DATA_NOT_AVAILABLE" : "OK",
      keyAchievements: achievements,
      keyFailures: failures,
      lessons,
      researchObservationNote:
        "Accuracy / Brier / LogLoss는 연구 관찰이며 공식 성과·서비스 추천이 아닙니다. Invalid Pregame은 표본에 넣지 않습니다.",
    },
    currentRisks: risks,
    recentDecisions: decisions,
    approvalRequests: approvals,
    aiProposals,
    dataSources: sources.sources,
    dashboardSummary: {
      completedCount: completed.length,
      pendingCount: pending.length,
      blockedCount: blocked.length,
      goalOneLiner:
        "Football Review·Scorecard Foundation 완료 · Prediction NONE",
      approvalTop: needsDecision.slice(0, 3),
      decisionTop: approved.slice(0, 3),
    },
    engineChangeNote:
      "이번 주 Engine 변경 없음 — 표본 및 검증 조건 미충족 (승인된 결정: 표본 전 Engine 변경 금지).",
    footballIdentity,
    footballOdds,
    footballResult,
    footballReviewScorecard,
  };
}

/** Ensure invalid pregame days never contribute research graded counts. */
export function researchSampleEligibleFromValidity(
  validity: Record<string, unknown> | null,
): boolean {
  if (!validity) return true; // no validity sidecar → do not invent exclusion here
  return !isInvalidPregame(validity);
}
