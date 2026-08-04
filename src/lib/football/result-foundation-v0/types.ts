/**
 * Football Result Foundation v0 — contracts.
 * Prediction / Engine / Review formulas NOT implemented.
 */

import type { FootballOsLevel } from "../foundation/types";

export const FOOTBALL_RESULT_FOUNDATION_VERSION =
  "football-result-foundation-v0" as const;

export type FootballResultStatus =
  | "SCHEDULED"
  | "LIVE"
  | "HALFTIME"
  | "FINAL"
  | "FINAL_AFTER_EXTRA_TIME"
  | "FINAL_AFTER_PENALTIES"
  | "POSTPONED"
  | "CANCELLED"
  | "ABANDONED"
  | "SUSPENDED"
  | "VOID"
  | "UNKNOWN";

export type FootballOneXTwoOutcome =
  | "HOME"
  | "DRAW"
  | "AWAY"
  | "NOT_FINAL"
  | "VOID"
  | "UNRESOLVED";

export type FootballAdvancementWinner =
  | "HOME"
  | "AWAY"
  | "NONE"
  | "UNRESOLVED";

export type FootballScorePair = {
  home: number | null;
  away: number | null;
};

/** Input before normalization / hash (may include provider hints). */
export type FootballResultInputV0 = {
  matchId: string;
  identityHash: string;
  provider: string;
  fixtureId: string;
  competitionId: string;
  season: string;
  homeTeamId: string;
  awayTeamId: string;
  status: FootballResultStatus;
  regularTime: FootballScorePair;
  extraTime: FootballScorePair;
  penalties: FootballScorePair;
  finalScore: FootballScorePair;
  resultObservedAt: string;
  sourceStatusRaw: string | null;
  /** Optional provider-declared winner — conflict if disagrees with scores */
  providerAdvancementWinner?: FootballAdvancementWinner | null;
  /** Collect-only two-leg placeholders — never alter single-match 1X2 */
  aggregateHome?: number | null;
  aggregateAway?: number | null;
  legNumber?: number | null;
  tieId?: string | null;
};

export type FootballOfficialResultV0 = {
  matchId: string;
  identityHash: string;
  provider: string;
  fixtureId: string;
  competitionId: string;
  season: string;
  homeTeamId: string;
  awayTeamId: string;
  status: FootballResultStatus;
  regularTime: FootballScorePair;
  extraTime: FootballScorePair;
  penalties: FootballScorePair;
  finalScore: FootballScorePair;
  oneXTwoOutcome: FootballOneXTwoOutcome;
  advancementWinner: FootballAdvancementWinner;
  resultObservedAt: string;
  sourceStatusRaw: string | null;
  resultHash: string;
  /** Collect-only; never grades 1X2 */
  aggregateCollectOnly: {
    aggregateHome: number | null;
    aggregateAway: number | null;
    legNumber: number | null;
    tieId: string | null;
  };
};

export type FootballResultUsabilityStatus =
  | "RESULT_ARTIFACT_MISSING"
  | "NOT_FINAL"
  | "FINAL_USABLE"
  | "FINAL_AFTER_EXTRA_TIME_USABLE"
  | "FINAL_AFTER_PENALTIES_USABLE"
  | "VOID_NOT_GRADED"
  | "POSTPONED_NOT_GRADED"
  | "CANCELLED_NOT_GRADED"
  | "ABANDONED_REVIEW_REQUIRED"
  | "RESULT_CONFLICT"
  | "IDENTITY_UNRESOLVED"
  | "INVALID_SCORE"
  | "STATUS_UNKNOWN"
  | "REVERSED_RESULT_SUSPECTED"
  | "SUSPENDED_NOT_GRADED";

export type FootballResultGateResult = {
  status: FootballOsLevel;
  gradingAllowed: boolean;
  usableFinalCount: number;
  notFinalCount: number;
  voidOrCancelledOrPostponedCount: number;
  abandonedReviewCount: number;
  conflictCount: number;
  reasons: string[];
  usability: FootballResultUsabilityStatus;
  stage: "NOT_STARTED" | "FOUNDATION" | "READY" | "BLOCKED";
  plainLanguage: string;
  progressPercent: null;
};

