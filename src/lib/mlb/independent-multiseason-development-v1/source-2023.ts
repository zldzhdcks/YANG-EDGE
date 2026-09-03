/**
 * MULTI-SEASON DEVELOPMENT TRACK — 2023 historical schedule/result source only.
 *
 * Official MLB Stats API. Does not materialize features, labels, join, or
 * evaluate any model. Does not rewrite sealed 2024/2025 source modules.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { MLB_INDEPENDENT_ENGINE_ADMISSION } from "../independent-model-v1/contract";
import {
  createCacheUsage,
  getRawStatsJson,
  type CacheUsageStats,
} from "../research-stats-cache";
import {
  SafeAHistoricalSourceError,
  classifySourceStatus,
  collapseSameGamePkSnapshots,
  isNonNegativeIntScore,
  normalizeHistoricalSourceGames,
  parseMlbScheduleBodyToHistoricalGames,
  validateHistoricalSourceIdentity,
  validateHistoricalSourceResultProvenance,
  type MlbIndependentSafeAHistoricalGameV1,
} from "../independent-safe-a-v1/historical-source";

export { SafeAHistoricalSourceError };

export const MLB_INDEPENDENT_MULTISEASON_DEVELOPMENT_TRACK =
  "MULTI_SEASON_DEVELOPMENT_TRACK" as const;
export const MLB_INDEPENDENT_MULTISEASON_SOURCE_SCHEMA_V1 =
  "mlb-independent-multiseason-development-source-v1" as const;
export const MLB_INDEPENDENT_MULTISEASON_SOURCE_ORIGIN = "MLB_STATS_API" as const;
export const MLB_INDEPENDENT_MULTISEASON_SEASON_2023 = 2023 as const;
export const MLB_INDEPENDENT_MULTISEASON_GAME_TYPE_V1 = "R" as const;
export const MLB_INDEPENDENT_MULTISEASON_SPORT_ID_V1 = 1 as const;
export const MLB_INDEPENDENT_MULTISEASON_STAGE_SOURCE = "SOURCE" as const;

export const MLB_INDEPENDENT_MULTISEASON_SOURCE_QUERY_2023 =
  "/api/v1/schedule?sportId=1&startDate=2023-03-01&endDate=2023-11-15&gameType=R";

export const MLB_INDEPENDENT_MULTISEASON_SOURCE_ENDPOINT_2023 =
  "https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=2023-03-01&endDate=2023-11-15&gameType=R";

export const POST_V2C_RESEARCH_DIRECTION_REVIEW_SHA256 =
  "707c7ab7dae1ba9435f5cbc693ea392737e621fc5c021f9fdcf03c7382d2c242";

export type MultiseasonDevelopmentHistoricalGame2023 =
  MlbIndependentSafeAHistoricalGameV1;

export type MultiseasonDevelopmentSourceArtifact2023 = {
  schemaVersion: typeof MLB_INDEPENDENT_MULTISEASON_SOURCE_SCHEMA_V1;
  researchOnly: true;
  track: typeof MLB_INDEPENDENT_MULTISEASON_DEVELOPMENT_TRACK;
  stage: typeof MLB_INDEPENDENT_MULTISEASON_STAGE_SOURCE;
  developmentEvidence: true;
  externalReplication: false;
  modelEvaluationAllowed: false;
  source: typeof MLB_INDEPENDENT_MULTISEASON_SOURCE_ORIGIN;
  season: typeof MLB_INDEPENDENT_MULTISEASON_SEASON_2023;
  gameType: typeof MLB_INDEPENDENT_MULTISEASON_GAME_TYPE_V1;
  sportId: typeof MLB_INDEPENDENT_MULTISEASON_SPORT_ID_V1;
  collectedAt: string;
  endpoint: string;
  query: string;
  rawSnapshotCount: number;
  rowCount: number;
  collapsedSameGamePkCount: number;
  games: MultiseasonDevelopmentHistoricalGame2023[];
};

export type MultiseasonDevelopmentManualReviewGame2023 = {
  gamePk: number;
  officialDate: string;
  commenceTimeUtc: string;
  homeTeamId: number;
  awayTeamId: number;
  status: string | null;
  abstractGameState: string | null;
  detailedState: string | null;
  codedGameState: string | null;
  statusClass: ReturnType<typeof classifySourceStatus>;
  homeScore: number | null;
  awayScore: number | null;
  resumeDate?: string;
  resumedFrom?: string;
  resumeGameDate?: string;
  resumedFromDate?: string;
  rescheduleDate?: string;
  rescheduledFrom?: string;
  rescheduleGameDate?: string;
  description?: string;
  statusReason?: string;
  safeResultApplyDate: string | null;
  resultProvenanceStatus: MultiseasonDevelopmentHistoricalGame2023["resultProvenanceStatus"];
  reviewNote: string;
};

export type MultiseasonDevelopmentCompleteness2023 = {
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
  validNonTiedFinalResultCount: number;
  unusableFinalResultCount: number;
  tiedFinalCount: number;
  invalidScoreCount: number;
  missingScoreCount: number;
  minOfficialDate: string | null;
  maxOfficialDate: string | null;
};

export type MultiseasonDevelopmentSourceAudit2023 = {
  schemaVersion: "mlb-independent-multiseason-development-source-audit-v1";
  researchOnly: true;
  track: typeof MLB_INDEPENDENT_MULTISEASON_DEVELOPMENT_TRACK;
  stage: typeof MLB_INDEPENDENT_MULTISEASON_STAGE_SOURCE;
  season: typeof MLB_INDEPENDENT_MULTISEASON_SEASON_2023;
  developmentEvidence: true;
  externalReplication: false;
  modelEvaluated: false;
  modelCandidate: false;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  marketUsed: false;
  engineChanged: false;
  recommendationChanged: false;
  networkUsed: boolean;
  officialMlbStatsApiOnly: true;
  source: typeof MLB_INDEPENDENT_MULTISEASON_SOURCE_ORIGIN;
  gameType: typeof MLB_INDEPENDENT_MULTISEASON_GAME_TYPE_V1;
  sportId: typeof MLB_INDEPENDENT_MULTISEASON_SPORT_ID_V1;
  query: string;
  endpoint: string;
  collectedAt: string;
  sourceArtifactRel: string;
  sourceArtifactSha256: string;
  completeness: MultiseasonDevelopmentCompleteness2023;
  manualReviewGames: MultiseasonDevelopmentManualReviewGame2023[];
  featuresCreated: false;
  labelsCreated: false;
  joinCreated: false;
  splitCreated: false;
  transformedXCreated: false;
  modelProbabilitiesCreated: false;
  holdoutEvaluated: false;
  holdoutFeatureRowsRead: 0;
  holdoutLabelRowsRead: 0;
  holdoutTransformedRows: 0;
  holdoutLogitsCreated: 0;
  holdoutProbabilitiesCreated: 0;
  "2025RowsInspected": false;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function independentMultiseasonDevelopment2023SourceRel(): string {
  return "data/research/mlb/independent-model-v1/multi-season-development/2023/historical-source/2023-regular-season-source-v1.json";
}

export function independentMultiseasonDevelopment2023SourcePath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentMultiseasonDevelopment2023SourceRel());
}

export function independentMultiseasonDevelopment2023AuditRel(): string {
  return "data/research/mlb/independent-model-v1/multi-season-development/2023/audits/2023-historical-source-audit-v1.json";
}

export function independentMultiseasonDevelopment2023AuditPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentMultiseasonDevelopment2023AuditRel());
}

export function serializeMultiseasonDevelopmentJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256Utf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function hashMultiseasonDevelopmentSourceArtifact2023(
  artifact: MultiseasonDevelopmentSourceArtifact2023,
): string {
  return sha256Utf8(serializeMultiseasonDevelopmentJson(artifact));
}

export function canonicalMultiseasonDevelopmentGamesFingerprint(
  games: MultiseasonDevelopmentHistoricalGame2023[],
): string {
  return sha256Utf8(JSON.stringify(games));
}

function assertCollapseReconciliation(
  rawSnapshotCount: number,
  collapsedSameGamePkCount: number,
  uniqueCount: number,
): void {
  if (rawSnapshotCount - collapsedSameGamePkCount !== uniqueCount) {
    throw new SafeAHistoricalSourceError(
      "COLLAPSE_COUNT_MISMATCH",
      `raw ${rawSnapshotCount} - collapsed ${collapsedSameGamePkCount} != unique ${uniqueCount}`,
    );
  }
}

export function buildMultiseasonDevelopmentSourceArtifact2023(input: {
  games: MultiseasonDevelopmentHistoricalGame2023[];
  collectedAt: string;
  rawSnapshotCount?: number;
  collapsedSameGamePkCount?: number;
  query?: string;
  endpoint?: string;
}): MultiseasonDevelopmentSourceArtifact2023 {
  const normalized = normalizeHistoricalSourceGames(input.games);
  const collapsed = collapseSameGamePkSnapshots(normalized);
  const rawSnapshotCount = input.rawSnapshotCount ?? input.games.length;
  const collapsedSameGamePkCount =
    input.collapsedSameGamePkCount ?? collapsed.collapsedSameGamePkCount;
  assertCollapseReconciliation(
    rawSnapshotCount,
    collapsedSameGamePkCount,
    collapsed.games.length,
  );
  validateHistoricalSourceIdentity(collapsed.games);
  validateHistoricalSourceResultProvenance(collapsed.games);
  const artifact: MultiseasonDevelopmentSourceArtifact2023 = {
    schemaVersion: MLB_INDEPENDENT_MULTISEASON_SOURCE_SCHEMA_V1,
    researchOnly: true,
    track: MLB_INDEPENDENT_MULTISEASON_DEVELOPMENT_TRACK,
    stage: MLB_INDEPENDENT_MULTISEASON_STAGE_SOURCE,
    developmentEvidence: true,
    externalReplication: false,
    modelEvaluationAllowed: false,
    source: MLB_INDEPENDENT_MULTISEASON_SOURCE_ORIGIN,
    season: MLB_INDEPENDENT_MULTISEASON_SEASON_2023,
    gameType: MLB_INDEPENDENT_MULTISEASON_GAME_TYPE_V1,
    sportId: MLB_INDEPENDENT_MULTISEASON_SPORT_ID_V1,
    collectedAt: input.collectedAt,
    endpoint: input.endpoint ?? MLB_INDEPENDENT_MULTISEASON_SOURCE_ENDPOINT_2023,
    query: input.query ?? MLB_INDEPENDENT_MULTISEASON_SOURCE_QUERY_2023,
    rawSnapshotCount,
    rowCount: collapsed.games.length,
    collapsedSameGamePkCount,
    games: collapsed.games,
  };
  validateMultiseasonDevelopmentSourceArtifact2023(artifact);
  return artifact;
}

export function validateMultiseasonDevelopmentSourceArtifact2023(
  value: unknown,
): asserts value is MultiseasonDevelopmentSourceArtifact2023 {
  const rec = asRecord(value);
  if (!rec) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "source artifact is not an object",
    );
  }
  if (rec.schemaVersion !== MLB_INDEPENDENT_MULTISEASON_SOURCE_SCHEMA_V1) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "schemaVersion mismatch",
    );
  }
  if (rec.track !== MLB_INDEPENDENT_MULTISEASON_DEVELOPMENT_TRACK) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "track must be MULTI_SEASON_DEVELOPMENT_TRACK",
    );
  }
  if (rec.developmentEvidence !== true) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "developmentEvidence must be true",
    );
  }
  if (rec.externalReplication !== false) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "externalReplication must be false",
    );
  }
  if (rec.modelEvaluationAllowed !== false) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "modelEvaluationAllowed must be false",
    );
  }
  if (rec.source !== MLB_INDEPENDENT_MULTISEASON_SOURCE_ORIGIN) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "source must be MLB_STATS_API",
    );
  }
  if (rec.season !== MLB_INDEPENDENT_MULTISEASON_SEASON_2023) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "season must be 2023",
    );
  }
  if (rec.gameType !== MLB_INDEPENDENT_MULTISEASON_GAME_TYPE_V1) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "gameType must be R",
    );
  }
  if (rec.sportId !== MLB_INDEPENDENT_MULTISEASON_SPORT_ID_V1) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "sportId must be 1",
    );
  }
  if (rec.query !== MLB_INDEPENDENT_MULTISEASON_SOURCE_QUERY_2023) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "query must be the 2023 regular-season schedule window",
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
  assertCollapseReconciliation(
    rec.rawSnapshotCount as number,
    rec.collapsedSameGamePkCount as number,
    rec.games.length,
  );
  validateHistoricalSourceIdentity(
    rec.games as MultiseasonDevelopmentHistoricalGame2023[],
  );
  validateHistoricalSourceResultProvenance(
    rec.games as MultiseasonDevelopmentHistoricalGame2023[],
  );
}

function scoreValidity(game: MultiseasonDevelopmentHistoricalGame2023): {
  missing: boolean;
  invalid: boolean;
  tied: boolean;
  validNonTiedFinal: boolean;
} {
  const status = classifySourceStatus(game);
  const home = game.homeScore;
  const away = game.awayScore;
  const missing = home == null || away == null;
  const invalid =
    !missing && (!isNonNegativeIntScore(home) || !isNonNegativeIntScore(away));
  const tied = !missing && !invalid && home === away;
  const validNonTiedFinal =
    status === "FINAL_STANDARD" && !missing && !invalid && home !== away;
  return { missing, invalid, tied, validNonTiedFinal };
}

export function summarizeMultiseasonDevelopmentCompleteness2023(input: {
  rawScheduleSnapshotCount: number;
  artifact: MultiseasonDevelopmentSourceArtifact2023;
}): MultiseasonDevelopmentCompleteness2023 {
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
  let validNonTiedFinalResultCount = 0;
  let tiedFinalCount = 0;
  let invalidScoreCount = 0;
  let missingScoreCount = 0;
  const dates: string[] = [];
  for (const game of input.artifact.games) {
    statusCounts[classifySourceStatus(game)] += 1;
    provenanceCounts[game.resultProvenanceStatus] += 1;
    const validity = scoreValidity(game);
    if (validity.validNonTiedFinal) validNonTiedFinalResultCount += 1;
    if (classifySourceStatus(game) === "FINAL_STANDARD" && validity.tied) {
      tiedFinalCount += 1;
    }
    if (classifySourceStatus(game) === "FINAL_STANDARD" && validity.invalid) {
      invalidScoreCount += 1;
    }
    if (classifySourceStatus(game) === "FINAL_STANDARD" && validity.missing) {
      missingScoreCount += 1;
    }
    dates.push(game.officialDate);
  }
  dates.sort();
  return {
    rawScheduleSnapshotCount: input.rawScheduleSnapshotCount,
    uniqueFinalGamePkCount: input.artifact.games.length,
    collapsedDuplicateSnapshotCount: input.artifact.collapsedSameGamePkCount,
    statusCounts,
    provenanceCounts,
    validNonTiedFinalResultCount,
    unusableFinalResultCount:
      input.artifact.games.length - validNonTiedFinalResultCount,
    tiedFinalCount,
    invalidScoreCount,
    missingScoreCount,
    minOfficialDate: dates[0] ?? null,
    maxOfficialDate: dates[dates.length - 1] ?? null,
  };
}

function reviewNote(game: MultiseasonDevelopmentHistoricalGame2023): string | null {
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
  const validity = scoreValidity(game);
  if (status === "FINAL_STANDARD" && validity.tied) return "TIED_FINAL";
  if (status === "FINAL_STANDARD" && validity.invalid) return "INVALID_SCORE";
  if (status === "FINAL_STANDARD" && validity.missing) return "MISSING_SCORE";
  return null;
}

export function listMultiseasonDevelopmentManualReviewGames2023(
  games: MultiseasonDevelopmentHistoricalGame2023[],
): MultiseasonDevelopmentManualReviewGame2023[] {
  const out: MultiseasonDevelopmentManualReviewGame2023[] = [];
  for (const game of games) {
    const note = reviewNote(game);
    if (!note) continue;
    out.push({
      gamePk: game.gamePk,
      officialDate: game.officialDate,
      commenceTimeUtc: game.commenceTimeUtc,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      status: game.detailedState ?? game.codedGameState,
      abstractGameState: game.abstractGameState,
      detailedState: game.detailedState,
      codedGameState: game.codedGameState,
      statusClass: classifySourceStatus(game),
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      resumeDate: game.resumeDate,
      resumedFrom: game.resumedFrom,
      resumeGameDate: game.resumeGameDate,
      resumedFromDate: game.resumedFromDate,
      rescheduleDate: game.rescheduleDate,
      rescheduledFrom: game.rescheduledFrom,
      rescheduleGameDate: game.rescheduleGameDate,
      description: game.description,
      statusReason: game.statusReason,
      safeResultApplyDate: game.safeResultApplyDate,
      resultProvenanceStatus: game.resultProvenanceStatus,
      reviewNote: note,
    });
  }
  return out;
}

export function buildMultiseasonDevelopmentSourceAudit2023(input: {
  artifact: MultiseasonDevelopmentSourceArtifact2023;
  rawScheduleSnapshotCount: number;
  sourceArtifactSha256: string;
  networkUsed: boolean;
}): MultiseasonDevelopmentSourceAudit2023 {
  return {
    schemaVersion: "mlb-independent-multiseason-development-source-audit-v1",
    researchOnly: true,
    track: MLB_INDEPENDENT_MULTISEASON_DEVELOPMENT_TRACK,
    stage: MLB_INDEPENDENT_MULTISEASON_STAGE_SOURCE,
    season: MLB_INDEPENDENT_MULTISEASON_SEASON_2023,
    developmentEvidence: true,
    externalReplication: false,
    modelEvaluated: false,
    modelCandidate: false,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    marketUsed: false,
    engineChanged: false,
    recommendationChanged: false,
    networkUsed: input.networkUsed,
    officialMlbStatsApiOnly: true,
    source: MLB_INDEPENDENT_MULTISEASON_SOURCE_ORIGIN,
    gameType: MLB_INDEPENDENT_MULTISEASON_GAME_TYPE_V1,
    sportId: MLB_INDEPENDENT_MULTISEASON_SPORT_ID_V1,
    query: input.artifact.query,
    endpoint: input.artifact.endpoint,
    collectedAt: input.artifact.collectedAt,
    sourceArtifactRel: independentMultiseasonDevelopment2023SourceRel(),
    sourceArtifactSha256: input.sourceArtifactSha256,
    completeness: summarizeMultiseasonDevelopmentCompleteness2023({
      rawScheduleSnapshotCount: input.rawScheduleSnapshotCount,
      artifact: input.artifact,
    }),
    manualReviewGames: listMultiseasonDevelopmentManualReviewGames2023(
      input.artifact.games,
    ),
    featuresCreated: false,
    labelsCreated: false,
    joinCreated: false,
    splitCreated: false,
    transformedXCreated: false,
    modelProbabilitiesCreated: false,
    holdoutEvaluated: false,
    holdoutFeatureRowsRead: 0,
    holdoutLabelRowsRead: 0,
    holdoutTransformedRows: 0,
    holdoutLogitsCreated: 0,
    holdoutProbabilitiesCreated: 0,
    "2025RowsInspected": false,
  };
}

export async function collectMlbIndependentMultiseasonSource2023(input?: {
  cwd?: string;
  usage?: CacheUsageStats;
  collectedAt?: string;
}): Promise<{
  artifact: MultiseasonDevelopmentSourceArtifact2023;
  audit: MultiseasonDevelopmentSourceAudit2023;
  usage: CacheUsageStats;
  rawScheduleSnapshotCount: number;
  sourceArtifactSha256: string;
}> {
  const usage = input?.usage ?? createCacheUsage();
  const body = await getRawStatsJson(
    MLB_INDEPENDENT_MULTISEASON_SOURCE_QUERY_2023,
    usage,
    { cwd: input?.cwd },
  );
  const parsed = parseMlbScheduleBodyToHistoricalGames(body);
  const artifact = buildMultiseasonDevelopmentSourceArtifact2023({
    games: parsed,
    collectedAt: input?.collectedAt ?? new Date().toISOString(),
    rawSnapshotCount: parsed.length,
  });
  const sourceArtifactSha256 = hashMultiseasonDevelopmentSourceArtifact2023(artifact);
  const audit = buildMultiseasonDevelopmentSourceAudit2023({
    artifact,
    rawScheduleSnapshotCount: parsed.length,
    sourceArtifactSha256,
    networkUsed: usage.networkCalls > 0,
  });
  return {
    artifact,
    audit,
    usage,
    rawScheduleSnapshotCount: parsed.length,
    sourceArtifactSha256,
  };
}
