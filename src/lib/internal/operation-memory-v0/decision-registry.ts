/**
 * Static Decision Log Registry v0 — owner-approved facts only when status=APPROVED.
 * AI proposals stay PROPOSED / approval requests stay NEEDS_OWNER_DECISION.
 * No Engine mutation from this registry.
 */
import type { ApprovalRequest, DecisionLogEntry } from "./types";

/** Grounded in ROADMAP / project practice — not invented KPIs. */
export const DECISION_LOG_REGISTRY_V0: DecisionLogEntry[] = [
  {
    id: "DEC-ENGINE-NO-CHANGE-UNTIL-SAMPLE",
    decidedAt: "2026-08-02T00:00:00.000Z",
    title: "표본 충분 전까지 Engine 변경 금지",
    category: "ENGINE",
    status: "APPROVED",
    decision: "충분한 검증 표본이 쌓이기 전까지 weight/config/engine을 바꾸지 않는다.",
    reason: "단일 날짜 연구 관찰을 공식 성과로 오인하고 Engine에 반영하는 것을 막기 위함.",
    evidence: [
      "ROADMAP.md PRIVATE_RESEARCH_PROTOTYPE",
      "MLB research review missions: engineConnection=PROHIBITED",
    ],
    owner: "OWNER",
    engineImpact: "PROHIBITED",
    sourceRefs: ["ROADMAP.md", "data/research/mlb/2026-08-02-prediction-review-detail-v0.json"],
  },
  {
    id: "DEC-INVALID-PREGAME-EXCLUDE",
    decidedAt: "2026-08-03T00:00:00.000Z",
    title: "Invalid Pregame Snapshot은 Research 분모 제외",
    category: "RESEARCH",
    status: "APPROVED",
    decision:
      "경기 시작 후·입력 무결성 실패 Snapshot은 research/official 채점 분모와 Scorecard에서 제외한다.",
    reason: "사후 예측을 Pregame 표본으로 위장하면 누적 연구가 오염된다.",
    evidence: [
      "data/research/mlb/2026-08-03-prediction-validity-v0.json",
      "researchValidity=INVALID_FOR_PREGAME",
    ],
    owner: "OWNER",
    engineImpact: "NONE",
    sourceRefs: [
      "data/research/mlb/2026-08-03-prediction-validity-v0.json",
      "data/audits/2026-08-03-mlb-pregame-validity-audit-v1.json",
    ],
  },
  {
    id: "DEC-ARTIFACT-VS-USABLE",
    decidedAt: "2026-08-03T00:00:00.000Z",
    title: "Artifact 존재 ≠ 사용 가능",
    category: "DATA",
    status: "APPROVED",
    decision:
      "파일이 있어도 collected=0·integrity fail이면 COMPLETE/READY로 승격하지 않는다.",
    reason: "08-03에서 odds 0/15·starter exit 1인데도 ALREADY_COMPLETE로 진행된 모순을 막기 위함.",
    evidence: [
      "daily-pregame-v0 usability gates",
      "2026-08-03 pregame validity audit",
    ],
    owner: "OWNER",
    engineImpact: "NONE",
    sourceRefs: [
      "src/lib/mlb/daily-pregame-v0/pregame-gates.ts",
      "data/audits/2026-08-03-mlb-pregame-validity-audit-v1.json",
    ],
  },
  {
    id: "DEC-FOOTBALL-AUGUST-PRIORITY",
    decidedAt: "2026-07-01T00:00:00.000Z",
    title: "Football Foundation을 8월 우선순위로 둔다",
    category: "PRODUCT",
    status: "APPROVED",
    decision:
      "축구는 지원 종목이나 Dataset·Engine 검증 전이며, Foundation 설계를 8월 우선 과제로 둔다.",
    reason: "ROADMAP: Soccer = NOT_STARTED / FUTURE_GATED — 사전 설계 없이 구현 금지.",
    evidence: ["ROADMAP.md 지원 종목 · 축구 NOT_STARTED"],
    owner: "OWNER",
    engineImpact: "SEPARATE_MISSION_REQUIRED",
    sourceRefs: ["ROADMAP.md"],
  },
  {
    id: "DEC-PRIVATE-BETA-OWNER-ONLY",
    decidedAt: "2026-07-01T00:00:00.000Z",
    title: "Private Beta는 찬양님 단독",
    category: "PRODUCT",
    status: "APPROVED",
    decision: "현재 단계는 PRIVATE_RESEARCH_PROTOTYPE — 찬양님 단독 사용.",
    reason: "공개 UI·다수 사용자 전에 데이터·법적·표본 게이트가 필요하다.",
    evidence: ["ROADMAP.md 제품 단계 PRIVATE_RESEARCH_PROTOTYPE"],
    owner: "OWNER",
    engineImpact: "NONE",
    sourceRefs: ["ROADMAP.md"],
  },
  {
    id: "DEC-LEGAL-BEFORE-PUBLIC",
    decidedAt: "2026-07-01T00:00:00.000Z",
    title: "공개 전 법적·데이터 권리 검토 우선",
    category: "LEGAL",
    status: "APPROVED",
    decision: "공개 AI 스포츠 분석 플랫폼 전환 전 법률·약관·라이선스 검토를 선행한다.",
    reason: "ROADMAP 다음 우선순위 및 PUBLIC 단계 게이트.",
    evidence: ["ROADMAP.md 공개 전 법률·약관·개인정보·라이선스 검토"],
    owner: "OWNER",
    engineImpact: "NONE",
    sourceRefs: ["ROADMAP.md", "docs/DEVELOPMENT_COMPLIANCE_CHARTER.md"],
  },
  {
    id: "DEC-SEPARATE-RESEARCH-OPS-SERVICE",
    decidedAt: "2026-08-03T00:00:00.000Z",
    title: "Research / Operation / Service 화면 분리",
    category: "OPERATIONS",
    status: "APPROVED",
    decision:
      "YANG EDGE OS에서 Dashboard·Mission은 운영, Research Lab은 연구, Developer Console은 개발 전용으로 분리한다.",
    reason: "대표가 30초 안에 상태를 보고, 기술 용어는 기본 노출하지 않기 위함.",
    evidence: ["YANG EDGE OS UX mission", "src/constants/yang-edge-os-nav.ts"],
    owner: "OWNER",
    engineImpact: "NONE",
    sourceRefs: ["src/constants/yang-edge-os-nav.ts"],
  },
];

