/**
 * SAFE_A Class A numeric feature specification for Independent Logistic Prototype v1.
 * Identity / label / result fields never enter X.
 */
export const MLB_INDEPENDENT_LOGISTIC_TEAM_SIDE_BASE_V1 = [
  "gamesPlayedBefore",
  "winsBefore",
  "lossesBefore",
  "winRateBefore",
  "last5WinsBefore",
  "last5LossesBefore",
  "last5WinRateBefore",
  "runsScoredAverageBefore",
  "runsAllowedAverageBefore",
  "last5RunsScoredAverageBefore",
  "last5RunsAllowedAverageBefore",
  "homeWinRateBefore",
  "awayWinRateBefore",
  "currentWinStreakBefore",
  "currentLossStreakBefore",
  "restDaysBefore",
] as const;

export const MLB_INDEPENDENT_LOGISTIC_NULLABLE_SIDE_FIELDS_V1 = [
  "winRateBefore",
  "last5WinsBefore",
  "last5LossesBefore",
  "last5WinRateBefore",
  "runsScoredAverageBefore",
  "runsAllowedAverageBefore",
  "last5RunsScoredAverageBefore",
  "last5RunsAllowedAverageBefore",
  "homeWinRateBefore",
  "awayWinRateBefore",
  "restDaysBefore",
] as const;

export const MLB_INDEPENDENT_LOGISTIC_H2H_FIELDS_V1 = [
  "headToHeadGamesBefore",
  "headToHeadHomeWinsBefore",
  "headToHeadAwayWinsBefore",
] as const;

export function orderedLogisticBaseFeatureNamesV1(): string[] {
  const names: string[] = [];
  for (const side of ["home", "away"] as const) {
    for (const field of MLB_INDEPENDENT_LOGISTIC_TEAM_SIDE_BASE_V1) {
      names.push(`${side}.${field}`);
    }
  }
  names.push(...MLB_INDEPENDENT_LOGISTIC_H2H_FIELDS_V1);
  return names;
}

export function orderedLogisticMissingIndicatorNamesV1(): string[] {
  const names: string[] = [];
  for (const side of ["home", "away"] as const) {
    for (const field of MLB_INDEPENDENT_LOGISTIC_NULLABLE_SIDE_FIELDS_V1) {
      names.push(`${side}.${field}.missing`);
    }
  }
  return names;
}

export function orderedLogisticModelFeatureNamesV1(): string[] {
  return [
    ...orderedLogisticBaseFeatureNamesV1(),
    ...orderedLogisticMissingIndicatorNamesV1(),
  ];
}

export const MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V1 = 35;
export const MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V1 = 22;
export const MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V1 = 57;

export class IndependentLogisticError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "IndependentLogisticError";
    this.code = code;
  }
}

export function assertLogisticFeatureSpecV1(): void {
  const base = orderedLogisticBaseFeatureNamesV1();
  const missing = orderedLogisticMissingIndicatorNamesV1();
  if (base.length !== MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V1) {
    throw new IndependentLogisticError(
      "FEATURE_SPEC_INVALID",
      `base dim ${base.length} != ${MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V1}`,
    );
  }
  if (missing.length !== MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V1) {
    throw new IndependentLogisticError(
      "FEATURE_SPEC_INVALID",
      `missing dim ${missing.length} != ${MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V1}`,
    );
  }
  if (
    orderedLogisticModelFeatureNamesV1().length !==
    MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V1
  ) {
    throw new IndependentLogisticError(
      "FEATURE_SPEC_INVALID",
      "model dim mismatch",
    );
  }
}
