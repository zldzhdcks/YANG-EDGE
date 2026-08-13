/**
 * YANG EDGE Daily Picks v1 — presentation view models only.
 * Does not change Prediction / Engine / weights / datasets.
 */

import type {
  RecommendationProvenance,
  SlateProvenanceBanner,
} from "@/lib/mlb/recommendation-provenance-v1";

export const DAILY_PICKS_SCHEMA = "yang-edge-daily-picks-v1" as const;

export type DailyPickTier =
  | "STRONG"
  | "GOOD"
  | "LEAN"
  | "PASS"
  | "AVOID";

export type DailyPickStars = 1 | 2 | 3 | 4 | 5;

export type DailyPickReasonCode =
  | "COIN_FLIP"
  | "MODEL_UNCERTAIN"
  | "LINEUP_MISSING"
  | "INPUT_LIMITED"
  | "MARKET_CONFLICT"
  | "BLOCKED"
  | "LOW_CONFIDENCE"
  | "STARTER_LIMITED"
  | "RESEARCH_ONLY_PASS";

export type DailyPickCard = {
  gameId: string;
  gamePk: number | null;
  detailHref: string | null;
  tier: DailyPickTier;
  stars: DailyPickStars;
  starLabel: string;
  matchupLine: string;
  pickTeam: string | null;
  pickSide: "HOME" | "AWAY" | null;
  /**
   * Probability that the SELECTED pick wins (percent).
   * Not home-side probability. See resolveSelectedPickProbability.
   */
  modelProbabilityPercent: number | null;
  /**
   * Input-quality / data confidence score 0–100 — NOT win probability.
   * Tiering uses this (GOOD ≥ 70). Do not display as "% to win".
   */
  confidence: number | null;
  reasonChips: string[];
  passReasons: DailyPickReasonCode[];
  passReasonLabels: string[];
  aiSummary: string;
  researchOnly: boolean;
  inputStatus: string | null;
  provenance: RecommendationProvenance;
};

export type DailyPicksHero = {
  dateKst: string;
  totalGames: number;
  /** ENGINE_SNAPSHOT Strong+Good only */
  recommendCount: number;
  passCount: number;
  researchReadyPercent: number | null;
};

export type TodaysResearchFocus = {
  title: string;
  focus: string;
  plain: string;
  source: string;
};

export type DailyPicksView = {
  schemaVersion: typeof DAILY_PICKS_SCHEMA;
  dateKst: string;
  loaded: boolean;
  error: string | null;
  hero: DailyPicksHero;
  provenanceBanner: SlateProvenanceBanner;
  /** User-facing engine recommendations only */
  strongPicks: DailyPickCard[];
  goodPicks: DailyPickCard[];
  /** Historical reconstruction — NOT user recommendations */
  reconstructedPicks: DailyPickCard[];
  leanPicks: DailyPickCard[];
  passGames: DailyPickCard[];
  avoidGames: DailyPickCard[];
  todaysResearch: TodaysResearchFocus;
  ctoCommentary: string;
  predictionHash: string | null;
  sourcePaths: string[];
  engineRecommendationRecordPath: string | null;
};
