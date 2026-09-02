/**
 * 2025 EXTERNAL REPLICATION TRACK — HOME_WIN / AWAY_WIN label materializer.
 *
 * Source-only answer key. LOCAL ONLY. Does not read SAFE_A rows, join, or
 * evaluate any model. Does not rewrite sealed 2024 labels.
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
  MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256,
  MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK,
  independentExternalReplication2025SourceRel,
  serializeExternalReplicationJson,
  sha256Utf8,
  validateExternalReplicationSourceArtifact2025,
  type ExternalReplicationSourceArtifact2025,
} from "./source-2025";

export const MLB_INDEPENDENT_2025_LABEL_STAGE = "LABELS" as const;

/** Track coexistence pin only. This module never opens the SAFE_A artifact. */
export const MLB_INDEPENDENT_2025_COEXISTING_SAFE_A_FEATURE_SHA256 =
  "a6ac441c646bf5ad8e5d5d7cb9664388a90454a13e64e9b7413a55001a3dc61d";

export const MLB_INDEPENDENT_2025_LABEL_CROSS_DATE_RESUME_GAME_PKS = [
  777861, 777623, 777294, 776907,
] as const;

export function independentExternalReplication2025LabelRel(): string {
  return "data/research/mlb/independent-model-v1/external-replication/2025/labels/2025-home-win-label-artifact-v1.json";
}

export function independentExternalReplication2025LabelPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentExternalReplication2025LabelRel());
}

export function independentExternalReplication2025LabelAuditRel(): string {
  return "data/research/mlb/independent-model-v1/external-replication/2025/audits/2025-label-materialization-audit-v1.json";
}

export function independentExternalReplication2025LabelAuditPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentExternalReplication2025LabelAuditRel());
}

export type ExternalReplicationLabelExclusionReason =
  | "CANCELLED"
  | "POSTPONED"
  | "SUSPENDED"
  | "NOT_FINAL"
  | "UNKNOWN"
  | "TIED_FINAL"
  | "INVALID_SCORE"
  | "INVALID_IDENTITY"
  | "INVALID_GAME_TYPE";

export type ExternalReplicationExcludedLabel = {
  gamePk: number;
  officialDate: string;
  reason: ExternalReplicationLabelExclusionReason;
};

export type ExternalReplicationCrossDateResumeLabelCase = {
  gamePk: number;
  officialDate: string;
  winner: "HOME" | "AWAY" | null;
  target: 0 | 1 | null;
  resultProvenanceStatus: string;
  safeResultApplyDate: string | null;
};

export type ExternalReplicationLabelAudit2025 = {
  generatedAt: string;
  researchOnly: true;
  track: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK;
  stage: typeof MLB_INDEPENDENT_2025_LABEL_STAGE;
  season: 2025;
  engineAdmission: "PROHIBITED";
  modelEvaluated: false;
  modelCandidate: false;
  marketUsed: false;
  networkUsed: false;
  engineChanged: false;
  featuresExist: true;
  featureArtifactRead: false;
  labelsCreated: true;
  joinCreated: false;
  modelProbabilitiesCreated: false;
  sourceArtifactRel: string;
  sourceArtifactSha256: string;
  labelArtifactRel: string;
  labelArtifactSha256: string;
  featureArtifactSha256: typeof MLB_INDEPENDENT_2025_COEXISTING_SAFE_A_FEATURE_SHA256;
  sourceRowCount: number;
  labelRowCount: number;
  excludedRowCount: number;
  winnerDistribution: { HOME: number; AWAY: number };
  targetDistribution: { "1": number; "0": number };
  exclusionReasonCounts: Record<string, number>;
  uniqueGamePk: number;
  duplicateGamePk: number;
  sourceIdentityMismatch: number;
  sourceWithoutLabelCount: number;
  labelWithoutSourceCount: number;
  crossDateResumeLabelCases: ExternalReplicationCrossDateResumeLabelCase[];
  contractChecks: {
    allLabelRowsValid: boolean;
    labelArtifactValid: boolean;
  };
};

export type ExternalReplicationLabelResult2025 = {
  artifact: MlbIndependentLabelArtifactV1;
  audit: ExternalReplicationLabelAudit2025;
  excluded: ExternalReplicationExcludedLabel[];
};

export class ExternalReplicationLabelError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "ExternalReplicationLabelError";
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

