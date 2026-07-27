/**
 * Research Framework v1 — 공통 Variable Scorecard 인터페이스.
 * Engine 반영 전 필수. 적중률만으로 PASS 금지.
 */
export type ScorecardVerdict =
  | "INSUFFICIENT_SAMPLE"
  | "COLLECTING"
  | "PROMISING"
  | "WEAK"
  | "REJECTED"
  | "READY_FOR_BACKTEST"
  | "BLOCKED_LEGAL"
  | "BLOCKED_DATA_QUALITY";

export type ResearchScorecardDimension = {
  id: string;
  label: string;
  score: number | null;
  maxScore: number;
  notes: string[];
};

/**
 * PROJECT_MEMORY Variable Scorecard 정책과 정렬된 공통 카드.
 * 도메인은 dimensions를 확장한다.
 */
export type ResearchVariableScorecard = {
  meta: {
    frameworkVersion: string;
    datasetId: string;
    variableId: string;
    scorecardVersion: string;
    generatedAt: string;
    engineAdmission: "PROHIBITED" | "CANDIDATE" | "APPROVED";
  };
  sampleSize: number;
  minimumSampleTarget: number;
  dimensions: ResearchScorecardDimension[];
  leakageErrors: number;
  reproducibility: {
    hashStable: boolean | null;
    pointInTimeOk: boolean | null;
  };
  legalClearance: boolean;
  preGameOnly: boolean | null;
  verdict: ScorecardVerdict;
  autoApply: false;
  hypothesisIds: string[];
  notes?: string[];
};

export function emptyScorecard(args: {
  datasetId: string;
  variableId: string;
  scorecardVersion: string;
  minimumSampleTarget: number;
  hypothesisIds?: string[];
}): ResearchVariableScorecard {
  return {
    meta: {
      frameworkVersion: "research-framework-v1",
      datasetId: args.datasetId,
      variableId: args.variableId,
      scorecardVersion: args.scorecardVersion,
      generatedAt: new Date().toISOString(),
      engineAdmission: "PROHIBITED",
    },
    sampleSize: 0,
    minimumSampleTarget: args.minimumSampleTarget,
    dimensions: [],
    leakageErrors: 0,
    reproducibility: { hashStable: null, pointInTimeOk: null },
    legalClearance: false,
    preGameOnly: null,
    verdict: "INSUFFICIENT_SAMPLE",
    autoApply: false,
    hypothesisIds: args.hypothesisIds ?? [],
    notes: ["Scorecard shell only — fill after audited samples accumulate."],
  };
}
