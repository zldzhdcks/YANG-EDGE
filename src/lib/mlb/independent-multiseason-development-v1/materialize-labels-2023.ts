/**
 * MULTI-SEASON DEVELOPMENT TRACK — 2023 HOME_WIN / AWAY_WIN label materializer.
 *
 * Source-only answer key. LOCAL ONLY. Does not read SAFE_A rows, join, or
 * evaluate any model. Does not rewrite sealed 2024/2025 labels.
 */
import path from "node:path";
import {
  MLB_INDEPENDENT_AWAY_WIN,
  MLB_INDEPENDENT_ENGINE_ADMISSION,
  MLB_INDEPENDENT_HOME_WIN,
  MLB_INDEPENDENT_LABEL_BUILDER_VERSION,
  MLB_INDEPENDENT_LABEL_ROW_SCHEMA_V1,
  MLB_INDEPENDENT_LABEL_SCHEMA_V1,
  MLB_INDEPENDENT_LABEL_SOURCE_V1,
  MLB_INDEPENDENT_TARGET_V1,
  isRealCalendarDate,
  validateIndependentLabelArtifactV1,
  validateIndependentLabelRowV1,
  type MlbIndependentLabelArtifactV1,
  type MlbIndependentLabelRowV1,
} from "../independent-model-v1";
import {
  classifySourceStatus,
  compareHistoricalGames,
  isIsoInstant,
  isNonNegativeIntScore,
  type MlbIndependentSafeAHistoricalGameV1,
} from "../independent-safe-a-v1/historical-source";
import {
  MLB_INDEPENDENT_MULTISEASON_DEVELOPMENT_TRACK,
  MLB_INDEPENDENT_MULTISEASON_SEASON_2023,
  independentMultiseasonDevelopment2023SourceRel,
  serializeMultiseasonDevelopmentJson,
  sha256Utf8,
  validateMultiseasonDevelopmentSourceArtifact2023,
  type MultiseasonDevelopmentSourceArtifact2023,
} from "./source-2023";

export const MLB_INDEPENDENT_MULTISEASON_STAGE_LABELS = "LABELS" as const;

/** Source pin for labels. Independent of the SAFE_A module. */
export const MLB_INDEPENDENT_2023_LABEL_SOURCE_SHA256 =
  "0bd8526907a9023047e10ed5e3292487982f98915a1c9a50f816fec62ea80862";

/** Lineage pin only. This module never opens the SAFE_A artifact. */
export const MLB_INDEPENDENT_2023_COEXISTING_SAFE_A_FEATURE_SHA256 =
  "9926c918ee1b1317d4dd5100ba55ae700c815bdf17ee99caf9af63f5899fdde8";

export const MLB_INDEPENDENT_2023_LABEL_CROSS_DATE_RESUME_GAME_PKS = [
  718203, 717407, 717375, 717324, 716875, 716414, 716404,
] as const;

export function independentMultiseasonDevelopment2023LabelRel(): string {
  return "data/research/mlb/independent-model-v1/multi-season-development/2023/labels/2023-home-win-label-artifact-v1.json";
}

export function independentMultiseasonDevelopment2023LabelPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentMultiseasonDevelopment2023LabelRel());
}

export function independentMultiseasonDevelopment2023LabelAuditRel(): string {
  return "data/research/mlb/independent-model-v1/multi-season-development/2023/audits/2023-home-win-label-audit-v1.json";
}

export function independentMultiseasonDevelopment2023LabelAuditPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentMultiseasonDevelopment2023LabelAuditRel());
}

export type MultiseasonDevelopmentLabelExclusionReason =
  | "CANCELLED"
  | "POSTPONED"
  | "SUSPENDED"
  | "NOT_FINAL"
  | "UNKNOWN"
  | "TIED_FINAL"
  | "INVALID_SCORE"
  | "INVALID_IDENTITY"
  | "INVALID_GAME_TYPE";

export type MultiseasonDevelopmentExcludedLabel = {
  gamePk: number;
  officialDate: string;
  reason: MultiseasonDevelopmentLabelExclusionReason;
};

