/**
 * Pure validation for MLB Independent Training Dataset Contract v1.
 * No I/O. No prediction/result/edge imports.
 */
import {
  MLB_INDEPENDENT_CLASS_A_TEMPORAL_POLICY_V1,
  MLB_INDEPENDENT_ENGINE_ADMISSION,
  MLB_INDEPENDENT_FEATURE_ARTIFACT_KEYS_V1,
  MLB_INDEPENDENT_FEATURE_BUILDER_VERSION,
  MLB_INDEPENDENT_FEATURE_ROW_KEYS_V1,
  MLB_INDEPENDENT_FEATURE_ROW_SCHEMA_V1,
  MLB_INDEPENDENT_FEATURE_SCHEMA_V1,
  MLB_INDEPENDENT_IDENTITY_KEYS_V1,
  MLB_INDEPENDENT_LABEL_ARTIFACT_KEYS_V1,
  MLB_INDEPENDENT_LABEL_BUILDER_VERSION,
  MLB_INDEPENDENT_LABEL_ROW_KEYS_V1,
  MLB_INDEPENDENT_LABEL_ROW_SCHEMA_V1,
  MLB_INDEPENDENT_LABEL_SCHEMA_V1,
  MLB_INDEPENDENT_LABEL_SOURCE_V1,
  MLB_INDEPENDENT_PROHIBITED_FEATURE_KEYS_V1,
  MLB_INDEPENDENT_TEAM_SIDE_KEYS_V1,
} from "./contract";