export type FootballReviewResultAdapterV0 = {
  matchId: string;
  marketType: "MONEYLINE_3WAY_1X2";
  outcome: "HOME" | "DRAW" | "AWAY" | null;
  gradingAllowed: boolean;
  reason: string | null;
  resultHash: string;
};

export type FootballResultArtifactMeta = {
  schemaVersion: "football-official-results-v0" | "football-result-usability-v0";
  generatedAt: string;
  dateKst: string;
  sourceProvider: string;
  identityVersion: string;
  fixtureCount: number;
  finalUsableCount: number;
  notFinalCount: number;
  voidCount: number;
  postponedCount: number;
  cancelledCount: number;
  conflictCount: number;
  identityFailedCount: number;
  artifactHash: string;
};

export type FootballResultRiskId =
  | "FT_DRAW_ET_HOME"
  | "FT_DRAW_PEN_AWAY"
  | "REGULAR_TIME_MISSING"
  | "PENALTIES_TIE"
  | "PROVIDER_WINNER_CONFLICT"
  | "HOME_AWAY_REVERSE"
  | "ABANDONED"
  | "SUSPENDED"
  | "POSTPONED_RESCHEDULE"
  | "LEAGUE_CUP_SAME_TEAMS"
  | "TWO_LEG_AGGREGATE"
  | "NEUTRAL_VENUE"
  | "STATUS_RAW_UNKNOWN"
  | "FINAL_SCORE_ONLY"
  | "HASH_NONDETERMINISM";

export const FOOTBALL_RESULT_RISK_REGISTER_V0: {
  id: FootballResultRiskId;
  title: string;
  mitigation: string;
}[] = [
  {
    id: "FT_DRAW_ET_HOME",
    title: "정규 무승부 + 연장 홈 승",
    mitigation: "1X2=DRAW, advancement=HOME",
  },
  {
    id: "FT_DRAW_PEN_AWAY",
    title: "정규 무승부 + 승부차기 원정 승",
    mitigation: "1X2=DRAW, advancement=AWAY",
  },
  {
    id: "REGULAR_TIME_MISSING",
    title: "regularTime 누락",
    mitigation: "INVALID_SCORE / NOT usable",
  },
  {
    id: "PENALTIES_TIE",
    title: "승부차기 동점",
    mitigation: "INVALID_SCORE",
  },
  {
    id: "PROVIDER_WINNER_CONFLICT",
    title: "Provider winner vs score 충돌",
    mitigation: "RESULT_CONFLICT — no auto-approve",
  },
  {
    id: "HOME_AWAY_REVERSE",
    title: "home/away reverse 의심",
    mitigation: "REVERSED_RESULT_SUSPECTED — usable=false",
  },
  {
    id: "ABANDONED",
    title: "Abandoned",
    mitigation: "ABANDONED_REVIEW_REQUIRED",
  },
  {
    id: "SUSPENDED",
    title: "Suspended",
    mitigation: "SUSPENDED_NOT_GRADED",
  },
  {
    id: "POSTPONED_RESCHEDULE",
    title: "연기 후 재일정",
    mitigation: "새 fixtureId → 새 matchId; 덮어쓰기 금지",
  },
  {
    id: "LEAGUE_CUP_SAME_TEAMS",
    title: "리그·컵 동일 팀",
    mitigation: "competitionId로 분리",
  },
  {
    id: "TWO_LEG_AGGREGATE",
    title: "Two-leg aggregate 혼동",
    mitigation: "aggregate collect-only; 1X2 불변",
  },
  {
    id: "NEUTRAL_VENUE",
    title: "Neutral venue",
    mitigation: "Identity.neutralVenue; score 정책 동일",
  },
  {
    id: "STATUS_RAW_UNKNOWN",
    title: "status raw unknown",
    mitigation: "STATUS_UNKNOWN",
  },
  {
    id: "FINAL_SCORE_ONLY",
    title: "finalScore만 있고 regularTime 없음",
    mitigation: "INVALID_SCORE",
  },
  {
    id: "HASH_NONDETERMINISM",
    title: "resultHash 비결정성",
    mitigation: "generatedAt/UI label 제외",
  },
];
