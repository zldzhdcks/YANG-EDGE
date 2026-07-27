/**
 * Research Framework v1 — Hypothesis Registry 연계.
 * autoApply는 항상 false. 14경기만으로 PROMISING 확정 금지.
 */
export type LinkedHypothesisStatus =
  | "UNTESTED"
  | "COLLECTING"
  | "PROMISING"
  | "WEAK"
  | "REJECTED"
  | "READY_FOR_BACKTEST";

export type ResearchHypothesisLink = {
  hypothesisId: string;
  datasetId: string;
  description: string;
  requiredFields: string[];
  sampleCount: number;
  supportingCount: number;
  contradictingCount: number;
  inconclusiveCount: number;
  currentStatus: LinkedHypothesisStatus;
  minimumSampleTarget: number;
  autoApply: false;
  lastEvaluatedAt: string | null;
  notes?: string[];
};

export type HypothesisRegistryFile = {
  meta: {
    frameworkVersion: string;
    updatedAt: string;
    sourceDoc: string;
    autoApplyDefault: false;
  };
  hypotheses: ResearchHypothesisLink[];
};

export function createHypothesisLink(
  partial: Omit<ResearchHypothesisLink, "autoApply"> & { autoApply?: false },
): ResearchHypothesisLink {
  return {
    ...partial,
    autoApply: false,
  };
}

/** 소표본에서 PROMISING 승격 차단 */
export function assertHypothesisStatusGuard(
  status: LinkedHypothesisStatus,
  gradedGames: number,
  minForPromising = 100,
): LinkedHypothesisStatus {
  if (
    (status === "PROMISING" || status === "READY_FOR_BACKTEST") &&
    gradedGames < minForPromising
  ) {
    return "COLLECTING";
  }
  return status;
}
