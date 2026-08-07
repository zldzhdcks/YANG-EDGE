/**
 * Operation Memory v0 — read-only types.
 * Facts / AI proposals / approvals are separated at the type level.
 */

export type OperationMemoryKind =
  | "FACT"
  | "AI_INTERPRETATION"
  | "AI_PROPOSAL"
  | "OWNER_APPROVAL_NEEDED"
  | "APPROVED_DECISION";

export type OperationMemoryItem = {
  id: string;
  title: string;
  plainLanguage: string;
  kind: OperationMemoryKind;
  sourceRefs: string[];
  dateKst: string | null;
  /** Developer jargon kept out of owner default UI */
  developerCode: string | null;
};

export type OperationRisk = {
  id: string;
  title: string;
  plainLanguage: string;
  level: "READY" | "WARNING" | "BLOCKED" | "OFF";
  sourceRefs: string[];
  developerCode: string | null;
};

export type DecisionCategory =
  | "PRODUCT"
  | "RESEARCH"
  | "ENGINE"
  | "DATA"
  | "LEGAL"
  | "OPERATIONS";

export type DecisionStatus =
  | "APPROVED"
  | "REJECTED"
  | "DEFERRED"
  | "PROPOSED";

export type DecisionLogEntry = {
  id: string;
  decidedAt: string;
  title: string;
  category: DecisionCategory;
  status: DecisionStatus;
  decision: string;
  reason: string;
  evidence: string[];
  owner: "OWNER" | "AI_CTO" | "SYSTEM";
  engineImpact: "NONE" | "PROHIBITED" | "SEPARATE_MISSION_REQUIRED";
  sourceRefs: string[];
};

export type ApprovalRequestStatus =
  | "NEEDS_OWNER_DECISION"
  | "APPROVED"
  | "DEFERRED"
  | "NOT_READY";

export type ApprovalRequest = {
  id: string;
  title: string;
  plainLanguage: string;
  status: ApprovalRequestStatus;
  /** Never APPROVED unless owner registry says so */
  kind: "OWNER_APPROVAL_NEEDED" | "AI_PROPOSAL";
  sourceRefs: string[];
};

export type OperationMemorySource = {
  id: string;
  path: string;
  present: boolean;
  role: string;
};

export type OperationMemoryV0 = {
  schemaVersion: "yang-edge-operation-memory-v0";
  generatedAt: string;
  dateKst: string;

  currentGoal: {
    title: string;
    description: string;
    targetDate: string | null;
    status: "ACTIVE" | "BLOCKED" | "COMPLETED" | "NOT_SET";
    sourceRefs: string[];
  };

  today: {
    completed: OperationMemoryItem[];
    pending: OperationMemoryItem[];
    blocked: OperationMemoryItem[];
  };

  thisWeek: {
    completedCount: number | null;
    completedCountStatus: "OK" | "DATA_NOT_AVAILABLE";
    keyAchievements: OperationMemoryItem[];
    keyFailures: OperationMemoryItem[];
    lessons: OperationMemoryItem[];
    /** Research observation only — never treat as official KPI */
    researchObservationNote: string;
  };

  currentRisks: OperationRisk[];
  recentDecisions: DecisionLogEntry[];
  approvalRequests: ApprovalRequest[];
  aiProposals: OperationMemoryItem[];
  dataSources: OperationMemorySource[];

  dashboardSummary: {
    completedCount: number;
    pendingCount: number;
    blockedCount: number;
    goalOneLiner: string;
    approvalTop: ApprovalRequest[];
    decisionTop: DecisionLogEntry[];
  };

  engineChangeNote: string;

  /** Football Identity Foundation slice — no fabricated schedule/% */
  footballIdentity: {
    stage: "NOT_STARTED" | "FOUNDATION" | "READY" | "BLOCKED";
    osLevel: "READY" | "WARNING" | "BLOCKED" | "OFF";
    label: string;
    plainLanguage: string;
    competitionCount: number;
    teamCount: number;
    progressPercent: null;
    risksTop: { id: string; title: string; severity: string }[];
    sourceRefs: string[];
  };

  /** Football 1X2 Odds Foundation — no fabricated samples/% */
  footballOdds: {
    identityStage: string;
    oddsStage: "NOT_STARTED" | "PARTIAL" | "READY" | "BLOCKED";
    prediction: "NONE";
    usableMatchCount: number;
    blockedReasonPlain: string | null;
    plainLanguage: string;
    gateStatus: "READY" | "WARNING" | "BLOCKED" | "OFF";
    progressPercent: null;
    sourceRefs: string[];
  };

  /** Football Result Foundation — no fabricated match counts as progress % */
  footballResult: {
    resultStage: "NOT_STARTED" | "FOUNDATION" | "READY" | "BLOCKED";
    prediction: "NONE";
    usableFinalCount: number;
    notFinalCount: number;
    voidOrCancelledOrPostponedCount: number;
    abandonedReviewCount: number;
    plainLanguage: string;
    gateStatus: "READY" | "WARNING" | "BLOCKED" | "OFF";
    progressPercent: null;
    sourceRefs: string[];
  };

  /** Football Review & Scorecard Foundation */
  footballReviewScorecard: {
    reviewStage: "NOT_STARTED" | "FOUNDATION" | "READY" | "BLOCKED";
    scorecardStage: "NOT_STARTED" | "FOUNDATION" | "READY" | "BLOCKED";
    prediction: "NONE";
    plainLanguage: string;
    gateStatus: "READY" | "WARNING" | "BLOCKED" | "OFF";
    progressPercent: null;
    sourceRefs: string[];
  };
};

export type FeatureUsefulnessClass =
  | "DAILY_USE"
  | "WEEKLY_USE"
  | "DEVELOPER_ONLY"
  | "DUPLICATE"
  | "PLACEHOLDER_ONLY"
  | "DEPRECATED_CANDIDATE";

export type FeatureUsefulnessRow = {
  id: string;
  name: string;
  location: string;
  classification: FeatureUsefulnessClass;
  dataConnected: boolean;
  buttonWorks: boolean | null;
  suggestion: "KEEP" | "MOVE" | "HIDE" | "DEPRECATE";
  reason: string;
};
