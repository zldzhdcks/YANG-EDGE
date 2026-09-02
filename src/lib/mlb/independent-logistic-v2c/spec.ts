/**
 * HEAD_TO_HEAD whole-group ablation spec for Independent Logistic Prototype v2-C.
 * Removes exactly three H2H numeric bases from frozen v2-B X.
 * Keeps RATE_STRENGTH, RECENT_FORM, SEASON_RUN_QUALITY, and all 22 missing indicators.
 * STREAK_REST remains absent. Does not modify frozen v1 / v2-A / v2-B modules.
 */
import { IndependentLogisticError } from "../independent-logistic-v1/spec";
import {
  MLB_INDEPENDENT_LOGISTIC_REMOVED_STREAK_REST_V2B,
  orderedLogisticBaseFeatureNamesV2b,
  orderedLogisticMissingIndicatorNamesV2b,
  orderedLogisticModelFeatureNamesV2b,
} from "../independent-logistic-v2b/spec";

export { IndependentLogisticError };

export const MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_ID_V2C =
  "HEAD_TO_HEAD_ABLATION_V2C" as const;
export const MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_TYPE_V2C =
  "HEAD_TO_HEAD_ABLATION" as const;

export const MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2C =
  "7cb5253c824de514c25b1715e6f339b0f35c6942fa25c178423a415ec820430e";
export const MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_V2C =
  "bef2104957768a40cbfecbeb3ff99946dce80a7155ab93a29248cc6fab576c9b";
export const MLB_INDEPENDENT_2024_SEALED_V2B_MODEL_CORE_HASH_V2C =
  "f601594dcac1ae266424cf1a1503ecc1228099c2b1e090c634d54868f379c24e";

export const MLB_INDEPENDENT_LOGISTIC_REMOVED_H2H_V2C = [
  "headToHeadGamesBefore",
  "headToHeadHomeWinsBefore",
  "headToHeadAwayWinsBefore",
] as const;

export const MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V2C = 20;
export const MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V2C = 22;
export const MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2C = 42;

export const RETAINED_RATE_STRENGTH_V2C = [
  "home.winRateBefore",
  "home.homeWinRateBefore",
  "home.awayWinRateBefore",
  "away.winRateBefore",
  "away.homeWinRateBefore",
  "away.awayWinRateBefore",
] as const;

export const RETAINED_RECENT_FORM_V2C = [
  "home.last5WinsBefore",
  "home.last5LossesBefore",
  "home.last5WinRateBefore",
  "home.last5RunsScoredAverageBefore",
  "home.last5RunsAllowedAverageBefore",
  "away.last5WinsBefore",
  "away.last5LossesBefore",
  "away.last5WinRateBefore",
  "away.last5RunsScoredAverageBefore",
  "away.last5RunsAllowedAverageBefore",
] as const;

export const RETAINED_SEASON_RUN_QUALITY_V2C = [
  "home.runsScoredAverageBefore",
  "home.runsAllowedAverageBefore",
  "away.runsScoredAverageBefore",
  "away.runsAllowedAverageBefore",
] as const;

export const FORBIDDEN_X_TOKENS_V2C = [
  "market",
  "odds",
  "implied",
  "favorite",
  "edge",
  "closing",
  "winner",
  "target",
  "score",
  "result",
  "grade",
  "gamePk",
  "teamId",
  "officialDate",
  "commenceTime",
] as const;

export function orderedLogisticMissingIndicatorNamesV2c(): string[] {
  return orderedLogisticMissingIndicatorNamesV2b();
}

export function orderedLogisticBaseFeatureNamesV2c(): string[] {
  const removed = new Set<string>(MLB_INDEPENDENT_LOGISTIC_REMOVED_H2H_V2C);
  return orderedLogisticBaseFeatureNamesV2b().filter((name) => !removed.has(name));
}

export function orderedLogisticModelFeatureNamesV2c(): string[] {
  return [
    ...orderedLogisticBaseFeatureNamesV2c(),
    ...orderedLogisticMissingIndicatorNamesV2c(),
  ];
}

export type FeatureAblationAuditV2c = {
  V2B_BASE_FEATURE_COUNT: number;
  REMOVED_H2H_FEATURE_COUNT: number;
  V2C_BASE_FEATURE_COUNT: number;
  MISSING_INDICATOR_COUNT: number;
  V2C_MODEL_DIMENSIONS: number;
  REMOVED_FEATURES: string[];
  ADDED_FEATURE_COUNT: number;
  UNINTENDED_REMOVED_FEATURE_COUNT: number;
  MISSING_INDICATOR_CHANGE_COUNT: number;
  EXACT_H2H_ABLATION: "PASS";
  H2H_FEATURES_IN_V2C_X: 0;
  STREAK_REST_REINTRODUCED: "NO";
  RATE_STRENGTH_CHANGED: "NO";
  RECENT_FORM_CHANGED: "NO";
  SEASON_RUN_QUALITY_CHANGED: "NO";
  MISSING_INDICATORS_CHANGED: "NO";
};

