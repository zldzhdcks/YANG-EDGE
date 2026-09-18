/**
 * Provider legal-state statuses.
 * Scope-specific. Do not collapse into one provider-wide flag.
 * Attribution is not a LEGAL_PASS.
 */

export type ProviderLegalStatus =
  | "LEGAL_PASS"
  | "LEGAL_CONDITIONAL"
  | "LEGAL_REVIEW_REQUIRED"
  | "LEGAL_BLOCK";

export type ProviderAttributionStatus = "NOT_REQUIRED_BY_PROVIDER";

export type CompetitionPublicRightsStatus =
  | "UNREVIEWED"
  | "LEGAL_REVIEW_REQUIRED"
  | "LEGAL_BLOCK"
  | "APPROVED";

export const LEGAL_PASS = "LEGAL_PASS" as const;
export const LEGAL_CONDITIONAL = "LEGAL_CONDITIONAL" as const;
export const LEGAL_REVIEW_REQUIRED = "LEGAL_REVIEW_REQUIRED" as const;
export const LEGAL_BLOCK = "LEGAL_BLOCK" as const;
export const NOT_REQUIRED_BY_PROVIDER = "NOT_REQUIRED_BY_PROVIDER" as const;
export const UNREVIEWED = "UNREVIEWED" as const;