/** Proposals awaiting owner — never status APPROVED here. */
export const APPROVAL_REQUEST_REGISTRY_V0: ApprovalRequest[] = [
  {
    id: "APR-FOOTBALL-FOUNDATION-START",
    title: "Football Foundation 시작",
    plainLanguage:
      "축구 Foundation Pre-Design Audit를 다음 Active Mission으로 시작할까요? (아직 승인 전 제안)",
    status: "NEEDS_OWNER_DECISION",
    kind: "OWNER_APPROVAL_NEEDED",
    sourceRefs: ["ROADMAP.md"],
  },
  {
    id: "APR-KBO-DIRTY-HYGIENE",
    title: "KBO Reader/UX 미커밋 코드 정리",
    plainLanguage:
      "working tree에 남아 있는 KBO/UI unrelated dirty를 별도 정리 미션으로 묶을지 결정이 필요합니다.",
    status: "NEEDS_OWNER_DECISION",
    kind: "OWNER_APPROVAL_NEEDED",
    sourceRefs: ["git working tree (unrelated)"],
  },
  {
    id: "APR-REPO-HYGIENE",
    title: "Repository Hygiene",
    plainLanguage:
      "연구 artifact·audit·cache dirty를 안전한 커밋 단위로 나눌지 대표 판단이 필요합니다.",
    status: "NEEDS_OWNER_DECISION",
    kind: "OWNER_APPROVAL_NEEDED",
    sourceRefs: ["git status"],
  },
  {
    id: "APR-ENGINE-VAR-ACTIVATE",
    title: "Engine 변수 활성화",
    plainLanguage:
      "Bullpen/Lineup 등 weight 활성화는 표본·검증 전 금지입니다. 지금은 승인 요청이 아니라 NOT_READY입니다.",
    status: "NOT_READY",
    kind: "AI_PROPOSAL",
    sourceRefs: ["DEC-ENGINE-NO-CHANGE-UNTIL-SAMPLE"],
  },
  {
    id: "APR-PROVIDER-PAID",
    title: "Provider 유료 플랜",
    plainLanguage:
      "Historical odds 유료 도입은 기존 감사에서 HOLD입니다. 새 승인 없이 진행하지 않습니다.",
    status: "DEFERRED",
    kind: "OWNER_APPROVAL_NEEDED",
    sourceRefs: [
      "HISTORICAL_ODDS_PAID_PROVIDER_BUSINESS_DECISION_AUDIT_V1.md",
    ],
  },
  {
    id: "APR-NEXT-PREGAME-FREEZE",
    title: "다음 MLB Pregame 정상 Freeze",
    plainLanguage:
      "경기 시작 전 Daily Pregame Freeze를 다음 슬레이트에서 실행할지 운영 확인이 필요합니다.",
    status: "NEEDS_OWNER_DECISION",
    kind: "OWNER_APPROVAL_NEEDED",
    sourceRefs: ["data/research/mlb/2026-08-03-prediction-validity-v0.json"],
  },
];

export function listApprovedDecisions(): DecisionLogEntry[] {
  return DECISION_LOG_REGISTRY_V0.filter((d) => d.status === "APPROVED");
}

export function listProposedOnly(): DecisionLogEntry[] {
  return DECISION_LOG_REGISTRY_V0.filter((d) => d.status === "PROPOSED");
}
