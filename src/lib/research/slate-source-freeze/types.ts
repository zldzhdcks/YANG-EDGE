/**
 * Research slate source freeze v1.
 *
 * Immutable observed operator slate — NOT research admission.
 */
export const RESEARCH_SLATE_SOURCE_FREEZE_SCHEMA_VERSION =
  "yang-edge-research-slate-source-freeze-v1" as const;

export const RESEARCH_SLATE_SOURCE_FREEZE_MECHANISM =
  "research-slate-source-freeze-v1" as const;

export type ScopeCompletenessStatus =
  | "UNVERIFIED"
  | "INCOMPLETE"
  | "COMPLETE";

export type SourceFreezeStatus =
  | "SOURCE_FREEZE_CREATED"
  | "IDEMPOTENT_EXISTING"
  | "SOURCE_FREEZE_CONFLICT"
  | "SOURCE_FREEZE_INPUT_MISSING"
  | "SOURCE_FREEZE_INPUT_INVALID"
  | "SOURCE_FREEZE_NOT_VERIFIED";

export type FrozenSlateGame = {
  operatorSlateGameId: string;
  sport: string;
  competitionNameRaw: string | null;
  competitionNameKo: string | null;
  operatorGameNumber: string | null;
  homeTeamRaw: string;
  awayTeamRaw: string;
  scheduledStartTimeKst: string;
  providerGameId: string | null;
  providerFixtureId: string | null;
};

export type ResearchSlateSourceFreezeSourceRef = {
  class: "OPERATOR_BETMAN_DAILY_SLATE";
  rel: string;
  sha256: string;
  sourceType: "OPERATOR_MANUAL";
  reviewStatus: "VERIFIED";
  scopeCompletenessStatus: "COMPLETE";
  reviewedAt: string;
};

export type ResearchSlateSourceFreezeDocument = {
  schemaVersion: typeof RESEARCH_SLATE_SOURCE_FREEZE_SCHEMA_VERSION;
  freezeMechanism: typeof RESEARCH_SLATE_SOURCE_FREEZE_MECHANISM;
  dateKst: string;
  frozenAt: string;
  researchOnly: true;
  source: ResearchSlateSourceFreezeSourceRef;
  sourceGameCount: number;
  games: FrozenSlateGame[];
  marketDataIncluded: false;
  providerCalls: 0;
  networkCalls: 0;
  fuzzyMatchingUsed: false;
  invariant: "FROZEN_SOURCE_REPRESENTS_COMPLETE_MANUALLY_VERIFIED_OPERATOR_SLATE";
};

export type ResearchSlateSourceFreezeResult = {
  dateKst: string;
  status: SourceFreezeStatus;
  freezeCreated: boolean;
  inputPath: string | null;
  outputPath: string | null;
  inputReviewStatus: string | null;
  scopeCompletenessStatus: string | null;
  sourceGameCount: number | null;
  sourceGameCountAuthoritative: boolean;
  sourceRawSha256: string | null;
  document: ResearchSlateSourceFreezeDocument | null;
  message: string;
  networkCalls: 0;
  providerCalls: 0;
};