export type MultiseasonDevelopmentCrossDateResumeLabelCase = {
  gamePk: number;
  officialDate: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  winner: "HOME" | "AWAY" | null;
  target: 0 | 1 | null;
  resultProvenanceStatus: string;
  safeResultApplyDate: string | null;
};

export type MultiseasonDevelopmentLabelAudit2023 = {
  schemaVersion: "mlb-independent-multiseason-development-label-audit-v1";
  generatedAt: string;
  researchOnly: true;
  track: typeof MLB_INDEPENDENT_MULTISEASON_DEVELOPMENT_TRACK;
  stage: typeof MLB_INDEPENDENT_MULTISEASON_STAGE_LABELS;
  season: typeof MLB_INDEPENDENT_MULTISEASON_SEASON_2023;
  developmentEvidence: true;
  externalReplication: false;
  modelEvaluationAllowed: false;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  sourceShaVerified: boolean;
  sourceRows: number;
  labelRows: number;
  excludedRows: number;
  duplicateLabelGamePkCount: number;
  identityMismatchCount: number;
  winnerTargetMismatchCount: number;
  sourceScoreLabelMismatchCount: number;
  featureArtifactRead: false;
  featureRowsRead: 0;
  featureShaUsedForLabelDerivation: false;
  joinCreated: false;
  splitCreated: false;
  modelRead: false;
  modelUsed: false;
  holdoutEvaluated: false;
  holdoutFeatureRowsRead: 0;
  holdoutLabelRowsRead: 0;
  "2025RowsInspected": false;
  networkUsed: false;
  engineChanged: false;
  sourceArtifactRel: string;
  sourceArtifactSha256: string;
  labelArtifactRel: string;
  labelArtifactSha256: string;
  coexistingSafeAFeatureSha256: typeof MLB_INDEPENDENT_2023_COEXISTING_SAFE_A_FEATURE_SHA256;
  sourceRowCount: number;
  labelRowCount: number;
  excludedCount: number;
  excludedRowCount: number;
  homeWinLabelCount: number;
  awayWinLabelCount: number;
  homeWinRate: number | null;
  winnerDistribution: { HOME: number; AWAY: number };
  targetDistribution: { "1": number; "0": number };
  exclusionReasonCounts: Record<string, number>;
  uniqueGamePk: number;
  crossDateResumeLabelCases: MultiseasonDevelopmentCrossDateResumeLabelCase[];
  contractChecks: {
    allLabelRowsValid: boolean;
    labelArtifactValid: boolean;
  };
};

export type MultiseasonDevelopmentLabelResult2023 = {
  artifact: MlbIndependentLabelArtifactV1;
  audit: MultiseasonDevelopmentLabelAudit2023;
  excluded: MultiseasonDevelopmentExcludedLabel[];
};

export class MultiseasonDevelopmentLabelError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "MultiseasonDevelopmentLabelError";
    this.code = code;
  }
}