export function disposeExternalReplicationLabelGame2025(
  game: MlbIndependentSafeAHistoricalGameV1,
):
  | { kind: "LABEL"; winner: "HOME" | "AWAY"; target: 0 | 1 }
  | { kind: "EXCLUDE"; reason: ExternalReplicationLabelExclusionReason } {
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

export function assertExternalReplication2025LabelSourcePin(
  sourceSha256: string,
): void {
  if (sourceSha256 !== MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256) {
    throw new ExternalReplicationLabelError(
      "SOURCE_SHA_PIN_MISMATCH",
      `expected ${MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256}, got ${sourceSha256}`,
    );
  }
}

export function hashExternalReplicationLabelArtifact2025(
  artifact: MlbIndependentLabelArtifactV1,
): string {
  return sha256Utf8(serializeExternalReplicationJson(artifact));
}

export function findExternalReplicationLabelRow2025(
  artifact: MlbIndependentLabelArtifactV1,
  gamePk: number,
): MlbIndependentLabelRowV1 | undefined {
  return artifact.rows.find((row) => row.identity.gamePk === gamePk);
}

export function materializeExternalReplicationLabels2025(
  source: ExternalReplicationSourceArtifact2025,
  options?: {
    sourcePath?: string;
    generatedAt?: string;
    expectedSourceSha256?: string;
  },
): ExternalReplicationLabelResult2025 {
  validateExternalReplicationSourceArtifact2025(source);
  if (options?.expectedSourceSha256 != null) {
    assertExternalReplication2025LabelSourcePin(options.expectedSourceSha256);
  }

  const games = [...source.games].sort(compareHistoricalGames);
  const rows: MlbIndependentLabelRowV1[] = [];
  const excluded: ExternalReplicationExcludedLabel[] = [];
  const exclusionReasonCounts: Record<string, number> = {};
  let homeWins = 0;
  let awayWins = 0;

  for (const game of games) {
    const disposition = disposeExternalReplicationLabelGame2025(game);
    if (disposition.kind === "EXCLUDE") {
      excluded.push({
        gamePk: game.gamePk,
        officialDate: game.officialDate,
        reason: disposition.reason,
      });
      incrementCount(exclusionReasonCounts, disposition.reason);
      continue;
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
      throw new ExternalReplicationLabelError(
        "LABEL_ROW_INVALID",
        `gamePk ${game.gamePk}: ${check.errors.join(" | ")}`,
      );
    }
    rows.push(row);
    if (disposition.winner === "HOME") homeWins += 1;
    else awayWins += 1;
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
    throw new ExternalReplicationLabelError(
      "LABEL_ARTIFACT_INVALID",
      artifactCheck.errors.join(" | "),
    );
  }

  const seen = new Set<number>();
  let duplicateGamePk = 0;
  for (const row of rows) {
    if (seen.has(row.identity.gamePk)) duplicateGamePk += 1;
    seen.add(row.identity.gamePk);
  }

  const sourcePkSet = new Set(games.map((g) => g.gamePk));
  const labelPkSet = new Set(rows.map((r) => r.identity.gamePk));
  let sourceWithoutLabelCount = 0;
  for (const pk of sourcePkSet) {
    if (!labelPkSet.has(pk)) sourceWithoutLabelCount += 1;
  }
  let labelWithoutSourceCount = 0;
  for (const pk of labelPkSet) {
    if (!sourcePkSet.has(pk)) labelWithoutSourceCount += 1;
  }

  let sourceIdentityMismatch = 0;
  for (const row of rows) {
    const src = games.find((g) => g.gamePk === row.identity.gamePk);
    if (!src) {
      sourceIdentityMismatch += 1;
      continue;
    }
    if (
      src.officialDate !== row.identity.officialDate ||
      src.homeTeamId !== row.identity.homeTeamId ||
      src.awayTeamId !== row.identity.awayTeamId ||
      src.commenceTimeUtc !== row.identity.commenceTimeUtc
    ) {
      sourceIdentityMismatch += 1;
    }
  }

  const crossDateResumeLabelCases =
    MLB_INDEPENDENT_2025_LABEL_CROSS_DATE_RESUME_GAME_PKS.map((gamePk) => {
      const src = games.find((g) => g.gamePk === gamePk);
      const label = rows.find((r) => r.identity.gamePk === gamePk);
      return {
        gamePk,
        officialDate: src?.officialDate ?? label?.identity.officialDate ?? "",
        winner: label?.winner ?? null,
        target: label?.target ?? null,
        resultProvenanceStatus: src?.resultProvenanceStatus ?? "MISSING",
        safeResultApplyDate: src?.safeResultApplyDate ?? null,
      };
    });

  const labelArtifactSha256 = hashExternalReplicationLabelArtifact2025(artifact);

  const audit: ExternalReplicationLabelAudit2025 = {
    generatedAt: options?.generatedAt ?? new Date().toISOString(),
    researchOnly: true,
    track: MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK,
    stage: MLB_INDEPENDENT_2025_LABEL_STAGE,
    season: 2025,
    engineAdmission: "PROHIBITED",
    modelEvaluated: false,
    modelCandidate: false,
    marketUsed: false,
    networkUsed: false,
    engineChanged: false,
    featuresExist: true,
    featureArtifactRead: false,
    labelsCreated: true,
    joinCreated: false,
    modelProbabilitiesCreated: false,
    sourceArtifactRel:
      options?.sourcePath ?? independentExternalReplication2025SourceRel(),
    sourceArtifactSha256:
      options?.expectedSourceSha256 ?? "SYNTHETIC_SOURCE_UNPINNED",
    labelArtifactRel: independentExternalReplication2025LabelRel(),
    labelArtifactSha256,
    featureArtifactSha256: MLB_INDEPENDENT_2025_COEXISTING_SAFE_A_FEATURE_SHA256,
    sourceRowCount: source.rowCount,
    labelRowCount: rows.length,
    excludedRowCount: excluded.length,
    winnerDistribution: { HOME: homeWins, AWAY: awayWins },
    targetDistribution: { "1": homeWins, "0": awayWins },
    exclusionReasonCounts,
    uniqueGamePk: seen.size,
    duplicateGamePk,
    sourceIdentityMismatch,
    sourceWithoutLabelCount,
    labelWithoutSourceCount,
    crossDateResumeLabelCases,
    contractChecks: {
      allLabelRowsValid: true,
      labelArtifactValid: true,
    },
  };

  return { artifact, audit, excluded };
}
