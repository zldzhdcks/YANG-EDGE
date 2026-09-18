import {
  UNREVIEWED,
  type CompetitionPublicRightsStatus,
} from "./types";

export const PUBLIC_EXPANSION_ALLOWED_DEFAULT = false;

/**
 * No current competition has an explicit Legal Room public-enable result.
 * Existing /games rows stay frozen as current-state; they are not approvals.
 */
export const API_FOOTBALL_COMPETITION_PUBLIC_RIGHTS: ReadonlyMap<
  string,
  CompetitionPublicRightsStatus
> = new Map();

export type CompetitionPublicExpansionInput = {
  providerCompetitionId: string;
  reviewStatus?: CompetitionPublicRightsStatus;
  /**
   * Only an explicit future approved legal result may set this true.
   * Absent / false never enables a new public competition.
   */
  approvedPublicExpansion?: boolean;
};

export type CompetitionPublicExpansionVerdict = {
  providerCompetitionId: string;
  reviewStatus: CompetitionPublicRightsStatus;
  publicExpansionAllowed: boolean;
};

function resolveReviewStatus(
  providerCompetitionId: string,
  explicit?: CompetitionPublicRightsStatus,
): CompetitionPublicRightsStatus {
  if (explicit) return explicit;
  return (
    API_FOOTBALL_COMPETITION_PUBLIC_RIGHTS.get(providerCompetitionId) ??
    UNREVIEWED
  );
}

/**
 * NEW PUBLIC COMPETITION → LEAGUE RIGHTS REVIEW → LEGAL RESULT → PUBLIC ENABLE
 *
 * UNREVIEWED / LEGAL_REVIEW_REQUIRED / LEGAL_BLOCK → false.
 * APPROVED enables only when the legal result explicitly sets
 * approvedPublicExpansion=true.
 */
export function evaluateCompetitionPublicExpansion(
  input: CompetitionPublicExpansionInput,
): CompetitionPublicExpansionVerdict {
  const reviewStatus = resolveReviewStatus(
    input.providerCompetitionId,
    input.reviewStatus,
  );
  const publicExpansionAllowed =
    reviewStatus === "APPROVED" && input.approvedPublicExpansion === true;
  return {
    providerCompetitionId: input.providerCompetitionId,
    reviewStatus,
    publicExpansionAllowed,
  };
}

export function canEnableNewPublicCompetition(
  input: CompetitionPublicExpansionInput,
): boolean {
  return evaluateCompetitionPublicExpansion(input).publicExpansionAllowed;
}
