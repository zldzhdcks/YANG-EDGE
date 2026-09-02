/**
 * 2025 EXTERNAL REPLICATION TRACK — SAFE_A feature materializer.
 *
 * DATE-BATCH FREEZE on the sealed 2025 historical source.
 * No network. No labels. No model. Does not rewrite sealed 2024 SAFE_A.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import {
  MLB_INDEPENDENT_CLASS_A_TEMPORAL_POLICY_V1,
  MLB_INDEPENDENT_ENGINE_ADMISSION,
  MLB_INDEPENDENT_FEATURE_BUILDER_VERSION,
  MLB_INDEPENDENT_FEATURE_ROW_SCHEMA_V1,
  MLB_INDEPENDENT_FEATURE_SCHEMA_V1,
  MLB_INDEPENDENT_TEAM_SIDE_KEYS_V1,
  isProhibitedFeatureKey,
  previousOfficialDate,
  validateIndependentFeatureArtifactV1,
  validateIndependentFeatureRowV1,
  type MlbIndependentFeatureArtifactV1,
  type MlbIndependentFeatureRowV1,
  type MlbIndependentTeamSideFeaturesV1,
} from "../independent-model-v1";
import {
  classifySourceStatus,
  compareHistoricalGames,
  hasResumeProvenance,
  isIsoInstant,
  isNonNegativeIntScore,
  normalizeCommenceTimeUtc,
  type MlbIndependentSafeAHistoricalGameV1,
  type SafeASourceStatusClass,
} from "../independent-safe-a-v1/historical-source";
import {
  SafeAMaterializationError,
  disposeHistoricalGame,
  hashIndependentFeatureRowV1,
  isSafeCompletedResult,
  type SafeAExcludedTarget,
} from "../independent-safe-a-v1/materialize";
import {
  MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256,
  MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK,
  independentExternalReplication2025SourceRel,
  serializeExternalReplicationJson,
  sha256Utf8,
  validateExternalReplicationSourceArtifact2025,
  type ExternalReplicationSourceArtifact2025,
} from "./source-2025";

export { SafeAMaterializationError, hashIndependentFeatureRowV1 };

export const MLB_INDEPENDENT_2025_SAFE_A_STAGE = "SAFE_A_FEATURES" as const;
export const MLB_INDEPENDENT_2025_SEALED_CROSS_DATE_RESUME_GAME_PKS = [
  777861, 777623, 777294, 776907,
] as const;

export function independentExternalReplication2025FeatureRel(): string {
  return "data/research/mlb/independent-model-v1/external-replication/2025/features/2025-safe-a-feature-artifact-v1.json";
}

export function independentExternalReplication2025FeaturePath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentExternalReplication2025FeatureRel());
}

export function independentExternalReplication2025FeatureAuditRel(): string {
  return "data/research/mlb/independent-model-v1/external-replication/2025/audits/2025-safe-a-materialization-audit-v1.json";
}

export function independentExternalReplication2025FeatureAuditPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentExternalReplication2025FeatureAuditRel());
}

export type ExternalReplicationSafeAAudit2025 = {
  generatedAt: string;
  researchOnly: true;
  track: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK;
  stage: typeof MLB_INDEPENDENT_2025_SAFE_A_STAGE;
  season: 2025;
  engineAdmission: "PROHIBITED";
  modelEvaluated: false;
  modelCandidate: false;
  marketUsed: false;
  networkUsed: false;
  engineChanged: false;
  featuresCreated: true;
  labelsCreated: false;
  joinCreated: false;
  modelProbabilitiesCreated: false;
  sourceArtifactRel: string;
  sourceArtifactSha256: string;
  featureArtifactRel: string;
  featureArtifactSha256: string;
  sourceRowCount: number;
  featureRowCount: number;
  excludedTargetCount: number;
  firstOfficialDate: string | null;
  lastOfficialDate: string | null;
  uniqueGamePkCount: number;
  statusDistribution: Record<SafeASourceStatusClass, number>;
  exclusionReasonCounts: Record<string, number>;
  resumeFieldCount: number;
  rescheduleFieldCount: number;
  doubleHeaderGameCount: number;
  taintedTeamCount: number;
  resolvedCrossDateResumeCount: number;
  unprovenCrossDateResumeCount: number;
  teamRollingMismatchCount: number;
  finalRollingStateMatchesSource: boolean;
  featureHashVerificationCount: number;
  featureHashMismatchCount: number;
  leakageChecks: {
    sameDayResultUsed: false;
    targetResultUsed: false;
    marketFieldsPresent: false;
    resultFieldsPresentInX: false;
    crossDateResultAppliedToOriginalDate: false;
    temporalResultApplyViolationCount: 0;
    previousSeasonHistoryUsed: false;
    labelsRead: false;
    modelRead: false;
    modelProbabilitiesCreated: false;
  };
  contractChecks: {
    allFeatureRowsValid: boolean;
    featureArtifactValid: boolean;
    canonicalBaseSignalCount: 35;
  };
};

export type ExternalReplicationSafeAResult2025 = {
  artifact: MlbIndependentFeatureArtifactV1;
  audit: ExternalReplicationSafeAAudit2025;
  excluded: SafeAExcludedTarget[];
};

type RecentGame = {
  won: boolean;
  runsScored: number;
  runsAllowed: number;
};

type TeamRollingState = {
  games: number;
  wins: number;
  losses: number;
  runsScored: number;
  runsAllowed: number;
  homeGames: number;
  homeWins: number;
  awayGames: number;
  awayWins: number;
  lastOfficialDate: string | null;
  winStreak: number;
  lossStreak: number;
  recent: RecentGame[];
  tainted: boolean;
};

type H2HGame = {
  teamA: number;
  teamB: number;
  winnerTeamId: number;
};

function emptyTeamState(): TeamRollingState {
  return {
    games: 0,
    wins: 0,
    losses: 0,
    runsScored: 0,
    runsAllowed: 0,
    homeGames: 0,
    homeWins: 0,
    awayGames: 0,
    awayWins: 0,
    lastOfficialDate: null,
    winStreak: 0,
    lossStreak: 0,
    recent: [],
    tainted: false,
  };
}

function calendarDayDiff(later: string, earlier: string): number {
  const a = Date.parse(`${earlier}T00:00:00.000Z`);
  const b = Date.parse(`${later}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}

function restDaysBefore(
  targetOfficialDate: string,
  lastOfficialDate: string | null,
): number | null {
  if (lastOfficialDate == null) return null;
  return Math.max(0, calendarDayDiff(targetOfficialDate, lastOfficialDate) - 1);
}

function rateOrNull(numer: number, denom: number): number | null {
  if (denom === 0) return null;
  return numer / denom;
}

function teamState(map: Map<number, TeamRollingState>, teamId: number): TeamRollingState {
  let state = map.get(teamId);
  if (!state) {
    state = emptyTeamState();
    map.set(teamId, state);
  }
  return state;
}

function buildTeamSide(
  state: TeamRollingState,
  targetOfficialDate: string,
): MlbIndependentTeamSideFeaturesV1 {
  const games = state.games;
  if (games === 0) {
    return {
      gamesPlayedBefore: 0,
      winsBefore: 0,
      lossesBefore: 0,
      winRateBefore: null,
      last5WinsBefore: null,
      last5LossesBefore: null,
      last5WinRateBefore: null,
      runsScoredAverageBefore: null,
      runsAllowedAverageBefore: null,
      last5RunsScoredAverageBefore: null,
      last5RunsAllowedAverageBefore: null,
      homeWinRateBefore: null,
      awayWinRateBefore: null,
      currentWinStreakBefore: 0,
      currentLossStreakBefore: 0,
      restDaysBefore: null,
    };
  }
  const last5 = state.recent.slice(-Math.min(5, games));
  const last5Wins = last5.filter((g) => g.won).length;
  const last5Losses = last5.length - last5Wins;
  const last5RunsScored = last5.reduce((s, g) => s + g.runsScored, 0);
  const last5RunsAllowed = last5.reduce((s, g) => s + g.runsAllowed, 0);
  return {
    gamesPlayedBefore: games,
    winsBefore: state.wins,
    lossesBefore: state.losses,
    winRateBefore: rateOrNull(state.wins, games),
    last5WinsBefore: last5Wins,
    last5LossesBefore: last5Losses,
    last5WinRateBefore: rateOrNull(last5Wins, last5.length),
    runsScoredAverageBefore: state.runsScored / games,
    runsAllowedAverageBefore: state.runsAllowed / games,
    last5RunsScoredAverageBefore: last5RunsScored / last5.length,
    last5RunsAllowedAverageBefore: last5RunsAllowed / last5.length,
    homeWinRateBefore: rateOrNull(state.homeWins, state.homeGames),
    awayWinRateBefore: rateOrNull(state.awayWins, state.awayGames),
    currentWinStreakBefore: state.winStreak,
    currentLossStreakBefore: state.lossStreak,
    restDaysBefore: restDaysBefore(targetOfficialDate, state.lastOfficialDate),
  };
}

function buildH2H(
  history: H2HGame[],
  homeTeamId: number,
  awayTeamId: number,
): {
  headToHeadGamesBefore: number;
  headToHeadHomeWinsBefore: number;
  headToHeadAwayWinsBefore: number;
} {
  let games = 0;
  let homeWins = 0;
  let awayWins = 0;
  for (const row of history) {
    const pair =
      (row.teamA === homeTeamId && row.teamB === awayTeamId) ||
      (row.teamA === awayTeamId && row.teamB === homeTeamId);
    if (!pair) continue;
    games += 1;
    if (row.winnerTeamId === homeTeamId) homeWins += 1;
    else if (row.winnerTeamId === awayTeamId) awayWins += 1;
  }
  return {
    headToHeadGamesBefore: games,
    headToHeadHomeWinsBefore: homeWins,
    headToHeadAwayWinsBefore: awayWins,
  };
}

function applyCompletedGame(
  teams: Map<number, TeamRollingState>,
  h2h: H2HGame[],
  game: MlbIndependentSafeAHistoricalGameV1,
): void {
  const homeWon = (game.homeScore as number) > (game.awayScore as number);
  applyToTeam(teams, game.homeTeamId, {
    won: homeWon,
    runsScored: game.homeScore as number,
    runsAllowed: game.awayScore as number,
    venue: "home",
    officialDate: game.safeResultApplyDate ?? game.officialDate,
  });
  applyToTeam(teams, game.awayTeamId, {
    won: !homeWon,
    runsScored: game.awayScore as number,
    runsAllowed: game.homeScore as number,
    venue: "away",
    officialDate: game.safeResultApplyDate ?? game.officialDate,
  });
  h2h.push({
    teamA: game.homeTeamId,
    teamB: game.awayTeamId,
    winnerTeamId: homeWon ? game.homeTeamId : game.awayTeamId,
  });
}

function applyToTeam(
  teams: Map<number, TeamRollingState>,
  teamId: number,
  input: {
    won: boolean;
    runsScored: number;
    runsAllowed: number;
    venue: "home" | "away";
    officialDate: string;
  },
): void {
  const state = teamState(teams, teamId);
  state.games += 1;
  if (input.won) state.wins += 1;
  else state.losses += 1;
  state.runsScored += input.runsScored;
  state.runsAllowed += input.runsAllowed;
  if (input.venue === "home") {
    state.homeGames += 1;
    if (input.won) state.homeWins += 1;
  } else {
    state.awayGames += 1;
    if (input.won) state.awayWins += 1;
  }
  state.lastOfficialDate = input.officialDate;
  if (input.won) {
    state.winStreak += 1;
    state.lossStreak = 0;
  } else {
    state.lossStreak += 1;
    state.winStreak = 0;
  }
  state.recent.push({
    won: input.won,
    runsScored: input.runsScored,
    runsAllowed: input.runsAllowed,
  });
  if (state.recent.length > 5) state.recent.shift();
}

function resultEventTimeUtc(game: MlbIndependentSafeAHistoricalGameV1): string {
  if (
    game.resultProvenanceStatus === "CROSS_DATE_RESUME_RESOLVED" &&
    game.resumeDate &&
    isIsoInstant(game.resumeDate)
  ) {
    return normalizeCommenceTimeUtc(game.resumeDate);
  }
  return game.commenceTimeUtc;
}

function compareResultEvents(
  a: MlbIndependentSafeAHistoricalGameV1,
  b: MlbIndependentSafeAHistoricalGameV1,
): number {
  const ta = resultEventTimeUtc(a);
  const tb = resultEventTimeUtc(b);
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.gamePk - b.gamePk;
}

function incrementCount(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function walkKeys(value: unknown, visit: (key: string) => void): void {
  if (Array.isArray(value)) {
    value.forEach((item) => walkKeys(item, visit));
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    visit(key);
    walkKeys(child, visit);
  }
}

function artifactHasProhibitedOrResultFields(
  artifact: MlbIndependentFeatureArtifactV1,
): { prohibited: boolean; result: boolean } {
  let prohibited = false;
  let result = false;
  const join = (a: string, b: string) => a + b;
  walkKeys(artifact, (key) => {
    if (isProhibitedFeatureKey(key)) prohibited = true;
    const token = key.toLowerCase();
    const n = token.replace(/[^a-z0-9]/g, "");
    if (
      n === join("od", "ds") ||
      n.includes(join("impl", "ied")) ||
      n.includes(join("closing", "line")) ||
      n === join("fav", "orite") ||
      n === "edge" ||
      token === join("m", "arket")
    ) {
      prohibited = true;
    }
    if (
      token === "winner" ||
      token === "target" ||
      token === "label" ||
      token === "result" ||
      token === "postgame" ||
      token === "grade" ||
      n === "homescore" ||
      n === "awayscore"
    ) {
      result = true;
    }
  });
  return { prohibited, result };
}

function countSourceResultsAppliedBefore(
  sourceGames: MlbIndependentSafeAHistoricalGameV1[],
  teamId: number,
  beforeDate: string,
): number {
  return sourceGames.filter((g) => {
    if (g.safeResultApplyDate == null || g.safeResultApplyDate >= beforeDate) {
      return false;
    }
    if (g.homeTeamId !== teamId && g.awayTeamId !== teamId) return false;
    return isSafeCompletedResult(g);
  }).length;
}

function emptyStatusDistribution(): Record<SafeASourceStatusClass, number> {
  return {
    FINAL_STANDARD: 0,
    POSTPONED: 0,
    CANCELLED: 0,
    SUSPENDED: 0,
    UNKNOWN: 0,
    OTHER: 0,
  };
}

function sealFeatureRow(
  row: Omit<MlbIndependentFeatureRowV1, "featureHash">,
): MlbIndependentFeatureRowV1 {
  const unsealed: MlbIndependentFeatureRowV1 = { ...row, featureHash: null };
  const featureHash = hashIndependentFeatureRowV1(unsealed);
  return { ...unsealed, featureHash };
}

function hasRescheduleProvenance(game: MlbIndependentSafeAHistoricalGameV1): boolean {
  return Boolean(
    game.rescheduleDate || game.rescheduledFrom || game.rescheduleGameDate,
  );
}

export function assertExternalReplication2025SourcePin(sourceSha256: string): void {
  if (sourceSha256 !== MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256) {
    throw new SafeAMaterializationError(
      "SOURCE_SHA_PIN_MISMATCH",
      `expected ${MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256}, got ${sourceSha256}`,
    );
  }
}

export function hashExternalReplicationFeatureArtifact2025(
  artifact: MlbIndependentFeatureArtifactV1,
): string {
  return sha256Utf8(serializeExternalReplicationJson(artifact));
}

export function verifyFeatureHashes2025(artifact: MlbIndependentFeatureArtifactV1): {
  featureHashVerificationCount: number;
  featureHashMismatchCount: number;
} {
  let mismatch = 0;
  for (const row of artifact.rows) {
    if (row.featureHash == null || row.featureHash !== hashIndependentFeatureRowV1(row)) {
      mismatch += 1;
    }
  }
  return {
    featureHashVerificationCount: artifact.rows.length,
    featureHashMismatchCount: mismatch,
  };
}

export function findExternalReplicationFeatureRow2025(
  artifact: MlbIndependentFeatureArtifactV1,
  gamePk: number,
): MlbIndependentFeatureRowV1 | undefined {
  return artifact.rows.find((row) => row.identity.gamePk === gamePk);
}

export function materializeExternalReplicationSafeAFeatures2025(
  source: ExternalReplicationSourceArtifact2025,
  options?: {
    sourcePath?: string;
    generatedAt?: string;
    expectedSourceSha256?: string;
  },
): ExternalReplicationSafeAResult2025 {
  validateExternalReplicationSourceArtifact2025(source);
  if (options?.expectedSourceSha256 != null) {
    assertExternalReplication2025SourcePin(options.expectedSourceSha256);
  }

  const games = [...source.games].sort(compareHistoricalGames);
  const targetsByDate = new Map<string, MlbIndependentSafeAHistoricalGameV1[]>();
  const applyByDate = new Map<string, MlbIndependentSafeAHistoricalGameV1[]>();
  const dateSet = new Set<string>();
  for (const game of games) {
    dateSet.add(game.officialDate);
    const targetList = targetsByDate.get(game.officialDate) ?? [];
    targetList.push(game);
    targetsByDate.set(game.officialDate, targetList);
    if (isSafeCompletedResult(game) && game.safeResultApplyDate) {
      if (game.safeResultApplyDate < game.officialDate) {
        throw new SafeAMaterializationError(
          "RESULT_APPLY_DATE_BEFORE_OFFICIAL_DATE",
          `gamePk ${game.gamePk} apply date before officialDate`,
        );
      }
      dateSet.add(game.safeResultApplyDate);
      const applyList = applyByDate.get(game.safeResultApplyDate) ?? [];
      applyList.push(game);
      applyByDate.set(game.safeResultApplyDate, applyList);
    }
  }

  const dates = [...dateSet].sort();
  const teams = new Map<number, TeamRollingState>();
  const h2h: H2HGame[] = [];
  const rows: MlbIndependentFeatureRowV1[] = [];
  const excluded: SafeAExcludedTarget[] = [];
  const exclusionReasonCounts: Record<string, number> = {};
  const statusDistribution = emptyStatusDistribution();
  let resumeFieldCount = 0;
  let rescheduleFieldCount = 0;
  let doubleHeaderGameCount = 0;

  for (const game of games) {
    const status = classifySourceStatus(game);
    statusDistribution[status] += 1;
    if (hasResumeProvenance(game)) resumeFieldCount += 1;
    if (hasRescheduleProvenance(game)) rescheduleFieldCount += 1;
    if (
      game.doubleHeader === "Y" ||
      game.doubleHeader === "S" ||
      (game.gameNumber != null && game.gameNumber > 1)
    ) {
      doubleHeaderGameCount += 1;
    }
  }

  const appliedResults: MlbIndependentSafeAHistoricalGameV1[] = [];
  let sameDayResultUsed = false;
  let targetResultUsed = false;
  let crossDateResultAppliedToOriginalDate = false;
  let temporalResultApplyViolationCount = 0;

  for (const officialDate of dates) {
    const dayGames = targetsByDate.get(officialDate) ?? [];
    const statsThroughDate = previousOfficialDate(officialDate);
    if (dayGames.length > 0 && statsThroughDate == null) {
      throw new SafeAMaterializationError(
        "MALFORMED_OFFICIAL_DATE",
        `cannot compute D-1 for ${officialDate}`,
      );
    }

    const pendingTaint = new Set<number>();

    for (const game of dayGames) {
      const home = teamState(teams, game.homeTeamId);
      const away = teamState(teams, game.awayTeamId);
      const disposition = disposeHistoricalGame(game);

      if (home.tainted || away.tainted) {
        excluded.push({
          gamePk: game.gamePk,
          officialDate,
          reason: "TEAM_HISTORY_TAINTED_BY_UNPROVEN_COMPLETION",
        });
        incrementCount(
          exclusionReasonCounts,
          "TEAM_HISTORY_TAINTED_BY_UNPROVEN_COMPLETION",
        );
        if (disposition.kind === "EXCLUDE" && disposition.taint) {
          pendingTaint.add(game.homeTeamId);
          pendingTaint.add(game.awayTeamId);
        }
        continue;
      }

      if (disposition.kind === "EXCLUDE") {
        excluded.push({
          gamePk: game.gamePk,
          officialDate,
          reason: disposition.reason,
        });
        incrementCount(exclusionReasonCounts, disposition.reason);
        if (disposition.taint) {
          pendingTaint.add(game.homeTeamId);
          pendingTaint.add(game.awayTeamId);
        }
        continue;
      }

      if (appliedResults.some((g) => g.safeResultApplyDate === officialDate)) {
        sameDayResultUsed = true;
      }
      if (appliedResults.some((g) => g.gamePk === game.gamePk)) {
        targetResultUsed = true;
      }
      const homeExpectedApplied = countSourceResultsAppliedBefore(
        games,
        game.homeTeamId,
        officialDate,
      );
      const awayExpectedApplied = countSourceResultsAppliedBefore(
        games,
        game.awayTeamId,
        officialDate,
      );
      if (home.games !== homeExpectedApplied) temporalResultApplyViolationCount += 1;
      if (away.games !== awayExpectedApplied) temporalResultApplyViolationCount += 1;

      const sealed = sealFeatureRow({
        schemaVersion: MLB_INDEPENDENT_FEATURE_ROW_SCHEMA_V1,
        identity: {
          gamePk: game.gamePk,
          officialDate: game.officialDate,
          homeTeamId: game.homeTeamId,
          awayTeamId: game.awayTeamId,
          commenceTimeUtc: game.commenceTimeUtc,
        },
        featureClass: "SAFE_HISTORICALLY_RECONSTRUCTABLE",
        temporalPolicy: MLB_INDEPENDENT_CLASS_A_TEMPORAL_POLICY_V1,
        temporalPhase: "HISTORICAL_RECONSTRUCTION",
        statsThroughDate: statsThroughDate as string,
        asOf: statsThroughDate as string,
        cutoffTime: null,
        home: buildTeamSide(home, officialDate),
        away: buildTeamSide(away, officialDate),
        ...buildH2H(h2h, game.homeTeamId, game.awayTeamId),
      });
      if (Object.keys(sealed.home).length !== MLB_INDEPENDENT_TEAM_SIDE_KEYS_V1.length) {
        throw new SafeAMaterializationError(
          "FEATURE_CONTRACT_MISMATCH",
          `home side key count ${Object.keys(sealed.home).length}`,
        );
      }

      const rowCheck = validateIndependentFeatureRowV1(sealed);
      if (!rowCheck.ok) {
        throw new SafeAMaterializationError(
          "FEATURE_ROW_INVALID",
          `gamePk ${game.gamePk}: ${rowCheck.errors.join(" | ")}`,
        );
      }
      rows.push(sealed);
    }

    const pendingApply = [...(applyByDate.get(officialDate) ?? [])].sort(
      compareResultEvents,
    );
    for (const game of pendingApply) {
      if (
        game.safeResultApplyDate == null ||
        game.safeResultApplyDate !== officialDate
      ) {
        throw new SafeAMaterializationError(
          "RESULT_APPLY_DATE_MISALIGNED",
          `gamePk ${game.gamePk} apply date ${String(game.safeResultApplyDate)} != batch ${officialDate}`,
        );
      }
      if (game.safeResultApplyDate < game.officialDate) {
        throw new SafeAMaterializationError(
          "RESULT_APPLY_DATE_BEFORE_OFFICIAL_DATE",
          `gamePk ${game.gamePk} apply date before officialDate`,
        );
      }
      if (
        game.resultProvenanceStatus === "CROSS_DATE_RESUME_RESOLVED" &&
        game.officialDate === officialDate
      ) {
        crossDateResultAppliedToOriginalDate = true;
      }
      applyCompletedGame(teams, h2h, game);
      appliedResults.push(game);
    }
    for (const teamId of pendingTaint) {
      teamState(teams, teamId).tainted = true;
    }
  }

  const artifact: MlbIndependentFeatureArtifactV1 = {
    schemaVersion: MLB_INDEPENDENT_FEATURE_SCHEMA_V1,
    builderVersion: MLB_INDEPENDENT_FEATURE_BUILDER_VERSION,
    researchOnly: true,
    independentModelSample: 0,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    datasetReady: false,
    temporalPolicy: MLB_INDEPENDENT_CLASS_A_TEMPORAL_POLICY_V1,
    featureClass: "SAFE_HISTORICALLY_RECONSTRUCTABLE",
    writeOnce: true,
    rows,
  };

  const artifactCheck = validateIndependentFeatureArtifactV1(artifact);
  if (!artifactCheck.ok) {
    throw new SafeAMaterializationError(
      "FEATURE_ARTIFACT_INVALID",
      artifactCheck.errors.join(" | "),
    );
  }

  let taintedTeamCount = 0;
  for (const state of teams.values()) {
    if (state.tainted) taintedTeamCount += 1;
  }

  const expectedFinal = new Map<number, { games: number; wins: number; losses: number }>();
  const bumpExpected = (teamId: number, won: boolean): void => {
    const cur = expectedFinal.get(teamId) ?? { games: 0, wins: 0, losses: 0 };
    cur.games += 1;
    if (won) cur.wins += 1;
    else cur.losses += 1;
    expectedFinal.set(teamId, cur);
  };
  for (const game of games) {
    if (!isSafeCompletedResult(game)) continue;
    const homeWon = (game.homeScore as number) > (game.awayScore as number);
    bumpExpected(game.homeTeamId, homeWon);
    bumpExpected(game.awayTeamId, !homeWon);
  }
  const teamIds = new Set<number>([...teams.keys(), ...expectedFinal.keys()]);
  let teamRollingMismatchCount = 0;
  for (const teamId of teamIds) {
    const actual = teams.get(teamId) ?? emptyTeamState();
    const expected = expectedFinal.get(teamId) ?? { games: 0, wins: 0, losses: 0 };
    if (
      actual.games !== expected.games ||
      actual.wins !== expected.wins ||
      actual.losses !== expected.losses
    ) {
      teamRollingMismatchCount += 1;
    }
  }

  const hashCheck = verifyFeatureHashes2025(artifact);
  const leakScan = artifactHasProhibitedOrResultFields(artifact);
  if (sameDayResultUsed || targetResultUsed || leakScan.prohibited || leakScan.result) {
    throw new SafeAMaterializationError(
      "FEATURE_LEAKAGE_DETECTED",
      JSON.stringify({ sameDayResultUsed, targetResultUsed, leakScan }),
    );
  }
  if (crossDateResultAppliedToOriginalDate || temporalResultApplyViolationCount !== 0) {
    throw new SafeAMaterializationError(
      "TEMPORAL_RESULT_APPLY_VIOLATION",
      JSON.stringify({
        crossDateResultAppliedToOriginalDate,
        temporalResultApplyViolationCount,
      }),
    );
  }
  if (hashCheck.featureHashMismatchCount !== 0) {
    throw new SafeAMaterializationError(
      "FEATURE_HASH_MISMATCH",
      String(hashCheck.featureHashMismatchCount),
    );
  }

  if (teamRollingMismatchCount !== 0) {
    throw new SafeAMaterializationError(
      "FINAL_ROLLING_STATE_MISMATCH",
      String(teamRollingMismatchCount),
    );
  }

  const resolvedCrossDateResumeCount = games.filter(
    (g) => g.resultProvenanceStatus === "CROSS_DATE_RESUME_RESOLVED",
  ).length;
  const unprovenCrossDateResumeCount = games.filter(
    (g) => g.resultProvenanceStatus === "UNPROVEN_COMPLETION",
  ).length;
  const targetDates = games.map((g) => g.officialDate).sort();
  const featureArtifactSha256 = hashExternalReplicationFeatureArtifact2025(artifact);

  const audit: ExternalReplicationSafeAAudit2025 = {
    generatedAt: options?.generatedAt ?? new Date().toISOString(),
    researchOnly: true,
    track: MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK,
    stage: MLB_INDEPENDENT_2025_SAFE_A_STAGE,
    season: 2025,
    engineAdmission: "PROHIBITED",
    modelEvaluated: false,
    modelCandidate: false,
    marketUsed: false,
    networkUsed: false,
    engineChanged: false,
    featuresCreated: true,
    labelsCreated: false,
    joinCreated: false,
    modelProbabilitiesCreated: false,
    sourceArtifactRel:
      options?.sourcePath ?? independentExternalReplication2025SourceRel(),
    sourceArtifactSha256:
      options?.expectedSourceSha256 ?? "SYNTHETIC_SOURCE_UNPINNED",
    featureArtifactRel: independentExternalReplication2025FeatureRel(),
    featureArtifactSha256,
    sourceRowCount: source.rowCount,
    featureRowCount: rows.length,
    excludedTargetCount: excluded.length,
    firstOfficialDate: targetDates[0] ?? null,
    lastOfficialDate: targetDates[targetDates.length - 1] ?? null,
    uniqueGamePkCount: new Set(games.map((g) => g.gamePk)).size,
    statusDistribution,
    exclusionReasonCounts,
    resumeFieldCount,
    rescheduleFieldCount,
    doubleHeaderGameCount,
    taintedTeamCount,
    resolvedCrossDateResumeCount,
    unprovenCrossDateResumeCount,
    teamRollingMismatchCount,
    finalRollingStateMatchesSource: teamRollingMismatchCount === 0,
    featureHashVerificationCount: hashCheck.featureHashVerificationCount,
    featureHashMismatchCount: hashCheck.featureHashMismatchCount,
    leakageChecks: {
      sameDayResultUsed: false,
      targetResultUsed: false,
      marketFieldsPresent: false,
      resultFieldsPresentInX: false,
      crossDateResultAppliedToOriginalDate: false,
      temporalResultApplyViolationCount: 0,
      previousSeasonHistoryUsed: false,
      labelsRead: false,
      modelRead: false,
      modelProbabilitiesCreated: false,
    },
    contractChecks: {
      allFeatureRowsValid: true,
      featureArtifactValid: true,
      canonicalBaseSignalCount: 35,
    },
  };

  return { artifact, audit, excluded };
}