export type IndependentContractValidation = {
  ok: boolean;
  errors: string[];
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;

const PROHIBITED_NORMALIZED = new Set(
  MLB_INDEPENDENT_PROHIBITED_FEATURE_KEYS_V1.map(normalizeFeatureKeyToken),
);

const FEATURE_ROW_KEY_SET = new Set<string>(MLB_INDEPENDENT_FEATURE_ROW_KEYS_V1);
const FEATURE_ARTIFACT_KEY_SET = new Set<string>(
  MLB_INDEPENDENT_FEATURE_ARTIFACT_KEYS_V1,
);
const IDENTITY_KEY_SET = new Set<string>(MLB_INDEPENDENT_IDENTITY_KEYS_V1);
const TEAM_SIDE_KEY_SET = new Set<string>(MLB_INDEPENDENT_TEAM_SIDE_KEYS_V1);
const LABEL_ROW_KEY_SET = new Set<string>(MLB_INDEPENDENT_LABEL_ROW_KEYS_V1);
const LABEL_ARTIFACT_KEY_SET = new Set<string>(
  MLB_INDEPENDENT_LABEL_ARTIFACT_KEYS_V1,
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(errors: string[]): IndependentContractValidation {
  return { ok: false, errors };
}

function ok(): IndependentContractValidation {
  return { ok: true, errors: [] };
}

/** lowercase + strip non-alphanumeric separators. market_prior → marketprior */
export function normalizeFeatureKeyToken(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isProhibitedFeatureKey(key: string): boolean {
  return PROHIBITED_NORMALIZED.has(normalizeFeatureKeyToken(key));
}

export function isRealCalendarDate(isoDate: string): boolean {
  if (!ISO_DATE.test(isoDate)) return false;
  const y = Number(isoDate.slice(0, 4));
  const m = Number(isoDate.slice(5, 7));
  const d = Number(isoDate.slice(8, 10));
  const utc = Date.UTC(y, m - 1, d);
  const dt = new Date(utc);
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function previousOfficialDate(isoDate: string): string | null {
  if (!isRealCalendarDate(isoDate)) return null;
  const utc = Date.parse(`${isoDate}T00:00:00.000Z`);
  if (!Number.isFinite(utc)) return null;
  return new Date(utc - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isIsoInstant(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function calendarDateFromAsOf(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  if (isRealCalendarDate(value)) return value;
  if (!isIsoInstant(value)) return null;
  const day = new Date(Date.parse(value)).toISOString().slice(0, 10);
  return isRealCalendarDate(day) ? day : null;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

const RATE_ABS_TOLERANCE = 1e-6;

function isRate(value: unknown): boolean {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 1)
  );
}

function isNonNegFiniteOrNull(value: unknown): boolean {
  return (
    value === null ||
    (typeof value === "number" && Number.isFinite(value) && value >= 0)
  );
}

function isNullOrNonNegInt(value: unknown): boolean {
  return value === null || isNonNegInt(value);
}

function ratesMatch(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= RATE_ABS_TOLERANCE;
}

function walkProhibitedKeys(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) =>
      walkProhibitedKeys(item, `${path}[${i}]`, errors),
    );
    return;
  }
  if (!isRecord(value)) return;
  for (const key of Object.keys(value)) {
    const next = path ? `${path}.${key}` : key;
    if (isProhibitedFeatureKey(key)) {
      errors.push(`FEATURE_PROHIBITED_KEY:${next}`);
    }
    walkProhibitedKeys(value[key], next, errors);
  }
}

function assertAllowlist(
  value: Record<string, unknown>,
  allowed: Set<string>,
  path: string,
  errors: string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(`FEATURE_UNKNOWN_KEY:${path ? `${path}.${key}` : key}`);
    }
  }
}

function validateIdentity(
  raw: unknown,
  path: string,
  errors: string[],
): { officialDate: string; commenceTimeUtc: string } | null {
  if (!isRecord(raw)) {
    errors.push(`${path}:IDENTITY_NOT_OBJECT`);
    return null;
  }
  assertAllowlist(raw, IDENTITY_KEY_SET, path, errors);
  walkProhibitedKeys(raw, path, errors);

  if (!isPositiveInt(raw.gamePk)) {
    errors.push(`${path}.gamePk:INVALID_GAME_PK`);
  }
  if (typeof raw.officialDate !== "string" || !isRealCalendarDate(raw.officialDate)) {
    errors.push(`${path}.officialDate:MALFORMED_OFFICIAL_DATE`);
  }
  if (!isPositiveInt(raw.homeTeamId)) {
    errors.push(`${path}.homeTeamId:INVALID_HOME_TEAM_ID`);
  }
  if (!isPositiveInt(raw.awayTeamId)) {
    errors.push(`${path}.awayTeamId:INVALID_AWAY_TEAM_ID`);
  }
  if (
    isPositiveInt(raw.homeTeamId) &&
    isPositiveInt(raw.awayTeamId) &&
    raw.homeTeamId === raw.awayTeamId
  ) {
    errors.push(`${path}:HOME_AWAY_TEAM_ID_EQUAL`);
  }
  if (raw.commenceTimeUtc == null || raw.commenceTimeUtc === "") {
    errors.push(`${path}.commenceTimeUtc:MISSING_COMMENCE_TIME_UTC`);
  } else if (!isIsoInstant(raw.commenceTimeUtc)) {
    errors.push(`${path}.commenceTimeUtc:MALFORMED_COMMENCE_TIME_UTC`);
  }

  const identityBroken = errors.some((e) => e.startsWith(`${path}`));
  if (identityBroken) return null;
  return {
    officialDate: raw.officialDate as string,
    commenceTimeUtc: raw.commenceTimeUtc as string,
  };
}

function validateTeamSide(
  raw: unknown,
  path: string,
  errors: string[],
): void {
  if (!isRecord(raw)) {
    errors.push(`${path}:TEAM_SIDE_NOT_OBJECT`);
    return;
  }
  assertAllowlist(raw, TEAM_SIDE_KEY_SET, path, errors);
  walkProhibitedKeys(raw, path, errors);

  const gamesOk = isNonNegInt(raw.gamesPlayedBefore);
  const winsOk = isNonNegInt(raw.winsBefore);
  const lossesOk = isNonNegInt(raw.lossesBefore);
  if (!gamesOk) errors.push(`${path}.gamesPlayedBefore:INVALID`);
  if (!winsOk) errors.push(`${path}.winsBefore:INVALID`);
  if (!lossesOk) errors.push(`${path}.lossesBefore:INVALID`);

  if (gamesOk && winsOk && lossesOk) {
    if (raw.winsBefore + raw.lossesBefore !== raw.gamesPlayedBefore) {
      errors.push(`${path}:FEATURE_SEASON_RECORD_MISMATCH`);
    }
  }

  if (!isRate(raw.winRateBefore)) {
    errors.push(`${path}.winRateBefore:INVALID`);
  } else if (gamesOk && winsOk) {
    if (raw.gamesPlayedBefore === 0) {
      if (raw.winRateBefore !== null) {
        errors.push(`${path}:FEATURE_WIN_RATE_MUST_BE_NULL`);
      }
    } else if (raw.winRateBefore === null) {
      errors.push(`${path}:FEATURE_WIN_RATE_REQUIRED`);
    } else if (
      !ratesMatch(raw.winRateBefore, raw.winsBefore / raw.gamesPlayedBefore)
    ) {
      errors.push(`${path}:FEATURE_WIN_RATE_INCONSISTENT`);
    }
  }

  const last5WinsOk = isNullOrNonNegInt(raw.last5WinsBefore);
  const last5LossesOk = isNullOrNonNegInt(raw.last5LossesBefore);
  if (!last5WinsOk) errors.push(`${path}.last5WinsBefore:INVALID`);
  if (!last5LossesOk) errors.push(`${path}.last5LossesBefore:INVALID`);

  let last5RateChecked = false;
  if (last5WinsOk && last5LossesOk) {
    const last5WinsNull = raw.last5WinsBefore === null;
    const last5LossesNull = raw.last5LossesBefore === null;
    if (last5WinsNull !== last5LossesNull) {
      errors.push(`${path}:FEATURE_LAST5_PARTIAL_PAIR`);
    } else if (last5WinsNull && last5LossesNull) {
      last5RateChecked = true;
      if (!isRate(raw.last5WinRateBefore)) {
        errors.push(`${path}.last5WinRateBefore:INVALID`);
      } else if (raw.last5WinRateBefore !== null) {
        errors.push(`${path}:FEATURE_LAST5_RATE_MUST_BE_NULL`);
      }
    } else if (gamesOk) {
      last5RateChecked = true;
      const last5Total =
        (raw.last5WinsBefore as number) + (raw.last5LossesBefore as number);
      const expectedLast5 = Math.min(5, raw.gamesPlayedBefore);
      if (last5Total !== expectedLast5) {
        errors.push(`${path}:FEATURE_LAST5_COUNT_SUM`);
      }
      if (!isRate(raw.last5WinRateBefore)) {
        errors.push(`${path}.last5WinRateBefore:INVALID`);
      } else if (last5Total === 0) {
        if (raw.last5WinRateBefore !== null) {
          errors.push(`${path}:FEATURE_LAST5_RATE_MUST_BE_NULL`);
        }
      } else if (raw.last5WinRateBefore === null) {
        errors.push(`${path}:FEATURE_LAST5_RATE_REQUIRED`);
      } else if (
        !ratesMatch(
          raw.last5WinRateBefore,
          (raw.last5WinsBefore as number) / last5Total,
        )
      ) {
        errors.push(`${path}:FEATURE_LAST5_RATE_INCONSISTENT`);
      }
    }
  }
  if (!last5RateChecked && !isRate(raw.last5WinRateBefore)) {
    errors.push(`${path}.last5WinRateBefore:INVALID`);
  }

  if (!isNonNegFiniteOrNull(raw.runsScoredAverageBefore)) {
    errors.push(`${path}.runsScoredAverageBefore:INVALID`);
  }
  if (!isNonNegFiniteOrNull(raw.runsAllowedAverageBefore)) {
    errors.push(`${path}.runsAllowedAverageBefore:INVALID`);
  }
  if (!isNonNegFiniteOrNull(raw.last5RunsScoredAverageBefore)) {
    errors.push(`${path}.last5RunsScoredAverageBefore:INVALID`);
  }
  if (!isNonNegFiniteOrNull(raw.last5RunsAllowedAverageBefore)) {
    errors.push(`${path}.last5RunsAllowedAverageBefore:INVALID`);
  }
  if (!isRate(raw.homeWinRateBefore)) {
    errors.push(`${path}.homeWinRateBefore:INVALID`);
  }
  if (!isRate(raw.awayWinRateBefore)) {
    errors.push(`${path}.awayWinRateBefore:INVALID`);
  }

  const winStreakOk = isNonNegInt(raw.currentWinStreakBefore);
  const lossStreakOk = isNonNegInt(raw.currentLossStreakBefore);
  if (!winStreakOk) errors.push(`${path}.currentWinStreakBefore:INVALID`);
  if (!lossStreakOk) errors.push(`${path}.currentLossStreakBefore:INVALID`);
  if (winStreakOk && lossStreakOk) {
    if (raw.currentWinStreakBefore > 0 && raw.currentLossStreakBefore > 0) {
      errors.push(`${path}:FEATURE_STREAK_MUTUAL_EXCLUSION`);
    }
    if (gamesOk) {
      if (
        raw.currentWinStreakBefore > raw.gamesPlayedBefore ||
        raw.currentLossStreakBefore > raw.gamesPlayedBefore
      ) {
        errors.push(`${path}:FEATURE_STREAK_EXCEEDS_GAMES`);
      }
      if (
        raw.gamesPlayedBefore === 0 &&
        (raw.currentWinStreakBefore !== 0 || raw.currentLossStreakBefore !== 0)
      ) {
        errors.push(`${path}:FEATURE_STREAK_ZERO_SAMPLE`);
      }
    }
  }

  if (!isNullOrNonNegInt(raw.restDaysBefore)) {
    errors.push(`${path}.restDaysBefore:INVALID`);
  }
}

export function validateIndependentFeatureRowV1(
  value: unknown,
): IndependentContractValidation {
  const errors: string[] = [];
  if (!isRecord(value)) return fail(["FEATURE_ROW_NOT_OBJECT"]);

  assertAllowlist(value, FEATURE_ROW_KEY_SET, "", errors);
  walkProhibitedKeys(value, "", errors);

  if (value.schemaVersion !== MLB_INDEPENDENT_FEATURE_ROW_SCHEMA_V1) {
    errors.push("FEATURE_ROW_SCHEMA_MISMATCH");
  }
  if (value.featureClass !== "SAFE_HISTORICALLY_RECONSTRUCTABLE") {
    errors.push("FEATURE_CLASS_NOT_ADMITTED_IN_V1_CORE");
  }
  if (value.temporalPolicy !== MLB_INDEPENDENT_CLASS_A_TEMPORAL_POLICY_V1) {
    errors.push("FEATURE_TEMPORAL_POLICY_MISMATCH");
  }
  if (value.temporalPhase === "UNKNOWN") {
    errors.push("FEATURE_UNKNOWN_TEMPORAL_PHASE_CANNOT_PROMOTE_TO_PREGAME");
  } else if (value.temporalPhase === "TRUE_PREGAME_OBSERVATION") {
    errors.push("FEATURE_CLASS_NOT_ADMITTED_IN_V1_CORE");
  } else if (value.temporalPhase !== "HISTORICAL_RECONSTRUCTION") {
    errors.push("FEATURE_TEMPORAL_PHASE_NOT_HISTORICAL_RECONSTRUCTION");
  }

  const identity = validateIdentity(value.identity, "identity", errors);

  if (
    typeof value.statsThroughDate !== "string" ||
    !isRealCalendarDate(value.statsThroughDate)
  ) {
    errors.push("statsThroughDate:MALFORMED");
  } else if (identity) {
    const latestAllowed = previousOfficialDate(identity.officialDate);
    if (
      latestAllowed != null &&
      value.statsThroughDate > latestAllowed
    ) {
      errors.push("FEATURE_D1_POLICY_VIOLATION");
    }
  }

  const asOfDate = calendarDateFromAsOf(value.asOf);
  if (asOfDate == null) {
    errors.push("asOf:MALFORMED");
  } else if (
    typeof value.statsThroughDate === "string" &&
    isRealCalendarDate(value.statsThroughDate) &&
    asOfDate !== value.statsThroughDate
  ) {
    errors.push("FEATURE_ASOF_NOT_EQUAL_STATS_THROUGH_DATE");
  }

  if (value.cutoffTime != null) {
    const cutoffOk =
      typeof value.cutoffTime === "string" &&
      (isRealCalendarDate(value.cutoffTime) || isIsoInstant(value.cutoffTime));
    if (!cutoffOk) errors.push("cutoffTime:MALFORMED");
  }

  validateTeamSide(value.home, "home", errors);
  validateTeamSide(value.away, "away", errors);

  const h2hGamesOk = isNonNegInt(value.headToHeadGamesBefore);
  const h2hHomeOk = isNonNegInt(value.headToHeadHomeWinsBefore);
  const h2hAwayOk = isNonNegInt(value.headToHeadAwayWinsBefore);
  if (!h2hGamesOk) errors.push("headToHeadGamesBefore:INVALID");
  if (!h2hHomeOk) errors.push("headToHeadHomeWinsBefore:INVALID");
  if (!h2hAwayOk) errors.push("headToHeadAwayWinsBefore:INVALID");
  if (
    h2hGamesOk &&
    h2hHomeOk &&
    h2hAwayOk &&
    value.headToHeadHomeWinsBefore + value.headToHeadAwayWinsBefore !==
      value.headToHeadGamesBefore
  ) {
    errors.push("FEATURE_H2H_RECORD_MISMATCH");
  }

  if (value.featureHash != null) {
    if (
      typeof value.featureHash !== "string" ||
      !SHA256_HEX.test(value.featureHash)
    ) {
      errors.push("featureHash:MALFORMED");
    }
  }

  return errors.length === 0 ? ok() : fail([...new Set(errors)]);
}

export function validateIndependentFeatureArtifactV1(
  value: unknown,
): IndependentContractValidation {
  const errors: string[] = [];
  if (!isRecord(value)) return fail(["FEATURE_ARTIFACT_NOT_OBJECT"]);

  assertAllowlist(value, FEATURE_ARTIFACT_KEY_SET, "", errors);
  walkProhibitedKeys(value, "", errors);

  if (value.schemaVersion !== MLB_INDEPENDENT_FEATURE_SCHEMA_V1) {
    errors.push("FEATURE_ARTIFACT_SCHEMA_MISMATCH");
  }
  if (value.schemaVersion === MLB_INDEPENDENT_LABEL_SCHEMA_V1) {
    errors.push("FEATURE_ARTIFACT_USED_LABEL_SCHEMA");
  }
  if (value.builderVersion !== MLB_INDEPENDENT_FEATURE_BUILDER_VERSION) {
    errors.push("FEATURE_ARTIFACT_BUILDER_MISMATCH");
  }
  if (value.researchOnly !== true) errors.push("FEATURE_ARTIFACT_RESEARCH_ONLY");
  if (value.independentModelSample !== 0) {
    errors.push("FEATURE_ARTIFACT_INDEPENDENT_MODEL_SAMPLE_NOT_ZERO");
  }
  if (value.engineAdmission !== MLB_INDEPENDENT_ENGINE_ADMISSION) {
    errors.push("FEATURE_ARTIFACT_ENGINE_ADMISSION");
  }
  if (value.datasetReady !== false) {
    errors.push("FEATURE_ARTIFACT_MUST_NOT_CLAIM_DATASET_READY");
  }
  if (value.temporalPolicy !== MLB_INDEPENDENT_CLASS_A_TEMPORAL_POLICY_V1) {
    errors.push("FEATURE_ARTIFACT_TEMPORAL_POLICY");
  }
  if (value.featureClass !== "SAFE_HISTORICALLY_RECONSTRUCTABLE") {
    errors.push("FEATURE_ARTIFACT_FEATURE_CLASS");
  }
  if (value.writeOnce !== true) errors.push("FEATURE_ARTIFACT_WRITE_ONCE");
  if (!Array.isArray(value.rows)) {
    errors.push("FEATURE_ARTIFACT_ROWS_NOT_ARRAY");
    return fail([...new Set(errors)]);
  }

  value.rows.forEach((row, i) => {
    const inner = validateIndependentFeatureRowV1(row);
    if (!inner.ok) {
      for (const e of inner.errors) errors.push(`rows[${i}]:${e}`);
    }
  });

  return errors.length === 0 ? ok() : fail([...new Set(errors)]);
}

export function validateIndependentLabelRowV1(
  value: unknown,
): IndependentContractValidation {
  const errors: string[] = [];
  if (!isRecord(value)) return fail(["LABEL_ROW_NOT_OBJECT"]);

  for (const key of Object.keys(value)) {
    if (!LABEL_ROW_KEY_SET.has(key)) {
      errors.push(`LABEL_UNKNOWN_KEY:${key}`);
    }
  }

  if (value.schemaVersion !== MLB_INDEPENDENT_LABEL_ROW_SCHEMA_V1) {
    errors.push("LABEL_ROW_SCHEMA_MISMATCH");
  }
  if (value.schemaVersion === MLB_INDEPENDENT_FEATURE_ROW_SCHEMA_V1) {
    errors.push("LABEL_ROW_USED_FEATURE_SCHEMA");
  }

  validateIdentity(value.identity, "identity", errors);

  if (value.status !== "FINAL") {
    errors.push("LABEL_STATUS_NOT_ELIGIBLE");
  }
  if (value.winner == null) {
    errors.push("LABEL_WINNER_NULL");
  } else if (value.winner === "DRAW") {
    errors.push("LABEL_WINNER_DRAW");
  } else if (value.winner !== "HOME" && value.winner !== "AWAY") {
    errors.push("LABEL_WINNER_NOT_ELIGIBLE");
  }

  if (value.labelSource !== MLB_INDEPENDENT_LABEL_SOURCE_V1) {
    errors.push("LABEL_SOURCE_NOT_OFFICIAL_RESULT_ARTIFACT");
  }

  const expectedTarget =
    value.winner === "HOME" ? 1 : value.winner === "AWAY" ? 0 : null;
  if (expectedTarget != null && value.target !== expectedTarget) {
    errors.push("LABEL_TARGET_MISMATCH");
  }
  if (value.target !== 0 && value.target !== 1) {
    errors.push("LABEL_TARGET_INVALID");
  }

  return errors.length === 0 ? ok() : fail([...new Set(errors)]);
}

export function validateIndependentLabelArtifactV1(
  value: unknown,
): IndependentContractValidation {
  const errors: string[] = [];
  if (!isRecord(value)) return fail(["LABEL_ARTIFACT_NOT_OBJECT"]);

  for (const key of Object.keys(value)) {
    if (!LABEL_ARTIFACT_KEY_SET.has(key)) {
      errors.push(`LABEL_UNKNOWN_KEY:${key}`);
    }
  }

  if (value.schemaVersion !== MLB_INDEPENDENT_LABEL_SCHEMA_V1) {
    errors.push("LABEL_ARTIFACT_SCHEMA_MISMATCH");
  }
  if (value.schemaVersion === MLB_INDEPENDENT_FEATURE_SCHEMA_V1) {
    errors.push("LABEL_ARTIFACT_USED_FEATURE_SCHEMA");
  }
  if (value.builderVersion !== MLB_INDEPENDENT_LABEL_BUILDER_VERSION) {
    errors.push("LABEL_ARTIFACT_BUILDER_MISMATCH");
  }
  if (value.researchOnly !== true) errors.push("LABEL_ARTIFACT_RESEARCH_ONLY");
  if (value.independentModelSample !== 0) {
    errors.push("LABEL_ARTIFACT_INDEPENDENT_MODEL_SAMPLE_NOT_ZERO");
  }
  if (value.engineAdmission !== MLB_INDEPENDENT_ENGINE_ADMISSION) {
    errors.push("LABEL_ARTIFACT_ENGINE_ADMISSION");
  }
  if (value.datasetReady !== false) {
    errors.push("LABEL_ARTIFACT_MUST_NOT_CLAIM_DATASET_READY");
  }
  if (value.target !== "HOME_WIN") errors.push("LABEL_ARTIFACT_TARGET");
  if (value.labelSource !== MLB_INDEPENDENT_LABEL_SOURCE_V1) {
    errors.push("LABEL_ARTIFACT_SOURCE");
  }
  if (!Array.isArray(value.rows)) {
    errors.push("LABEL_ARTIFACT_ROWS_NOT_ARRAY");
    return fail([...new Set(errors)]);
  }

  value.rows.forEach((row, i) => {
    const inner = validateIndependentLabelRowV1(row);
    if (!inner.ok) {
      for (const e of inner.errors) errors.push(`rows[${i}]:${e}`);
    }
  });

  return errors.length === 0 ? ok() : fail([...new Set(errors)]);
}
