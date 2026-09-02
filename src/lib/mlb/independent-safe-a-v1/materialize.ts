/**
 * MLB Independent Model v1 — SAFE_A historical feature materializer.
 *
 * Pure / local-only. No network. No labels, joins, trainers, or market fields.
 *
 * Algorithm: DATE-BATCH FREEZE
 *   D-1 history → freeze all games of D → apply D safe results → next date
 */
import { createHash } from "node:crypto";
import {
  MLB_INDEPENDENT_CLASS_A_TEMPORAL_POLICY_V1,
  MLB_INDEPENDENT_ENGINE_ADMISSION,
  MLB_INDEPENDENT_FEATURE_BUILDER_VERSION,
  MLB_INDEPENDENT_FEATURE_ROW_SCHEMA_V1,
  MLB_INDEPENDENT_FEATURE_SCHEMA_V1,
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
  hasUnprovenCompletionProvenance,
  isIsoInstant,
  isNonNegativeIntScore,
  normalizeCommenceTimeUtc,
  validateHistoricalSourceArtifact,
  type MlbIndependentSafeAHistoricalGameV1,
  type MlbIndependentSafeAHistoricalSourceV1,
  type SafeASourceStatusClass,
} from "./historical-source";

export type SafeAExclusionReason =
  | "NON_FINAL"
  | "POSTPONED"
  | "CANCELLED"
  | "INVALID_SCORE"
  | "TIED_FINAL"
  | "UNPROVEN_COMPLETION_PROVENANCE"
  | "TEAM_HISTORY_TAINTED_BY_UNPROVEN_COMPLETION"
  | "INVALID_IDENTITY"
  | "INVALID_GAME_TYPE";

export type SafeAExcludedTarget = {
  gamePk: number;
  officialDate: string;
  reason: SafeAExclusionReason;
};

export type SafeAMaterializationAuditV1 = {
  generatedAt: string;
  sourceSchemaVersion: string;
  sourcePath: string;
  sourceRowCount: number;
  featureRowCount: number;
  excludedTargetCount: number;
  firstOfficialDate: string | null;
  lastOfficialDate: string | null;
  uniqueGamePkCount: number;
  statusDistribution: Record<SafeASourceStatusClass, number>;
  exclusionReasonCounts: Record<string, number>;
  unusualProvenance: {
    resumeFieldCount: number;
    rescheduleFieldCount: number;
    suspendedStatusCount: number;
    otherFinalCount: number;
    tiedFinalCount: number;
    doubleHeaderGameCount: number;
    taintedTeamCount: number;
    crossDateResumeCount: number;
    resolvedCrossDateResumeCount: number;
    unprovenCrossDateResumeCount: number;
    resultApplyDatePolicy: "SAFE_RESULT_APPLY_DATE_V1";
    resumeCases: Array<{
      gamePk: number;
      officialDate: string;
      safeResultApplyDate: string | null;
      provenanceStatus: string;
    }>;
    finalRollingStateMatchesSource: boolean;
  };
  leakageChecks: {
    sameDayResultUsed: false;
    targetResultUsed: false;
    marketFieldsPresent: false;
    crossDateResultAppliedToOriginalDate: false;
  };
  contractChecks: {
    allFeatureRowsValid: boolean;
    featureArtifactValid: boolean;
  };
  researchState: {
    DATASET_READY: false;
    INDEPENDENT_MODEL_SAMPLE: 0;
  };
};

export type SafeAMaterializationResultV1 = {
  artifact: MlbIndependentFeatureArtifactV1;
  audit: SafeAMaterializationAuditV1;
  excluded: SafeAExcludedTarget[];
};

export class SafeAMaterializationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "SafeAMaterializationError";
    this.code = code;
  }
}

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