function incrementCount(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function isValidIdentity(game: MlbIndependentSafeAHistoricalGameV1): boolean {
  if (!Number.isInteger(game.gamePk) || game.gamePk <= 0) return false;
  if (!Number.isInteger(game.homeTeamId) || game.homeTeamId <= 0) return false;
  if (!Number.isInteger(game.awayTeamId) || game.awayTeamId <= 0) return false;
  if (game.homeTeamId === game.awayTeamId) return false;
  if (
    typeof game.officialDate !== "string" ||
    !isRealCalendarDate(game.officialDate)
  ) {
    return false;
  }
  return isIsoInstant(game.commenceTimeUtc);
}

export function disposeMultiseasonDevelopmentLabelGame2023(
  game: MlbIndependentSafeAHistoricalGameV1,
):
  | { kind: "LABEL"; winner: "HOME" | "AWAY"; target: 0 | 1 }
  | { kind: "EXCLUDE"; reason: MultiseasonDevelopmentLabelExclusionReason } {
  if (game.gameType !== "R") {
    return { kind: "EXCLUDE", reason: "INVALID_GAME_TYPE" };
  }
  if (!isValidIdentity(game)) {
    return { kind: "EXCLUDE", reason: "INVALID_IDENTITY" };
  }

  const status = classifySourceStatus(game);
  if (status === "CANCELLED") return { kind: "EXCLUDE", reason: "CANCELLED" };
  if (status === "POSTPONED") return { kind: "EXCLUDE", reason: "POSTPONED" };
  if (status === "SUSPENDED") return { kind: "EXCLUDE", reason: "SUSPENDED" };
  if (status === "UNKNOWN") return { kind: "EXCLUDE", reason: "UNKNOWN" };
  if (status !== "FINAL_STANDARD") {
    return { kind: "EXCLUDE", reason: "NOT_FINAL" };
  }

  if (
    !isNonNegativeIntScore(game.homeScore) ||
    !isNonNegativeIntScore(game.awayScore)
  ) {
    return { kind: "EXCLUDE", reason: "INVALID_SCORE" };
  }
  if (game.homeScore === game.awayScore) {
    return { kind: "EXCLUDE", reason: "TIED_FINAL" };
  }

  const winner: "HOME" | "AWAY" =
    game.homeScore > game.awayScore ? "HOME" : "AWAY";
  const target =
    winner === "HOME" ? MLB_INDEPENDENT_HOME_WIN : MLB_INDEPENDENT_AWAY_WIN;
  return { kind: "LABEL", winner, target };
}

function identityOf(game: MlbIndependentSafeAHistoricalGameV1) {
  return {
    gamePk: game.gamePk,
    officialDate: game.officialDate,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    commenceTimeUtc: game.commenceTimeUtc,
  };
}

export function assertMultiseasonDevelopment2023LabelSourcePin(
  sourceSha256: string,
): void {
  if (sourceSha256 !== MLB_INDEPENDENT_2023_LABEL_SOURCE_SHA256) {
    throw new MultiseasonDevelopmentLabelError(
      "SOURCE_SHA_PIN_MISMATCH",
      `expected ${MLB_INDEPENDENT_2023_LABEL_SOURCE_SHA256}, got ${sourceSha256}`,
    );
  }
}

export function hashMultiseasonDevelopmentLabelArtifact2023(
  artifact: MlbIndependentLabelArtifactV1,
): string {
  return sha256Utf8(serializeMultiseasonDevelopmentJson(artifact));
}

export function findMultiseasonDevelopmentLabelRow2023(
  artifact: MlbIndependentLabelArtifactV1,
  gamePk: number,
): MlbIndependentLabelRowV1 | undefined {
  return artifact.rows.find((row) => row.identity.gamePk === gamePk);
}

export function materializeMultiseasonDevelopmentLabels2023(
  source: MultiseasonDevelopmentSourceArtifact2023,
  options?: {
    sourcePath?: string;
    generatedAt?: string;
    expectedSourceSha256?: string;
  },
): MultiseasonDevelopmentLabelResult2023 {
  if (source.track !== MLB_INDEPENDENT_MULTISEASON_DEVELOPMENT_TRACK) {
    throw new MultiseasonDevelopmentLabelError(
      "WRONG_TRACK",
      `track must be ${MLB_INDEPENDENT_MULTISEASON_DEVELOPMENT_TRACK}`,
    );
  }
  if (source.season !== MLB_INDEPENDENT_MULTISEASON_SEASON_2023) {
    throw new MultiseasonDevelopmentLabelError(
      "WRONG_SEASON",
      "season must be 2023",
    );
  }
  validateMultiseasonDevelopmentSourceArtifact2023(source);
  if (options?.expectedSourceSha256 != null) {
    assertMultiseasonDevelopment2023LabelSourcePin(options.expectedSourceSha256);
  }

  const games = [...source.games].sort(compareHistoricalGames);
  const rows: MlbIndependentLabelRowV1[] = [];
  const excluded: MultiseasonDevelopmentExcludedLabel[] = [];
  const exclusionReasonCounts: Record<string, number> = {};
  let homeWins = 0;
  let awayWins = 0;
  let winnerTargetMismatchCount = 0;
  let sourceScoreLabelMismatchCount = 0;

  for (const game of games) {
    const disposition = disposeMultiseasonDevelopmentLabelGame2023(game);
    if (disposition.kind === "EXCLUDE") {
      excluded.push({
        gamePk: game.gamePk,
        officialDate: game.officialDate,
        reason: disposition.reason,
      });
      incrementCount(exclusionReasonCounts, disposition.reason);
      continue;
    }

    const expectedWinner: "HOME" | "AWAY" =
      (game.homeScore as number) > (game.awayScore as number) ? "HOME" : "AWAY";
    const expectedTarget =
      expectedWinner === "HOME" ? MLB_INDEPENDENT_HOME_WIN : MLB_INDEPENDENT_AWAY_WIN;
    if (disposition.winner !== expectedWinner || disposition.target !== expectedTarget) {
      winnerTargetMismatchCount += 1;
      sourceScoreLabelMismatchCount += 1;
    }

    const row: MlbIndependentLabelRowV1 = {
      schemaVersion: MLB_INDEPENDENT_LABEL_ROW_SCHEMA_V1,
      identity: identityOf(game),
      status: "FINAL",
      winner: disposition.winner,
      target: disposition.target,
      labelSource: MLB_INDEPENDENT_LABEL_SOURCE_V1,
    };
    const check = validateIndependentLabelRowV1(row);
    if (!check.ok) {
      throw new MultiseasonDevelopmentLabelError(
        "LABEL_ROW_INVALID",
        `gamePk ${game.gamePk}: ${check.errors.join(" | ")}`,
      );
    }
    rows.push(row);
    if (disposition.winner === "HOME") homeWins += 1;
    else awayWins += 1;
  }

  if (winnerTargetMismatchCount !== 0) {
    throw new MultiseasonDevelopmentLabelError(
      "WINNER_TARGET_MISMATCH",
      String(winnerTargetMismatchCount),
    );
  }

  const artifact: MlbIndependentLabelArtifactV1 = {
    schemaVersion: MLB_INDEPENDENT_LABEL_SCHEMA_V1,
    builderVersion: MLB_INDEPENDENT_LABEL_BUILDER_VERSION,
    researchOnly: true,
    independentModelSample: 0,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    datasetReady: false,
    target: MLB_INDEPENDENT_TARGET_V1,
    labelSource: MLB_INDEPENDENT_LABEL_SOURCE_V1,
    rows,
  };

  const artifactCheck = validateIndependentLabelArtifactV1(artifact);
  if (!artifactCheck.ok) {
    throw new MultiseasonDevelopmentLabelError(
      "LABEL_ARTIFACT_INVALID",
      artifactCheck.errors.join(" | "),
    );
  }

  const seen = new Set<number>();
  let duplicateLabelGamePkCount = 0;
  for (const row of rows) {
    if (seen.has(row.identity.gamePk)) duplicateLabelGamePkCount += 1;
    seen.add(row.identity.gamePk);
  }
  if (duplicateLabelGamePkCount !== 0) {
    throw new MultiseasonDevelopmentLabelError(
      "DUPLICATE_LABEL_GAME_PK",
      String(duplicateLabelGamePkCount),
    );
  }

  let identityMismatchCount = 0;
  const byPk = new Map(games.map((g) => [g.gamePk, g]));
  for (const row of rows) {
    const src = byPk.get(row.identity.gamePk);
    if (
      !src ||
      src.officialDate !== row.identity.officialDate ||
      src.homeTeamId !== row.identity.homeTeamId ||
      src.awayTeamId !== row.identity.awayTeamId ||
      src.commenceTimeUtc !== row.identity.commenceTimeUtc
    ) {
      identityMismatchCount += 1;
    }
  }
  if (identityMismatchCount !== 0) {
    throw new MultiseasonDevelopmentLabelError(
      "IDENTITY_MISMATCH",
      String(identityMismatchCount),
    );
  }

  if (rows.length + excluded.length !== source.rowCount) {
    throw new MultiseasonDevelopmentLabelError(
      "LABEL_COVERAGE_MISMATCH",
      `label ${rows.length} + excluded ${excluded.length} != source ${source.rowCount}`,
    );
  }
  if (
    options?.expectedSourceSha256 === MLB_INDEPENDENT_2023_LABEL_SOURCE_SHA256 &&
    (rows.length !== source.rowCount || excluded.length !== 0)
  ) {
    throw new MultiseasonDevelopmentLabelError(
      "LABEL_COVERAGE_MISMATCH",
      `pinned 2023 source requires labelRowCount=source.rowCount and zero exclusions; got label=${rows.length} excluded=${excluded.length} source=${source.rowCount}`,
    );
  }

  const crossDateResumeLabelCases =
    MLB_INDEPENDENT_2023_LABEL_CROSS_DATE_RESUME_GAME_PKS.map((gamePk) => {
      const src = games.find((g) => g.gamePk === gamePk);
      const label = rows.find((r) => r.identity.gamePk === gamePk);
      if (
        src &&
        label &&
        (label.identity.officialDate !== src.officialDate ||
          label.identity.homeTeamId !== src.homeTeamId ||
          label.identity.awayTeamId !== src.awayTeamId)
      ) {
        throw new MultiseasonDevelopmentLabelError(
          "CROSS_DATE_LABEL_IDENTITY_MISMATCH",
          `gamePk ${gamePk}`,
        );
      }
      return {
        gamePk,
        officialDate: src?.officialDate ?? label?.identity.officialDate ?? "",
        homeTeamId: src?.homeTeamId ?? label?.identity.homeTeamId ?? null,
        awayTeamId: src?.awayTeamId ?? label?.identity.awayTeamId ?? null,
        winner: label?.winner ?? null,
        target: label?.target ?? null,
        resultProvenanceStatus: src?.resultProvenanceStatus ?? "MISSING",
        safeResultApplyDate: src?.safeResultApplyDate ?? null,
      };
    });

  const labelArtifactSha256 = hashMultiseasonDevelopmentLabelArtifact2023(artifact);
  const homeWinRate = rows.length === 0 ? null : homeWins / rows.length;

  const audit: MultiseasonDevelopmentLabelAudit2023 = {
    schemaVersion: "mlb-independent-multiseason-development-label-audit-v1",
    generatedAt: options?.generatedAt ?? new Date().toISOString(),
    researchOnly: true,
    track: MLB_INDEPENDENT_MULTISEASON_DEVELOPMENT_TRACK,
    stage: MLB_INDEPENDENT_MULTISEASON_STAGE_LABELS,
    season: MLB_INDEPENDENT_MULTISEASON_SEASON_2023,
    developmentEvidence: true,
    externalReplication: false,
    modelEvaluationAllowed: false,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    sourceShaVerified: options?.expectedSourceSha256 != null,
    sourceRows: source.rowCount,
    labelRows: rows.length,
    excludedRows: excluded.length,
    duplicateLabelGamePkCount,
    identityMismatchCount,
    winnerTargetMismatchCount,
    sourceScoreLabelMismatchCount,
    featureArtifactRead: false,
    featureRowsRead: 0,
    featureShaUsedForLabelDerivation: false,
    joinCreated: false,
    splitCreated: false,
    modelRead: false,
    modelUsed: false,
    holdoutEvaluated: false,
    holdoutFeatureRowsRead: 0,
    holdoutLabelRowsRead: 0,
    "2025RowsInspected": false,
    networkUsed: false,
    engineChanged: false,
    sourceArtifactRel:
      options?.sourcePath ?? independentMultiseasonDevelopment2023SourceRel(),
    sourceArtifactSha256:
      options?.expectedSourceSha256 ?? "SYNTHETIC_SOURCE_UNPINNED",
    labelArtifactRel: independentMultiseasonDevelopment2023LabelRel(),
    labelArtifactSha256,
    coexistingSafeAFeatureSha256: MLB_INDEPENDENT_2023_COEXISTING_SAFE_A_FEATURE_SHA256,
    sourceRowCount: source.rowCount,
    labelRowCount: rows.length,
    excludedCount: excluded.length,
    excludedRowCount: excluded.length,
    homeWinLabelCount: homeWins,
    awayWinLabelCount: awayWins,
    homeWinRate,
    winnerDistribution: { HOME: homeWins, AWAY: awayWins },
    targetDistribution: { "1": homeWins, "0": awayWins },
    exclusionReasonCounts,
    uniqueGamePk: seen.size,
    crossDateResumeLabelCases,
    contractChecks: {
      allLabelRowsValid: true,
      labelArtifactValid: true,
    },
  };

  return { artifact, audit, excluded };
}
