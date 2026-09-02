/**
 * STREAK_REST ablation feature spec for Independent Logistic Prototype v2-B.
 * Removes exactly six streak/rest numeric bases from frozen v2-A X.
 * Keeps all 22 missing indicators, including restDays.missing.
 * Does not modify frozen v1 or v2-A modules.
 */
import { IndependentLogisticError } from "../independent-logistic-v1/spec";
import {
  orderedLogisticBaseFeatureNamesV2a,
  orderedLogisticMissingIndicatorNamesV2a,
  orderedLogisticModelFeatureNamesV2a,
} from "../independent-logistic-v2a/spec";

export { IndependentLogisticError };

export const MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_ID_V2B =
  "STREAK_REST_ABLATION_V2B" as const;
export const MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_TYPE_V2B =
  "STREAK_REST_ABLATION" as const;

export const MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2B =
  "7cb5253c824de514c25b1715e6f339b0f35c6942fa25c178423a415ec820430e";
export const MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_V2B =
  "bef2104957768a40cbfecbeb3ff99946dce80a7155ab93a29248cc6fab576c9b";

export const MLB_INDEPENDENT_LOGISTIC_REMOVED_STREAK_REST_V2B = [
  "home.currentWinStreakBefore",
  "home.currentLossStreakBefore",
  "home.restDaysBefore",
  "away.currentWinStreakBefore",
  "away.currentLossStreakBefore",
  "away.restDaysBefore",
] as const;

export const MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V2B = 23;
export const MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V2B = 22;
export const MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2B = 45;

export const FORBIDDEN_X_TOKENS_V2B = [
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

export function orderedLogisticMissingIndicatorNamesV2b(): string[] {
  return orderedLogisticMissingIndicatorNamesV2a();
}

export function orderedLogisticBaseFeatureNamesV2b(): string[] {
  const removed = new Set<string>(MLB_INDEPENDENT_LOGISTIC_REMOVED_STREAK_REST_V2B);
  return orderedLogisticBaseFeatureNamesV2a().filter((name) => !removed.has(name));
}

export function orderedLogisticModelFeatureNamesV2b(): string[] {
  return [
    ...orderedLogisticBaseFeatureNamesV2b(),
    ...orderedLogisticMissingIndicatorNamesV2b(),
  ];
}

export type FeatureAblationAuditV2b = {
  V2A_BASE_FEATURE_COUNT: number;
  REMOVED_BASE_FEATURE_COUNT: number;
  V2B_BASE_FEATURE_COUNT: number;
  MISSING_INDICATOR_COUNT: number;
  V2B_MODEL_DIMENSIONS: number;
  REMOVED_FEATURES: string[];
  ADDED_FEATURE_COUNT: number;
  UNINTENDED_REMOVED_FEATURE_COUNT: number;
  MISSING_INDICATOR_CHANGE_COUNT: number;
  EXACT_STREAK_REST_ABLATION: "PASS";
  STREAK_REST_FEATURES_IN_V2B_X: 0;
};

export function auditFeatureAblationV2b(): FeatureAblationAuditV2b {
  const v2aBase = orderedLogisticBaseFeatureNamesV2a();
  const v2bBase = orderedLogisticBaseFeatureNamesV2b();
  const v2aMissing = orderedLogisticMissingIndicatorNamesV2a();
  const v2bMissing = orderedLogisticMissingIndicatorNamesV2b();
  const v2aModel = orderedLogisticModelFeatureNamesV2a();
  const v2bModel = orderedLogisticModelFeatureNamesV2b();
  const removed = v2aBase.filter((name) => !v2bBase.includes(name));
  const added = v2bBase.filter((name) => !v2aBase.includes(name));
  const expectedRemoved = [...MLB_INDEPENDENT_LOGISTIC_REMOVED_STREAK_REST_V2B];
  const unintended = removed.filter(
    (name) => !expectedRemoved.includes(name as (typeof expectedRemoved)[number]),
  );
  const missingChange =
    v2aMissing.length !== v2bMissing.length ||
    v2aMissing.some((name, i) => name !== v2bMissing[i]);
  const presentRemoved = expectedRemoved.filter((name) => v2bModel.includes(name));
  const restMissingKept =
    v2bModel.includes("home.restDaysBefore.missing") &&
    v2bModel.includes("away.restDaysBefore.missing");
  if (
    v2aBase.length !== 29 ||
    v2bBase.length !== 23 ||
    v2aModel.length !== 51 ||
    v2bModel.length !== 45 ||
    removed.length !== 6 ||
    added.length !== 0 ||
    unintended.length !== 0 ||
    missingChange ||
    presentRemoved.length !== 0 ||
    !restMissingKept ||
    JSON.stringify(removed) !== JSON.stringify(expectedRemoved)
  ) {
    throw new IndependentLogisticError(
      "EXACT_STREAK_REST_ABLATION_FAIL",
      JSON.stringify({ removed, added, unintended, missingChange, restMissingKept }),
    );
  }
  return {
    V2A_BASE_FEATURE_COUNT: 29,
    REMOVED_BASE_FEATURE_COUNT: 6,
    V2B_BASE_FEATURE_COUNT: 23,
    MISSING_INDICATOR_COUNT: 22,
    V2B_MODEL_DIMENSIONS: 45,
    REMOVED_FEATURES: expectedRemoved,
    ADDED_FEATURE_COUNT: 0,
    UNINTENDED_REMOVED_FEATURE_COUNT: 0,
    MISSING_INDICATOR_CHANGE_COUNT: 0,
    EXACT_STREAK_REST_ABLATION: "PASS",
    STREAK_REST_FEATURES_IN_V2B_X: 0,
  };
}

export function assertForbiddenXScanV2b(): void {
  const names = orderedLogisticModelFeatureNamesV2b();
  for (const name of names) {
    for (const token of FORBIDDEN_X_TOKENS_V2B) {
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

export function assertLogisticFeatureSpecV2b(): void {
  const base = orderedLogisticBaseFeatureNamesV2b();
  const missing = orderedLogisticMissingIndicatorNamesV2b();
  const model = orderedLogisticModelFeatureNamesV2b();
  if (base.length !== MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V2B) {
    throw new IndependentLogisticError(
      "FEATURE_SPEC_INVALID",
      `base dim ${base.length} != ${MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V2B}`,
    );
  }
  if (missing.length !== MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V2B) {
    throw new IndependentLogisticError(
      "FEATURE_SPEC_INVALID",
      `missing dim ${missing.length} != ${MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V2B}`,
    );
  }
  if (model.length !== MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2B) {
    throw new IndependentLogisticError(
      "FEATURE_SPEC_INVALID",
      "model dim mismatch",
    );
  }
  auditFeatureAblationV2b();
  assertForbiddenXScanV2b();
}
