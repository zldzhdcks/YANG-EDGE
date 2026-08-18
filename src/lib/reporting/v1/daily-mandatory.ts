/**
 * Daily Mandatory Completion v1.
 * Measures whether required operations closed — not accuracy or extra development.
 */
import {
  MANDATORY_STAGE_WEIGHTS,
  type DailyCompletionStatus,
  type MandatoryStageId,
  type MandatoryStageStatus,
  type NaPredeclareEvidence,
} from "./types";

export const OPERATIONAL_COMPLETE_STATUSES: ReadonlySet<MandatoryStageStatus> =
  new Set(["DONE", "VALID_PASS", "VALID_BLOCKED", "N/A_PREDECLARED"]);

export const RESEARCH_VALID_STAGE_STATUSES: ReadonlySet<MandatoryStageStatus> =
  new Set(["DONE", "VALID_PASS"]);

export type MandatoryStageAssessment = {
  stage: MandatoryStageId;
  weight: number;
  status: MandatoryStageStatus;
  na?: NaPredeclareEvidence | null;
  note?: string;
};

export type DailyMandatoryAssessment = {
  dateKst: string;
  sport: string;
  stages: MandatoryStageAssessment[];
  mandatoryCompletionPercent: number;
  completionStatus: DailyCompletionStatus;
  operationallyClosed: boolean;
  researchValidStages: MandatoryStageId[];
  blockedExcludedStages: MandatoryStageId[];
  developmentCommitCountIgnored: number;
};

const STAGE_ORDER: MandatoryStageId[] = [
  "A_SLATE_SCHEDULE",
  "B_PREGAME_INPUT",
  "C_PREGAME_FREEZE",
  "D_PREGAME_GIT_SEAL",
  "E_RESULT_GRADE",
  "F_REVIEW_SCORECARD",
  "G_DAILY_CLOSE",
];

function isNaLocked(na: NaPredeclareEvidence | null | undefined): boolean {
  return Boolean(
    na &&
      na.scopeLockedAt.trim() &&
      na.reason.trim() &&
      na.source.trim(),
  );
}

/**
 * Post-hoc N/A after operations started is forbidden.
 * Missing lock evidence → NOT_DERIVABLE, never silent N/A.
 */
export function normalizeStageStatus(input: {
  status: MandatoryStageStatus;
  na?: NaPredeclareEvidence | null;
  opsStartedAt?: string | null;
}): MandatoryStageStatus {
  if (input.status !== "N/A_PREDECLARED") return input.status;
  if (!isNaLocked(input.na)) return "NOT_DERIVABLE";
  const opsStartedAt = input.opsStartedAt?.trim() || null;
  const lockedAt = input.na!.scopeLockedAt;
  if (opsStartedAt && lockedAt > opsStartedAt) return "NOT_DERIVABLE";
  return "N/A_PREDECLARED";
}

export function isOperationallyComplete(
  status: MandatoryStageStatus,
): boolean {
  return OPERATIONAL_COMPLETE_STATUSES.has(status);
}

export function contributesToResearchValidSample(
  status: MandatoryStageStatus,
): boolean {
  if (status === "VALID_BLOCKED") return false;
  if (status === "N/A_PREDECLARED") return false;
  return RESEARCH_VALID_STAGE_STATUSES.has(status);
}

export function computeMandatoryCompletionPercent(
  stages: MandatoryStageAssessment[],
): number {
  let awarded = 0;
  let denom = 0;
  for (const stage of stages) {
    if (stage.status === "N/A_PREDECLARED") continue;
    denom += stage.weight;
    if (isOperationallyComplete(stage.status)) awarded += stage.weight;
  }
  if (denom <= 0) return 0;
  return Math.round((awarded / denom) * 100);
}

export function resolveDailyCompletionStatus(input: {
  percent: number;
  stages: MandatoryStageAssessment[];
}): DailyCompletionStatus {
  const statuses = input.stages
    .filter((s) => s.status !== "N/A_PREDECLARED")
    .map((s) => s.status);
  if (statuses.some((s) => s === "NOT_DERIVABLE")) return "NOT_DERIVABLE";
  if (input.percent === 100) return "COMPLETE";
  const waiting = statuses.some((s) => s === "WAITING_TIME_GATE");
  const missingOrFailed = statuses.some(
    (s) => s === "MISSING" || s === "FAILED",
  );
  if (waiting && !missingOrFailed) return "WAITING_TIME_GATE";
  if (missingOrFailed) return "INCOMPLETE";
  if (statuses.some((s) => isOperationallyComplete(s))) return "IN_PROGRESS";
  return "INCOMPLETE";
}

export function assessDailyMandatory(input: {
  dateKst: string;
  sport: string;
  stages: Array<
    Omit<MandatoryStageAssessment, "weight"> & { weight?: number }
  >;
  opsStartedAt?: string | null;
  /** Extra development commits never affect %. */
  developmentCommitCount?: number;
}): DailyMandatoryAssessment {
  const byId = new Map(input.stages.map((s) => [s.stage, s]));
  const stages: MandatoryStageAssessment[] = STAGE_ORDER.map((stage) => {
    const raw = byId.get(stage);
    const status = raw
      ? normalizeStageStatus({
          status: raw.status,
          na: raw.na,
          opsStartedAt: input.opsStartedAt,
        })
      : "MISSING";
    return {
      stage,
      weight: MANDATORY_STAGE_WEIGHTS[stage],
      status,
      na: raw?.na ?? null,
      note: raw?.note,
    };
  });

  const percent = computeMandatoryCompletionPercent(stages);
  const completionStatus = resolveDailyCompletionStatus({
    percent,
    stages,
  });

  return {
    dateKst: input.dateKst,
    sport: input.sport,
    stages,
    mandatoryCompletionPercent: percent,
    completionStatus,
    operationallyClosed: percent === 100 && completionStatus === "COMPLETE",
    researchValidStages: stages
      .filter((s) => contributesToResearchValidSample(s.status))
      .map((s) => s.stage),
    blockedExcludedStages: stages
      .filter((s) => s.status === "VALID_BLOCKED")
      .map((s) => s.stage),
    developmentCommitCountIgnored: input.developmentCommitCount ?? 0,
  };
}

export function defaultSevenStageTemplate(
  overrides: Partial<Record<MandatoryStageId, MandatoryStageStatus>>,
): Array<Omit<MandatoryStageAssessment, "weight">> {
  return STAGE_ORDER.map((stage) => ({
    stage,
    status: overrides[stage] ?? "MISSING",
  }));
}
