/**
 * MLB Independent Model v1 — HOME_WIN label materializer.
 *
 * Pure / local-only. No network. No feature artifact I/O.
 * Post-result labels only. Does not join, train, or predict.
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
  validateHistoricalSourceArtifact,
  type MlbIndependentSafeAHistoricalGameV1,
  type MlbIndependentSafeAHistoricalSourceV1,
} from "../independent-safe-a-v1/historical-source";

export function independentLabelArtifactRel(): string {
  return "data/research/mlb/independent-model-v1/labels/2024-home-win-label-artifact-v1.json";
}

export function independentLabelArtifactPath(cwd = process.cwd()): string {
  return path.join(cwd, independentLabelArtifactRel());
}

export function independentLabelAuditRel(): string {
  return "data/research/mlb/independent-model-v1/audits/2024-label-materialization-audit-v1.json";
}

export function independentLabelAuditPath(cwd = process.cwd()): string {
  return path.join(cwd, independentLabelAuditRel());
}

export type IndependentLabelExclusionReason =
  | "CANCELLED"
  | "POSTPONED"
  | "SUSPENDED"
  | "NOT_FINAL"
  | "UNKNOWN"
  | "TIED_FINAL"
  | "INVALID_SCORE"
  | "INVALID_IDENTITY"
  | "INVALID_GAME_TYPE";

export type IndependentExcludedLabel = {
  gamePk: number;
  officialDate: string;
  reason: IndependentLabelExclusionReason;
};

export type IndependentLabelMaterializationAuditV1 = {
  generatedAt: string;
  sourcePath: string;
  sourceRows: number;
  labelRows: number;
  excludedRows: number;
  winnerDistribution: { HOME: number; AWAY: number };
  targetDistribution: { "1": number; "0": number };
  exclusionReasonCounts: Record<string, number>;
  identity: {
    uniqueGamePk: number;
    duplicateGamePk: number;
    sourceIdentityMismatch: number;
  };
  resumeLabelCases: Array<{
    gamePk: number;
    officialDate: string;
    winner: "HOME" | "AWAY" | null;
    target: 0 | 1 | null;
    provenanceStatus: string;
    safeResultApplyDate: string | null;
  }>;
  cancelled: {
    gamePk: 746577;
    labelCount: number;
    excluded: boolean;
  };
  contractChecks: {
    allLabelRowsValid: boolean;
    labelArtifactValid: boolean;
  };
  researchState: {
    DATASET_READY: false;
    INDEPENDENT_MODEL_SAMPLE: 0;
  };
};

export type IndependentLabelMaterializationResultV1 = {
  artifact: MlbIndependentLabelArtifactV1;
  audit: IndependentLabelMaterializationAuditV1;
  excluded: IndependentExcludedLabel[];
};

export class IndependentLabelMaterializationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "IndependentLabelMaterializationError";
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

function disposeLabelGame(
  game: MlbIndependentSafeAHistoricalGameV1,
):
  | { kind: "LABEL"; winner: "HOME" | "AWAY"; target: 0 | 1 }
  | { kind: "EXCLUDE"; reason: IndependentLabelExclusionReason } {
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
  const target = winner === "HOME" ? MLB_INDEPENDENT_HOME_WIN : MLB_INDEPENDENT_AWAY_WIN;
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

export function findLabelRow(
  artifact: MlbIndependentLabelArtifactV1,
  gamePk: number,
): MlbIndependentLabelRowV1 | undefined {
  return artifact.rows.find((row) => row.identity.gamePk === gamePk);
}

export function materializeIndependentLabelsV1(
  source: MlbIndependentSafeAHistoricalSourceV1,
  options?: { sourcePath?: string; generatedAt?: string },
): IndependentLabelMaterializationResultV1 {
  validateHistoricalSourceArtifact(source);

  const games = [...source.games].sort(compareHistoricalGames);
  const rows: MlbIndependentLabelRowV1[] = [];
  const excluded: IndependentExcludedLabel[] = [];
  const exclusionReasonCounts: Record<string, number> = {};
  let homeWins = 0;
  let awayWins = 0;

  for (const game of games) {
    const disposition = disposeLabelGame(game);
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
      throw new IndependentLabelMaterializationError(
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
    throw new IndependentLabelMaterializationError(
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

  let sourceIdentityMismatch = 0;
  for (const row of rows) {
    const src = source.games.find((g) => g.gamePk === row.identity.gamePk);
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

  const resumePks = [745180, 746942, 746755];
  const resumeLabelCases = resumePks.map((gamePk) => {
    const src = source.games.find((g) => g.gamePk === gamePk);
    const label = rows.find((r) => r.identity.gamePk === gamePk);
    return {
      gamePk,
      officialDate: src?.officialDate ?? label?.identity.officialDate ?? "",
      winner: label?.winner ?? null,
      target: label?.target ?? null,
      provenanceStatus: src?.resultProvenanceStatus ?? "MISSING",
      safeResultApplyDate: src?.safeResultApplyDate ?? null,
    };
  });

  const cancelledCount = rows.filter((r) => r.identity.gamePk === 746577).length;

  const audit: IndependentLabelMaterializationAuditV1 = {
    generatedAt: options?.generatedAt ?? new Date().toISOString(),
    sourcePath:
      options?.sourcePath ??
      "data/research/mlb/independent-model-v1/historical-source/2024-regular-season-v1.json",
    sourceRows: source.rowCount,
    labelRows: rows.length,
    excludedRows: excluded.length,
    winnerDistribution: { HOME: homeWins, AWAY: awayWins },
    targetDistribution: { "1": homeWins, "0": awayWins },
    exclusionReasonCounts,
    identity: {
      uniqueGamePk: seen.size,
      duplicateGamePk,
      sourceIdentityMismatch,
    },
    resumeLabelCases,
    cancelled: {
      gamePk: 746577,
      labelCount: cancelledCount,
      excluded: cancelledCount === 0,
    },
    contractChecks: {
      allLabelRowsValid: true,
      labelArtifactValid: true,
    },
    researchState: {
      DATASET_READY: false,
      INDEPENDENT_MODEL_SAMPLE: 0,
    },
  };

  return { artifact, audit, excluded };
}
