/**
 * 2025 EXTERNAL REPLICATION TRACK — historical schedule/result source only.
 *
 * Official MLB Stats API. Does not materialize features, labels, join, or
 * evaluate any 2024 model. Does not rewrite sealed 2024 SAFE_A source.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import {
  createCacheUsage,
  getRawStatsJson,
  type CacheUsageStats,
} from "../research-stats-cache";
import {
  SafeAHistoricalSourceError,
  classifySourceStatus,
  collapseSameGamePkSnapshots,
  normalizeHistoricalSourceGames,
  parseMlbScheduleBodyToHistoricalGames,
  validateHistoricalSourceIdentity,
  validateHistoricalSourceResultProvenance,
  type MlbIndependentSafeAHistoricalGameV1,
} from "../independent-safe-a-v1/historical-source";

export { SafeAHistoricalSourceError };

export const MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_SCHEMA_V1 =
  "mlb-independent-external-replication-source-v1" as const;
export const MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_ORIGIN =
  "MLB_STATS_API" as const;
export const MLB_INDEPENDENT_EXTERNAL_REPLICATION_SEASON_2025 = 2025 as const;
export const MLB_INDEPENDENT_EXTERNAL_REPLICATION_GAME_TYPE_V1 = "R" as const;
export const MLB_INDEPENDENT_EXTERNAL_REPLICATION_SPORT_ID_V1 = 1 as const;
export const MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK =
  "2025_EXTERNAL_REPLICATION_TRACK" as const;

export const MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_QUERY_2025 =
  "/api/v1/schedule?sportId=1&startDate=2025-03-01&endDate=2025-11-15&gameType=R";

export const MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_ENDPOINT_2025 =
  "Official MLB Stats API schedule for sportId=1 (MLB), season window 2025-03-01..2025-11-15, gameType=R (Regular Season).";

export type ExternalReplicationHistoricalGameV1 =
  MlbIndependentSafeAHistoricalGameV1;

export type ExternalReplicationSourceArtifact2025 = {
  schemaVersion: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_SCHEMA_V1;
  researchOnly: true;
  track: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK;
  source: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_ORIGIN;
  season: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_SEASON_2025;
  gameType: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_GAME_TYPE_V1;
  sportId: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_SPORT_ID_V1;
  collectedAt: string;
  endpoint: string;
  query: string;
  rowCount: number;
  collapsedSameGamePkCount: number;
  games: ExternalReplicationHistoricalGameV1[];
};

export type ExternalReplicationManualReviewGameV1 = {
  gamePk: number;
  officialDate: string;
  homeTeamId: number;
  awayTeamId: number;
  abstractGameState: string | null;
  detailedState: string | null;
  codedGameState: string | null;
  statusClass: ReturnType<typeof classifySourceStatus>;
  resultProvenanceStatus: ExternalReplicationHistoricalGameV1["resultProvenanceStatus"];
  safeResultApplyDate: string | null;
  resumeDate?: string;
  resumedFrom?: string;
  resumeGameDate?: string;
  resumedFromDate?: string;
  rescheduleDate?: string;
  rescheduledFrom?: string;
  rescheduleGameDate?: string;
  description?: string;
  statusReason?: string;
  reviewReason: string;
};

export type ExternalReplicationCompleteness2025 = {
  rawScheduleSnapshotCount: number;
  uniqueFinalGamePkCount: number;
  collapsedDuplicateSnapshotCount: number;
  statusCounts: {
    FINAL_STANDARD: number;
    POSTPONED: number;
    CANCELLED: number;
    SUSPENDED: number;
    UNKNOWN: number;
    OTHER: number;
  };
  provenanceCounts: {
    STANDARD: number;
    CROSS_DATE_RESUME_RESOLVED: number;
    UNPROVEN_COMPLETION: number;
    NOT_APPLICABLE: number;
  };
  gamesWithValidNonTiedFinalScores: number;
  gamesWithoutUsableFinalResult: number;
  minOfficialDate: string | null;
  maxOfficialDate: string | null;
};

export type ExternalReplicationSourceAudit2025 = {
  schemaVersion: "mlb-independent-external-replication-source-audit-v1";
  researchOnly: true;
  modelEvaluated: false;
  modelCandidate: false;
  engineAdmission: "PROHIBITED";
  track: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK;
  stage: "SOURCE";
  marketUsed: false;
  engineChanged: false;
  source: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_ORIGIN;
  season: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_SEASON_2025;
  gameType: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_GAME_TYPE_V1;
  sportId: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_SPORT_ID_V1;
  query: string;
  endpoint: string;
  collectedAt: string;
  sourceArtifactRel: string;
  sourceArtifactSha256: string;
  completeness: ExternalReplicationCompleteness2025;
  manualReviewGames: ExternalReplicationManualReviewGameV1[];
  featuresCreated: false;
  labelsCreated: false;
  modelProbabilitiesCreated: false;
  holdoutEvaluated: false;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function independentExternalReplication2025SourceRel(): string {
  return "data/research/mlb/independent-model-v1/external-replication/2025/historical-source/2025-regular-season-source-v1.json";
}

export function independentExternalReplication2025SourcePath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentExternalReplication2025SourceRel());
}

export function independentExternalReplication2025AuditRel(): string {
  return "data/research/mlb/independent-model-v1/external-replication/2025/audits/2025-historical-source-audit-v1.json";
}

export function independentExternalReplication2025AuditPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentExternalReplication2025AuditRel());
}

export function serializeExternalReplicationJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256Utf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function hashExternalReplicationSourceArtifact2025(
  artifact: ExternalReplicationSourceArtifact2025,
): string {
  return sha256Utf8(serializeExternalReplicationJson(artifact));
}

export function canonicalExternalReplicationGamesFingerprint(
  games: ExternalReplicationHistoricalGameV1[],
): string {
  return sha256Utf8(JSON.stringify(games));
}

export function buildExternalReplicationSourceArtifact2025(input: {
  games: ExternalReplicationHistoricalGameV1[];
  collectedAt: string;
  collapsedSameGamePkCount?: number;
  query?: string;
  endpoint?: string;
}): ExternalReplicationSourceArtifact2025 {
  const normalized = normalizeHistoricalSourceGames(input.games);
  const collapsed = collapseSameGamePkSnapshots(normalized);
  validateHistoricalSourceIdentity(collapsed.games);
  validateHistoricalSourceResultProvenance(collapsed.games);
  const artifact: ExternalReplicationSourceArtifact2025 = {
    schemaVersion: MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_SCHEMA_V1,
    researchOnly: true,
    track: MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK,
    source: MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_ORIGIN,
    season: MLB_INDEPENDENT_EXTERNAL_REPLICATION_SEASON_2025,
    gameType: MLB_INDEPENDENT_EXTERNAL_REPLICATION_GAME_TYPE_V1,
    sportId: MLB_INDEPENDENT_EXTERNAL_REPLICATION_SPORT_ID_V1,
    collectedAt: input.collectedAt,
    endpoint:
      input.endpoint ?? MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_ENDPOINT_2025,
    query: input.query ?? MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_QUERY_2025,
    rowCount: collapsed.games.length,
    collapsedSameGamePkCount:
      input.collapsedSameGamePkCount ?? collapsed.collapsedSameGamePkCount,
    games: collapsed.games,
  };
  validateExternalReplicationSourceArtifact2025(artifact);
  return artifact;
}

export function validateExternalReplicationSourceArtifact2025(
  value: unknown,
): asserts value is ExternalReplicationSourceArtifact2025 {
  const rec = asRecord(value);
  if (!rec) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "source artifact is not an object",
    );
  }
  if (rec.schemaVersion !== MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_SCHEMA_V1) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "schemaVersion mismatch",
    );
  }
  if (rec.source !== MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_ORIGIN) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "source must be MLB_STATS_API",
    );
  }
  if (rec.season !== MLB_INDEPENDENT_EXTERNAL_REPLICATION_SEASON_2025) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "season must be 2025",
    );
  }
  if (rec.gameType !== MLB_INDEPENDENT_EXTERNAL_REPLICATION_GAME_TYPE_V1) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "gameType must be R",
    );
  }
  if (rec.sportId !== MLB_INDEPENDENT_EXTERNAL_REPLICATION_SPORT_ID_V1) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "sportId must be 1",
    );
  }
  if (rec.query !== MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_QUERY_2025) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "query must be the sealed 2025 regular-season schedule window",
    );
  }
  if (!Array.isArray(rec.games)) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "games must be an array",
    );
  }
  if (rec.rowCount !== rec.games.length) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "rowCount does not match games.length",
    );
  }
  validateHistoricalSourceIdentity(
    rec.games as ExternalReplicationHistoricalGameV1[],
  );
  validateHistoricalSourceResultProvenance(
    rec.games as ExternalReplicationHistoricalGameV1[],
  );
}

function hasValidNonTiedFinalScores(
  game: ExternalReplicationHistoricalGameV1,
): boolean {
  if (classifySourceStatus(game) !== "FINAL_STANDARD") return false;
  if (game.homeScore == null || game.awayScore == null) return false;
  if (!Number.isInteger(game.homeScore) || !Number.isInteger(game.awayScore)) {
    return false;
  }
  if (game.homeScore < 0 || game.awayScore < 0) return false;
  return game.homeScore !== game.awayScore;
}

export function summarizeExternalReplicationCompleteness2025(input: {
  rawScheduleSnapshotCount: number;
  artifact: ExternalReplicationSourceArtifact2025;
}): ExternalReplicationCompleteness2025 {
  const statusCounts = {
    FINAL_STANDARD: 0,
    POSTPONED: 0,
    CANCELLED: 0,
    SUSPENDED: 0,
    UNKNOWN: 0,
    OTHER: 0,
  };
  const provenanceCounts = {
    STANDARD: 0,
    CROSS_DATE_RESUME_RESOLVED: 0,
    UNPROVEN_COMPLETION: 0,
    NOT_APPLICABLE: 0,
  };
  let gamesWithValidNonTiedFinalScores = 0;
  const dates: string[] = [];
  for (const game of input.artifact.games) {
    statusCounts[classifySourceStatus(game)] += 1;
    provenanceCounts[game.resultProvenanceStatus] += 1;
    if (hasValidNonTiedFinalScores(game)) gamesWithValidNonTiedFinalScores += 1;
    dates.push(game.officialDate);
  }
  dates.sort();
  return {
    rawScheduleSnapshotCount: input.rawScheduleSnapshotCount,
    uniqueFinalGamePkCount: input.artifact.games.length,
    collapsedDuplicateSnapshotCount: input.artifact.collapsedSameGamePkCount,
    statusCounts,
    provenanceCounts,
    gamesWithValidNonTiedFinalScores,
    gamesWithoutUsableFinalResult:
      input.artifact.games.length - gamesWithValidNonTiedFinalScores,
    minOfficialDate: dates[0] ?? null,
    maxOfficialDate: dates[dates.length - 1] ?? null,
  };
}

function reviewReason(game: ExternalReplicationHistoricalGameV1): string | null {
  const status = classifySourceStatus(game);
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "SUSPENDED") return "SUSPENDED";
  if (game.resultProvenanceStatus === "UNPROVEN_COMPLETION") {
    return "UNPROVEN_COMPLETION";
  }
  if (game.resultProvenanceStatus === "CROSS_DATE_RESUME_RESOLVED") {
    return "CROSS_DATE_RESUME_RESOLVED";
  }
  if (status === "UNKNOWN") return "UNKNOWN_STATUS";
  if (status === "OTHER") return "OTHER_STATUS";
  return null;
}

export function listExternalReplicationManualReviewGames2025(
  games: ExternalReplicationHistoricalGameV1[],
): ExternalReplicationManualReviewGameV1[] {
  const out: ExternalReplicationManualReviewGameV1[] = [];
  for (const game of games) {
    const reason = reviewReason(game);
    if (!reason) continue;
    out.push({
      gamePk: game.gamePk,
      officialDate: game.officialDate,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      abstractGameState: game.abstractGameState,
      detailedState: game.detailedState,
      codedGameState: game.codedGameState,
      statusClass: classifySourceStatus(game),
      resultProvenanceStatus: game.resultProvenanceStatus,
      safeResultApplyDate: game.safeResultApplyDate,
      resumeDate: game.resumeDate,
      resumedFrom: game.resumedFrom,
      resumeGameDate: game.resumeGameDate,
      resumedFromDate: game.resumedFromDate,
      rescheduleDate: game.rescheduleDate,
      rescheduledFrom: game.rescheduledFrom,
      rescheduleGameDate: game.rescheduleGameDate,
      description: game.description,
      statusReason: game.statusReason,
      reviewReason: reason,
    });
  }
  return out;
}

export function buildExternalReplicationSourceAudit2025(input: {
  artifact: ExternalReplicationSourceArtifact2025;
  rawScheduleSnapshotCount: number;
  sourceArtifactSha256: string;
}): ExternalReplicationSourceAudit2025 {
  return {
    schemaVersion: "mlb-independent-external-replication-source-audit-v1",
    researchOnly: true,
    modelEvaluated: false,
    modelCandidate: false,
    engineAdmission: "PROHIBITED",
    track: MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK,
    stage: "SOURCE",
    marketUsed: false,
    engineChanged: false,
    source: MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_ORIGIN,
    season: MLB_INDEPENDENT_EXTERNAL_REPLICATION_SEASON_2025,
    gameType: MLB_INDEPENDENT_EXTERNAL_REPLICATION_GAME_TYPE_V1,
    sportId: MLB_INDEPENDENT_EXTERNAL_REPLICATION_SPORT_ID_V1,
    query: input.artifact.query,
    endpoint: input.artifact.endpoint,
    collectedAt: input.artifact.collectedAt,
    sourceArtifactRel: independentExternalReplication2025SourceRel(),
    sourceArtifactSha256: input.sourceArtifactSha256,
    completeness: summarizeExternalReplicationCompleteness2025({
      rawScheduleSnapshotCount: input.rawScheduleSnapshotCount,
      artifact: input.artifact,
    }),
    manualReviewGames: listExternalReplicationManualReviewGames2025(
      input.artifact.games,
    ),
    featuresCreated: false,
    labelsCreated: false,
    modelProbabilitiesCreated: false,
    holdoutEvaluated: false,
  };
}

export async function collectMlbIndependentExternalReplicationSource2025(input?: {
  cwd?: string;
  usage?: CacheUsageStats;
  collectedAt?: string;
}): Promise<{
  artifact: ExternalReplicationSourceArtifact2025;
  audit: ExternalReplicationSourceAudit2025;
  usage: CacheUsageStats;
  rawScheduleSnapshotCount: number;
  sourceArtifactSha256: string;
}> {
  const usage = input?.usage ?? createCacheUsage();
  const body = await getRawStatsJson(
    MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_QUERY_2025,
    usage,
    { cwd: input?.cwd },
  );
  const parsed = parseMlbScheduleBodyToHistoricalGames(body);
  const artifact = buildExternalReplicationSourceArtifact2025({
    games: parsed,
    collectedAt: input?.collectedAt ?? new Date().toISOString(),
  });
  const sourceArtifactSha256 = hashExternalReplicationSourceArtifact2025(artifact);
  const audit = buildExternalReplicationSourceAudit2025({
    artifact,
    rawScheduleSnapshotCount: parsed.length,
    sourceArtifactSha256,
  });
  return {
    artifact,
    audit,
    usage,
    rawScheduleSnapshotCount: parsed.length,
    sourceArtifactSha256,
  };
}
