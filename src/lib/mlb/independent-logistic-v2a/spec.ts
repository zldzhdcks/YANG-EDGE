/**
 * Season-volume ablation feature spec for Independent Logistic Prototype v2-A.
 * Removes exactly six absolute cumulative season-count features from v1 X.
 * Does not modify frozen v1 modules.
 */
import {
  IndependentLogisticError,
  orderedLogisticBaseFeatureNamesV1,
  orderedLogisticMissingIndicatorNamesV1,
} from "../independent-logistic-v1/spec";

export { IndependentLogisticError };

export const MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_ID_V2A =
  "SEASON_VOLUME_ABLATION_V2A" as const;
export const MLB_INDEPENDENT_LOGISTIC_EXPERIMENT_TYPE_V2A =
  "SEASON_VOLUME_ABLATION" as const;

export const MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2A =
  "7cb5253c824de514c25b1715e6f339b0f35c6942fa25c178423a415ec820430e";

export const MLB_INDEPENDENT_LOGISTIC_REMOVED_SEASON_VOLUME_V2A = [
  "home.gamesPlayedBefore",
  "home.winsBefore",
  "home.lossesBefore",
  "away.gamesPlayedBefore",
  "away.winsBefore",
  "away.lossesBefore",
] as const;

export const MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V2A = 29;
export const MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V2A = 22;
export const MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2A = 51;

export const FORBIDDEN_X_TOKENS_V2A = [
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

export function orderedLogisticMissingIndicatorNamesV2a(): string[] {
  return orderedLogisticMissingIndicatorNamesV1();
}

export function orderedLogisticBaseFeatureNamesV2a(): string[] {
  const removed = new Set<string>(MLB_INDEPENDENT_LOGISTIC_REMOVED_SEASON_VOLUME_V2A);
  return orderedLogisticBaseFeatureNamesV1().filter((name) => !removed.has(name));
}

export function orderedLogisticModelFeatureNamesV2a(): string[] {
  return [
    ...orderedLogisticBaseFeatureNamesV2a(),
    ...orderedLogisticMissingIndicatorNamesV2a(),
  ];
}

export type FeatureAblationAuditV2a = {
  V1_BASE_FEATURE_COUNT: number;
  V2A_BASE_FEATURE_COUNT: number;
  REMOVED_FEATURE_COUNT: number;
  REMOVED_FEATURES: string[];
  ADDED_FEATURE_COUNT: number;
  UNINTENDED_REMOVED_FEATURE_COUNT: number;
  MISSING_INDICATOR_CHANGE_COUNT: number;
  EXACT_SINGLE_ABLATION: "PASS";
  SEASON_VOLUME_FEATURES_IN_V2A_X: 0;
};

export function auditFeatureAblationV2a(): FeatureAblationAuditV2a {
  const v1Base = orderedLogisticBaseFeatureNamesV1();
  const v2aBase = orderedLogisticBaseFeatureNamesV2a();
  const v1Missing = orderedLogisticMissingIndicatorNamesV1();
  const v2aMissing = orderedLogisticMissingIndicatorNamesV2a();
  const removed = v1Base.filter((name) => !v2aBase.includes(name));
  const added = v2aBase.filter((name) => !v1Base.includes(name));
  const expectedRemoved = [...MLB_INDEPENDENT_LOGISTIC_REMOVED_SEASON_VOLUME_V2A];
  const unintended = removed.filter((name) => !expectedRemoved.includes(name as (typeof expectedRemoved)[number]));
  const missingChange =
    v1Missing.length !== v2aMissing.length ||
    v1Missing.some((name, i) => name !== v2aMissing[i]);
  const presentRemoved = expectedRemoved.filter((name) =>
    orderedLogisticModelFeatureNamesV2a().includes(name),
  );
  if (
    v1Base.length !== 35 ||
    v2aBase.length !== 29 ||
    removed.length !== 6 ||
    added.length !== 0 ||
    unintended.length !== 0 ||
    missingChange ||
    presentRemoved.length !== 0 ||
    JSON.stringify(removed) !== JSON.stringify(expectedRemoved)
  ) {
    throw new IndependentLogisticError(
      "EXACT_SINGLE_ABLATION_FAIL",
      JSON.stringify({ removed, added, unintended, missingChange }),
    );
  }
  return {
    V1_BASE_FEATURE_COUNT: 35,
    V2A_BASE_FEATURE_COUNT: 29,
    REMOVED_FEATURE_COUNT: 6,
    REMOVED_FEATURES: expectedRemoved,
    ADDED_FEATURE_COUNT: 0,
    UNINTENDED_REMOVED_FEATURE_COUNT: 0,
    MISSING_INDICATOR_CHANGE_COUNT: 0,
    EXACT_SINGLE_ABLATION: "PASS",
    SEASON_VOLUME_FEATURES_IN_V2A_X: 0,
  };
}

export function assertForbiddenXScanV2a(): void {
  const names = orderedLogisticModelFeatureNamesV2a();
  for (const name of names) {
    for (const token of FORBIDDEN_X_TOKENS_V2A) {
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

export function assertLogisticFeatureSpecV2a(): void {
  const base = orderedLogisticBaseFeatureNamesV2a();
  const missing = orderedLogisticMissingIndicatorNamesV2a();
  const model = orderedLogisticModelFeatureNamesV2a();
  if (base.length !== MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V2A) {
    throw new IndependentLogisticError(
      "FEATURE_SPEC_INVALID",
      `base dim ${base.length} != ${MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V2A}`,
    );
  }
  if (missing.length !== MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V2A) {
    throw new IndependentLogisticError(
      "FEATURE_SPEC_INVALID",
      `missing dim ${missing.length} != ${MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V2A}`,
    );
  }
  if (model.length !== MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2A) {
    throw new IndependentLogisticError(
      "FEATURE_SPEC_INVALID",
      "model dim mismatch",
    );
  }
  auditFeatureAblationV2a();
  assertForbiddenXScanV2a();
}