export function auditFeatureAblationV2c(): FeatureAblationAuditV2c {
  const v2bBase = orderedLogisticBaseFeatureNamesV2b();
  const v2cBase = orderedLogisticBaseFeatureNamesV2c();
  const v2bMissing = orderedLogisticMissingIndicatorNamesV2b();
  const v2cMissing = orderedLogisticMissingIndicatorNamesV2c();
  const v2bModel = orderedLogisticModelFeatureNamesV2b();
  const v2cModel = orderedLogisticModelFeatureNamesV2c();
  const removed = v2bBase.filter((name) => !v2cBase.includes(name));
  const added = v2cBase.filter((name) => !v2bBase.includes(name));
  const expectedRemoved = [...MLB_INDEPENDENT_LOGISTIC_REMOVED_H2H_V2C];
  const unintended = removed.filter(
    (name) => !expectedRemoved.includes(name as (typeof expectedRemoved)[number]),
  );
  const missingChange =
    v2bMissing.length !== v2cMissing.length ||
    v2bMissing.some((name, i) => name !== v2cMissing[i]);
  const presentH2h = expectedRemoved.filter((name) => v2cModel.includes(name));
  const streakRestPresent = MLB_INDEPENDENT_LOGISTIC_REMOVED_STREAK_REST_V2B.filter(
    (name) => v2cModel.includes(name),
  );
  const retainedBases = [
    ...RETAINED_RATE_STRENGTH_V2C,
    ...RETAINED_RECENT_FORM_V2C,
    ...RETAINED_SEASON_RUN_QUALITY_V2C,
  ];
  const retainedMissing = retainedBases.some((name) => !v2cBase.includes(name));
  if (
    v2bBase.length !== 23 ||
    v2cBase.length !== 20 ||
    v2bModel.length !== 45 ||
    v2cModel.length !== 42 ||
    removed.length !== 3 ||
    added.length !== 0 ||
    unintended.length !== 0 ||
    missingChange ||
    presentH2h.length !== 0 ||
    streakRestPresent.length !== 0 ||
    retainedMissing ||
    RETAINED_RATE_STRENGTH_V2C.length !== 6 ||
    RETAINED_RECENT_FORM_V2C.length !== 10 ||
    RETAINED_SEASON_RUN_QUALITY_V2C.length !== 4 ||
    v2cMissing.length !== 22 ||
    JSON.stringify(removed) !== JSON.stringify(expectedRemoved)
  ) {
    throw new IndependentLogisticError(
      "EXACT_H2H_ABLATION_FAIL",
      JSON.stringify({
        removed,
        added,
        unintended,
        missingChange,
        presentH2h,
        streakRestPresent,
        retainedMissing,
      }),
    );
  }
  return {
    V2B_BASE_FEATURE_COUNT: 23,
    REMOVED_H2H_FEATURE_COUNT: 3,
    V2C_BASE_FEATURE_COUNT: 20,
    MISSING_INDICATOR_COUNT: 22,
    V2C_MODEL_DIMENSIONS: 42,
    REMOVED_FEATURES: expectedRemoved,
    ADDED_FEATURE_COUNT: 0,
    UNINTENDED_REMOVED_FEATURE_COUNT: 0,
    MISSING_INDICATOR_CHANGE_COUNT: 0,
    EXACT_H2H_ABLATION: "PASS",
    H2H_FEATURES_IN_V2C_X: 0,
    STREAK_REST_REINTRODUCED: "NO",
    RATE_STRENGTH_CHANGED: "NO",
    RECENT_FORM_CHANGED: "NO",
    SEASON_RUN_QUALITY_CHANGED: "NO",
    MISSING_INDICATORS_CHANGED: "NO",
  };
}

export function assertForbiddenXScanV2c(): void {
  const names = orderedLogisticModelFeatureNamesV2c();
  for (const name of names) {
    for (const token of FORBIDDEN_X_TOKENS_V2C) {
      const bounded = new RegExp(`(^|[._])${token}([._]|$)`, "i");
      if (bounded.test(name)) {
        throw new IndependentLogisticError(
          "FORBIDDEN_X_TOKEN",
          `${name} contains ${token}`,
        );
      }
    }
  }
}

export function assertLogisticFeatureSpecV2c(): void {
  const base = orderedLogisticBaseFeatureNamesV2c();
  const missing = orderedLogisticMissingIndicatorNamesV2c();
  const model = orderedLogisticModelFeatureNamesV2c();
  if (base.length !== MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V2C) {
    throw new IndependentLogisticError(
      "FEATURE_SPEC_INVALID",
      `base dim ${base.length} != ${MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V2C}`,
    );
  }
  if (missing.length !== MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V2C) {
    throw new IndependentLogisticError(
      "FEATURE_SPEC_INVALID",
      `missing dim ${missing.length} != ${MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V2C}`,
    );
  }
  if (model.length !== MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2C) {
    throw new IndependentLogisticError(
      "FEATURE_SPEC_INVALID",
      "model dim mismatch",
    );
  }
  auditFeatureAblationV2c();
  assertForbiddenXScanV2c();
}