export function canonicalSerialize(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "number") {
    if (!Number.isFinite(value as number)) {
      throw new SafeAMaterializationError(
        "NON_FINITE_NUMBER",
        "canonical serialize received non-finite number",
      );
    }
    return JSON.stringify(value === 0 ? 0 : value);
  }
  if (t === "string" || t === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalSerialize(item)).join(",")}]`;
  }
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalSerialize(obj[key])}`)
      .join(",")}}`;
  }
  throw new SafeAMaterializationError(
    "UNSERIALIZABLE",
    `cannot canonicalize ${t}`,
  );
}

export function hashIndependentFeatureRowV1(
  row: MlbIndependentFeatureRowV1,
): string {
  const { featureHash: _ignored, ...rest } = row;
  void _ignored;
  return createHash("sha256")
    .update(canonicalSerialize(rest), "utf8")
    .digest("hex");
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

export type GameDisposition =
  | { kind: "FEATURE_TARGET"; applyResult: boolean }
  | { kind: "EXCLUDE"; reason: SafeAExclusionReason; taint: boolean; applyResult: false };

export function disposeHistoricalGame(
  game: MlbIndependentSafeAHistoricalGameV1,
): GameDisposition {
  if (game.gameType !== "R") {
    return { kind: "EXCLUDE", reason: "INVALID_GAME_TYPE", taint: false, applyResult: false };
  }
  if (hasUnprovenCompletionProvenance(game)) {
    return {
      kind: "EXCLUDE",
      reason: "UNPROVEN_COMPLETION_PROVENANCE",
      taint: true,
      applyResult: false,
    };
  }

  const status = classifySourceStatus(game);
  if (status === "POSTPONED") {
    return { kind: "EXCLUDE", reason: "POSTPONED", taint: false, applyResult: false };
  }
  if (status === "CANCELLED") {
    return { kind: "EXCLUDE", reason: "CANCELLED", taint: false, applyResult: false };
  }
  if (status === "SUSPENDED") {
    return {
      kind: "EXCLUDE",
      reason: "UNPROVEN_COMPLETION_PROVENANCE",
      taint: true,
      applyResult: false,
    };
  }
  if (status !== "FINAL_STANDARD") {
    return { kind: "EXCLUDE", reason: "NON_FINAL", taint: false, applyResult: false };
  }

  if (
    !isNonNegativeIntScore(game.homeScore) ||
    !isNonNegativeIntScore(game.awayScore)
  ) {
    return { kind: "EXCLUDE", reason: "INVALID_SCORE", taint: true, applyResult: false };
  }
  if (game.homeScore === game.awayScore) {
    return { kind: "EXCLUDE", reason: "TIED_FINAL", taint: true, applyResult: false };
  }

  return { kind: "FEATURE_TARGET", applyResult: true };
}

function isSafeCompletedResult(
  game: MlbIndependentSafeAHistoricalGameV1,
): boolean {
  if (game.resultProvenanceStatus === "UNPROVEN_COMPLETION") return false;
  if (game.resultProvenanceStatus === "NOT_APPLICABLE") return false;
  if (game.safeResultApplyDate == null) return false;
  if (classifySourceStatus(game) !== "FINAL_STANDARD") return false;
  if (
    !isNonNegativeIntScore(game.homeScore) ||
    !isNonNegativeIntScore(game.awayScore)
  ) {
    return false;
  }
  if (game.homeScore === game.awayScore) return false;
  return true;
}

function resultEventTimeUtc(
  game: MlbIndependentSafeAHistoricalGameV1,
): string {
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

function hasRescheduleProvenance(
  game: MlbIndependentSafeAHistoricalGameV1,
): boolean {
  return Boolean(
    game.rescheduleDate || game.rescheduledFrom || game.rescheduleGameDate,
  );
}

export function materializeIndependentSafeAFeaturesV1(
  source: MlbIndependentSafeAHistoricalSourceV1,
  options?: { sourcePath?: string; generatedAt?: string },
): SafeAMaterializationResultV1 {
  validateHistoricalSourceArtifact(source);

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
  let suspendedStatusCount = 0;
  let otherFinalCount = 0;
  let tiedFinalCount = 0;
  let doubleHeaderGameCount = 0;

  for (const game of games) {
    const status = classifySourceStatus(game);
    statusDistribution[status] += 1;
    if (hasResumeProvenance(game)) resumeFieldCount += 1;
    if (hasRescheduleProvenance(game)) rescheduleFieldCount += 1;
    if (status === "SUSPENDED") suspendedStatusCount += 1;
    if (status === "OTHER") otherFinalCount += 1;
    if (
      status === "FINAL_STANDARD" &&
      isNonNegativeIntScore(game.homeScore) &&
      isNonNegativeIntScore(game.awayScore) &&
      game.homeScore === game.awayScore
    ) {
      tiedFinalCount += 1;
    }
    if (
      game.doubleHeader === "Y" ||
      game.doubleHeader === "S" ||
      (game.gameNumber != null && game.gameNumber > 1)
    ) {
      doubleHeaderGameCount += 1;
    }
  }

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
      applyCompletedGame(teams, h2h, game);
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
  let finalRollingMismatches = 0;
  for (const teamId of teamIds) {
    const actual = teams.get(teamId) ?? emptyTeamState();
    const expected = expectedFinal.get(teamId) ?? { games: 0, wins: 0, losses: 0 };
    if (
      actual.games !== expected.games ||
      actual.wins !== expected.wins ||
      actual.losses !== expected.losses
    ) {
      finalRollingMismatches += 1;
    }
  }
  const finalRollingStateMatchesSource = finalRollingMismatches === 0;

  const resumeCases = games
    .filter(
      (g) =>
        g.resultProvenanceStatus === "CROSS_DATE_RESUME_RESOLVED" ||
        g.resultProvenanceStatus === "UNPROVEN_COMPLETION" ||
        hasResumeProvenance(g),
    )
    .map((g) => ({
      gamePk: g.gamePk,
      officialDate: g.officialDate,
      safeResultApplyDate: g.safeResultApplyDate,
      provenanceStatus: g.resultProvenanceStatus,
    }));
  const resolvedCrossDateResumeCount = games.filter(
    (g) => g.resultProvenanceStatus === "CROSS_DATE_RESUME_RESOLVED",
  ).length;
  const unprovenCrossDateResumeCount = games.filter(
    (g) => g.resultProvenanceStatus === "UNPROVEN_COMPLETION",
  ).length;
  const targetDates = games.map((g) => g.officialDate).sort();

  const audit: SafeAMaterializationAuditV1 = {
    generatedAt: options?.generatedAt ?? new Date().toISOString(),
    sourceSchemaVersion: source.schemaVersion,
    sourcePath:
      options?.sourcePath ??
      "data/research/mlb/independent-model-v1/historical-source/2024-regular-season-v1.json",
    sourceRowCount: source.rowCount,
    featureRowCount: rows.length,
    excludedTargetCount: excluded.length,
    firstOfficialDate: targetDates[0] ?? null,
    lastOfficialDate: targetDates[targetDates.length - 1] ?? null,
    uniqueGamePkCount: new Set(games.map((g) => g.gamePk)).size,
    statusDistribution,
    exclusionReasonCounts,
    unusualProvenance: {
      resumeFieldCount,
      rescheduleFieldCount,
      suspendedStatusCount,
      otherFinalCount,
      tiedFinalCount,
      doubleHeaderGameCount,
      taintedTeamCount,
      crossDateResumeCount: resolvedCrossDateResumeCount + unprovenCrossDateResumeCount,
      resolvedCrossDateResumeCount,
      unprovenCrossDateResumeCount,
      resultApplyDatePolicy: "SAFE_RESULT_APPLY_DATE_V1",
      resumeCases,
      finalRollingStateMatchesSource,
    },
    leakageChecks: {
      sameDayResultUsed: false,
      targetResultUsed: false,
      marketFieldsPresent: false,
      crossDateResultAppliedToOriginalDate: false,
    },
    contractChecks: {
      allFeatureRowsValid: true,
      featureArtifactValid: true,
    },
    researchState: {
      DATASET_READY: false,
      INDEPENDENT_MODEL_SAMPLE: 0,
    },
  };

  return { artifact, audit, excluded };
}

export function findFeatureRow(
  artifact: MlbIndependentFeatureArtifactV1,
  gamePk: number,
): MlbIndependentFeatureRowV1 | undefined {
  return artifact.rows.find((row) => row.identity.gamePk === gamePk);
}
