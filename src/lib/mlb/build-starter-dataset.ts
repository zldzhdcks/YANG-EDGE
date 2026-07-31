/**
 * MLB Starter Dataset v1 builder (research only).
 *
 * - Probable starter freeze at prediction/cutoff time
 * - gameLog as-of only (target game excluded)
 * - No Engine / Score / confirmed / QS
 * - Does not require Research Framework imports for domain logic
 */
import { createHash } from "node:crypto";
import { instantToKst } from "../datetime/kst";
import {
  buildMlbScheduleGameTargets,
  EMPTY_PREDICTION_HASH,
  fetchMlbScheduleForDateKst,
  parseOptionalPredictionSnapshot,
  type MlbOptionalPredictionSnapshot,
} from "./load-mlb-schedule-targets";
import {
  aggregatePitchingFromGameLog,
  filterGameLogBeforeCutoff,
  type GameLogSplit,
  type PersonPayload,
} from "./build-pitcher-stat-candidate";
import {
  STARTER_BUILDER_VERSION,
  STARTER_DATASET_ID,
  STARTER_SCHEMA_VERSION,
} from "./starter-dataset-constants";
import type {
  StarterDatasetDocument,
  StarterDatasetRow,
  StarterJoinQuality,
  StarterPostGameReview,
  StarterRecentStart,
  StarterSeasonStats,
} from "./starter-dataset-types";
import {
  createCacheUsage,
  getRawStatsJson,
  hashInput,
  readStarterDerivedJson,
  writeStarterDerivedJson,
  type CacheUsageStats,
} from "./research-stats-cache";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function namesEqual(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  return norm(a) === norm(b);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}
function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) out[key] = sortKeys(obj[key]);
  return out;
}

export type ScheduleProbableGame = {
  gamePk: number;
  gameDate: string;
  officialDate: string;
  statusAbstract: string;
  statusDetailed: string | null;
  codedGameState: string | null;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
  commenceTimeUtc: string;
  probableHome: { id: number | null; fullName: string | null };
  probableAway: { id: number | null; fullName: string | null };
};

export function extractScheduleWithProbables(
  data: unknown,
): ScheduleProbableGame[] {
  const root = asRecord(data);
  const dates = Array.isArray(root?.dates) ? root!.dates : [];
  const out: ScheduleProbableGame[] = [];
  for (const day of dates) {
    const games = Array.isArray(asRecord(day)?.games)
      ? (asRecord(day)!.games as unknown[])
      : [];
    for (const raw of games) {
      const row = asRecord(raw);
      if (!row) continue;
      const gamePk = asNumber(row.gamePk);
      const gameDate = asString(row.gameDate);
      const officialDate = asString(row.officialDate) ?? gameDate?.slice(0, 10);
      const statusAbstract =
        asString(asRecord(row.status)?.abstractGameState) ?? "";
      const statusDetailed =
        asString(asRecord(row.status)?.detailedState) ?? null;
      const codedGameState =
        asString(asRecord(row.status)?.codedGameState) ?? null;
      const teams = asRecord(row.teams);
      const home = asRecord(teams?.home);
      const away = asRecord(teams?.away);
      const homeTeamId = asNumber(asRecord(home?.team)?.id);
      const awayTeamId = asNumber(asRecord(away?.team)?.id);
      const homeTeam = asString(asRecord(home?.team)?.name);
      const awayTeam = asString(asRecord(away?.team)?.name);
      if (
        gamePk == null ||
        !gameDate ||
        !officialDate ||
        homeTeamId == null ||
        awayTeamId == null ||
        !homeTeam ||
        !awayTeam
      ) {
        continue;
      }
      const ph = asRecord(home?.probablePitcher);
      const pa = asRecord(away?.probablePitcher);
      out.push({
        gamePk,
        gameDate,
        officialDate,
        statusAbstract,
        statusDetailed,
        codedGameState,
        homeTeamId,
        awayTeamId,
        homeTeam,
        awayTeam,
        commenceTimeUtc: gameDate,
        probableHome: {
          id: asNumber(ph?.id),
          fullName: asString(ph?.fullName),
        },
        probableAway: {
          id: asNumber(pa?.id),
          fullName: asString(pa?.fullName),
        },
      });
    }
  }
  return out;
}

export function joinPredictionToSchedule(input: {
  homeTeam: string;
  awayTeam: string;
  startTimeKst: string | null;
  dateKst: string;
  schedule: ScheduleProbableGame[];
}): { quality: StarterJoinQuality; game: ScheduleProbableGame | null } {
  const candidates = input.schedule.filter(
    (g) =>
      namesEqual(g.homeTeam, input.homeTeam) &&
      namesEqual(g.awayTeam, input.awayTeam) &&
      instantToKst(g.commenceTimeUtc)?.date === input.dateKst,
  );
  if (candidates.length === 1) return { quality: "MATCHED", game: candidates[0] };
  if (candidates.length > 1) {
    const startTime = input.startTimeKst;
    if (startTime) {
      const narrowed = candidates.filter((g) => {
        const kst = instantToKst(g.commenceTimeUtc);
        return kst?.time?.slice(0, 5) === startTime.slice(0, 5);
      });
      if (narrowed.length === 1) {
        return { quality: "MATCHED", game: narrowed[0] };
      }
    }
    return { quality: "AMBIGUOUS", game: null };
  }
  return { quality: "UNLINKED", game: null };
}

type DerivedPitcherStats = {
  seasonStats: StarterSeasonStats;
  recentStarts: StarterRecentStart[];
  sampleSize: number;
  targetGameExcludedCount: number;
  cutoffExcludedCount: number;
  keptSplitCount: number;
  statsSource: string;
};

function emptySeasonStats(): StarterSeasonStats {
  return {
    era: null,
    whip: null,
    inningsPitched: null,
    gamesPlayed: null,
    gamesStarted: null,
    wins: null,
    losses: null,
    strikeOuts: null,
    baseOnBalls: null,
    homeRuns: null,
  };
}

export function buildDerivedPitcherStats(input: {
  splits: GameLogSplit[];
  cutoffTime: string;
  targetGamePk: number;
}): DerivedPitcherStats & {
  leakageFlags: string[];
} {
  const leakageFlags: string[] = [];
  let targetGameExcludedCount = 0;
  let cutoffExcludedCount = 0;
  const cutoffMs = Date.parse(input.cutoffTime);
  const cutoffDateUtc = Number.isFinite(cutoffMs)
    ? new Date(cutoffMs).toISOString().slice(0, 10)
    : null;
  if (!cutoffDateUtc) {
    leakageFlags.push("CUTOFF_UNPARSEABLE");
    return {
      seasonStats: emptySeasonStats(),
      recentStarts: [],
      sampleSize: 0,
      targetGameExcludedCount: 0,
      cutoffExcludedCount: 0,
      keptSplitCount: 0,
      statsSource: "none",
      leakageFlags,
    };
  }

  for (const split of input.splits) {
    const gamePk =
      typeof split.game?.gamePk === "number" ? split.game.gamePk : null;
    const date = typeof split.date === "string" ? split.date : null;
    if (gamePk === input.targetGamePk) targetGameExcludedCount += 1;
    if (date && date >= cutoffDateUtc) cutoffExcludedCount += 1;
  }

  const { kept, leakageSuspect } = filterGameLogBeforeCutoff(
    input.splits,
    input.cutoffTime,
    input.targetGamePk,
  );
  if (leakageSuspect) leakageFlags.push("LEAKAGE_ROWS_EXCLUDED");

  // Safety: assert no target / post-cutoff remain
  for (const split of kept) {
    const gamePk =
      typeof split.game?.gamePk === "number" ? split.game.gamePk : null;
    const date = typeof split.date === "string" ? split.date : null;
    if (gamePk === input.targetGamePk) {
      throw new Error("target game present in kept splits");
    }
    if (date && date >= cutoffDateUtc) {
      throw new Error("cutoff violation in kept splits");
    }
  }

  const agg = aggregatePitchingFromGameLog(kept);
  const starts = agg.recentOutings.filter((o) => (o.gamesStarted ?? 0) > 0);
  const recentStarts: StarterRecentStart[] = starts.map((o) => ({
    date: o.date,
    gamePk: o.gamePk,
    inningsPitched: o.inningsPitched,
    earnedRuns: o.earnedRuns,
    strikeOuts: o.strikeOuts,
    baseOnBalls: o.baseOnBalls,
    hits: o.hits,
    homeRuns: o.homeRuns,
    numberOfPitches: o.numberOfPitches,
    win: o.win,
    loss: o.loss,
  }));

  return {
    seasonStats: {
      era: agg.seasonEra,
      whip: agg.seasonWhip,
      inningsPitched: agg.inningsPitched,
      gamesPlayed: agg.gamesPlayed,
      gamesStarted: agg.gamesStarted,
      wins: agg.wins,
      losses: agg.losses,
      strikeOuts: agg.strikeOuts,
      baseOnBalls: agg.baseOnBalls,
      homeRuns: agg.homeRuns,
    },
    recentStarts,
    sampleSize: agg.gamesStarted ?? 0,
    targetGameExcludedCount,
    cutoffExcludedCount,
    keptSplitCount: kept.length,
    statsSource:
      "mlb-statsapi:/people/{id}/stats?stats=gameLog&group=pitching (pre-cutoff aggregate)",
    leakageFlags,
  };
}

function extractGameLogSplits(body: unknown): GameLogSplit[] {
  const root = asRecord(body);
  const stats = Array.isArray(root?.stats) ? root!.stats : [];
  const first = asRecord(stats[0]);
  const arr = Array.isArray(first?.splits) ? (first!.splits as unknown[]) : [];
  const splits: GameLogSplit[] = [];
  for (const s of arr) {
    const split = asRecord(s);
    if (!split) continue;
    splits.push({
      date: asString(split.date) ?? undefined,
      isHome: typeof split.isHome === "boolean" ? split.isHome : undefined,
      game: {
        gamePk: asNumber(asRecord(split.game)?.gamePk) ?? undefined,
      },
      team: { name: asString(asRecord(split.team)?.name) ?? undefined },
      opponent: {
        name: asString(asRecord(split.opponent)?.name) ?? undefined,
      },
      stat: asRecord(split.stat) ?? undefined,
    });
  }
  return splits;
}

function extractPerson(body: unknown): PersonPayload | null {
  const root = asRecord(body);
  const people = Array.isArray(root?.people) ? root!.people : [];
  const p = asRecord(people[0]);
  if (!p) return null;
  return {
    id: asNumber(p.id) ?? undefined,
    fullName: asString(p.fullName) ?? undefined,
    pitchHand: {
      code: asString(asRecord(p.pitchHand)?.code) ?? undefined,
      description: asString(asRecord(p.pitchHand)?.description) ?? undefined,
    },
    currentTeam: {
      name: asString(asRecord(p.currentTeam)?.name) ?? undefined,
    },
  };
}

async function loadPersonCached(
  playerId: number,
  usage: CacheUsageStats,
  mem: Map<number, PersonPayload | null>,
): Promise<PersonPayload | null> {
  if (mem.has(playerId)) return mem.get(playerId) ?? null;
  const body = await getRawStatsJson(`/api/v1/people/${playerId}`, usage);
  const person = extractPerson(body);
  mem.set(playerId, person);
  return person;
}

async function loadGameLogCached(
  playerId: number,
  season: number,
  usage: CacheUsageStats,
  mem: Map<number, GameLogSplit[]>,
): Promise<GameLogSplit[]> {
  if (mem.has(playerId)) return mem.get(playerId) ?? [];
  const q = `/api/v1/people/${playerId}/stats?stats=gameLog&group=pitching&season=${season}&sportId=1`;
  const body = await getRawStatsJson(q, usage);
  const splits = extractGameLogSplits(body);
  mem.set(playerId, splits);
  return splits;
}

async function loadOrBuildDerivedStats(input: {
  playerId: number;
  cutoffTime: string;
  targetGamePk: number;
  dateKst: string;
  usage: CacheUsageStats;
  gameLogMem: Map<number, GameLogSplit[]>;
}): Promise<DerivedPitcherStats & { leakageFlags: string[] }> {
  const cutoffDate = new Date(Date.parse(input.cutoffTime))
    .toISOString()
    .slice(0, 10);
  const fileName = `pitcher-${input.playerId}-cut-${cutoffDate}-ex-${input.targetGamePk}.json`;
  const cached = await readStarterDerivedJson<
    DerivedPitcherStats & { leakageFlags: string[] }
  >(fileName, STARTER_BUILDER_VERSION, input.usage);
  if (cached) return cached.data;

  const season = Number(input.dateKst.slice(0, 4));
  const splits = await loadGameLogCached(
    input.playerId,
    season,
    input.usage,
    input.gameLogMem,
  );
  const derived = buildDerivedPitcherStats({
    splits,
    cutoffTime: input.cutoffTime,
    targetGamePk: input.targetGamePk,
  });
  await writeStarterDerivedJson(fileName, derived, {
    schemaVersion: STARTER_SCHEMA_VERSION,
    builderVersion: STARTER_BUILDER_VERSION,
    dataThroughDate: input.dateKst,
    inputHash: hashInput([
      input.playerId,
      cutoffDate,
      input.targetGamePk,
      STARTER_BUILDER_VERSION,
    ]),
    recordCount: derived.keptSplitCount,
  });
  return derived;
}

function namesNorm(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

async function getGameAbstractState(
  gamePk: number,
  usage: CacheUsageStats,
): Promise<string | null> {
  const body = await getRawStatsJson(
    `/api/v1/schedule?sportId=1&gamePk=${gamePk}`,
    usage,
  );
  const root = asRecord(body);
  const dates = Array.isArray(root?.dates) ? root!.dates : [];
  for (const day of dates) {
    const games = Array.isArray(asRecord(day)?.games)
      ? (asRecord(day)!.games as unknown[])
      : [];
    for (const raw of games) {
      const row = asRecord(raw);
      if (asNumber(row?.gamePk) !== gamePk) continue;
      return asString(asRecord(row?.status)?.abstractGameState);
    }
  }
  return null;
}

/**
 * Post-game annotation only. Never mutates pre-game probable fields.
 * Non-Final games → AWAITING_RESULT (no MATCHED/CHANGED).
 */
export async function resolveStarterPostGameReview(input: {
  gamePk: number;
  probableId: number | null;
  probableName: string | null;
  side: "home" | "away";
  usage: CacheUsageStats;
}): Promise<StarterPostGameReview> {
  const comparedAt = new Date().toISOString();
  const state = await getGameAbstractState(input.gamePk, input.usage);
  if (state !== "Final") {
    return {
      status: "AWAITING_RESULT",
      actualStarterId: null,
      actualStarterName: null,
      comparedAt,
      note: `game not Final (abstractGameState=${state ?? "unknown"})`,
    };
  }

  try {
    const body = await getRawStatsJson(
      `/api/v1/game/${input.gamePk}/boxscore`,
      input.usage,
    );
    const root = asRecord(body);
    const teams = asRecord(root?.teams);
    const sideBox = asRecord(teams?.[input.side]);
    const pitchers = Array.isArray(sideBox?.pitchers)
      ? (sideBox!.pitchers as unknown[])
      : [];
    const firstId = asNumber(pitchers[0]);
    const players = asRecord(sideBox?.players) ?? {};
    let actualName: string | null = null;
    const actualId: number | null = firstId;
    if (firstId != null) {
      const p = asRecord(players[`ID${firstId}`]);
      actualName =
        asString(asRecord(p?.person)?.fullName) ??
        asString(p?.nameFirstLast) ??
        null;
    }
    if (actualId == null && !actualName) {
      return {
        status: "NOT_FINAL",
        actualStarterId: null,
        actualStarterName: null,
        comparedAt,
        note: "Final status but boxscore starter unavailable",
      };
    }
    if (input.probableId == null && !input.probableName) {
      return {
        status: "STARTER_UNKNOWN",
        actualStarterId: actualId,
        actualStarterName: actualName,
        comparedAt,
        note: "probable missing; cannot compare",
      };
    }
    const idMatch =
      input.probableId != null &&
      actualId != null &&
      input.probableId === actualId;
    const nameMatch = namesNorm(input.probableName, actualName);
    if (idMatch || nameMatch) {
      return {
        status: "STARTER_MATCHED",
        actualStarterId: actualId,
        actualStarterName: actualName,
        comparedAt,
        note: "probable vs boxscore pitchers[0]",
      };
    }
    return {
      status: "STARTER_CHANGED",
      actualStarterId: actualId,
      actualStarterName: actualName,
      comparedAt,
      note: "probable vs boxscore pitchers[0] mismatch — pre-game row unchanged",
    };
  } catch {
    return {
      status: "NOT_FINAL",
      actualStarterId: null,
      actualStarterName: null,
      comparedAt,
      note: "boxscore fetch/cache failed after Final",
    };
  }
}

/** @deprecated use resolveStarterPostGameReview — kept as thin alias */
async function buildPostGameReview(input: {
  gamePk: number;
  probableId: number | null;
  probableName: string | null;
  side: "home" | "away";
  usage: CacheUsageStats;
}): Promise<StarterPostGameReview> {
  return resolveStarterPostGameReview(input);
}

function hashableRows(rows: StarterDatasetRow[]): unknown {
  return rows.map((r) => {
    const { postGameReview, ...pre } = r;
    return {
      ...pre,
      // postGameReview status/id/name only (exclude comparedAt wall-clock)
      postGameReview: postGameReview
        ? {
            status: postGameReview.status,
            actualStarterId: postGameReview.actualStarterId,
            actualStarterName: postGameReview.actualStarterName,
            note: postGameReview.note,
          }
        : null,
    };
  });
}

export async function buildStarterDatasetV1(input: {
  dateKst: string;
  predictionRaw?: string | null;
  includePostGameReview?: boolean;
}): Promise<{
  document: StarterDatasetDocument;
  predictionHash: string;
  usage: CacheUsageStats;
}> {
  const usage = createCacheUsage();
  const optionalPrediction: MlbOptionalPredictionSnapshot | null =
    input.predictionRaw != null && input.predictionRaw.trim() !== ""
      ? parseOptionalPredictionSnapshot(input.predictionRaw, input.dateKst)
      : null;
  const predictionHash = optionalPrediction?.hash ?? EMPTY_PREDICTION_HASH;
  const documentGeneratedAt = new Date().toISOString();
  const scheduleFetchedAt = documentGeneratedAt;

  const scheduleAll = await fetchMlbScheduleForDateKst(input.dateKst, usage);
  const scheduleTargets = buildMlbScheduleGameTargets(
    input.dateKst,
    scheduleAll,
    optionalPrediction,
  );

  const personMem = new Map<number, PersonPayload | null>();
  const gameLogMem = new Map<number, GameLogSplit[]>();
  const rows: StarterDatasetRow[] = [];
  let targetGameIncludedInStats = 0;
  let cutoffViolations = 0;

  for (const target of scheduleTargets) {
    const game = target.scheduleGame;
    const gameId = target.gameId;
    const homeTeam = target.homeTeam;
    const awayTeam = target.awayTeam;
    const joinQuality: StarterJoinQuality = "MATCHED";

    const sides: Array<{
      side: "home" | "away";
      teamId: number | null;
      opponentTeamId: number | null;
      probable: { id: number | null; fullName: string | null };
    }> = [
      {
        side: "home",
        teamId: game.homeTeamId,
        opponentTeamId: game.awayTeamId,
        probable: game.probableHome,
      },
      {
        side: "away",
        teamId: game.awayTeamId,
        opponentTeamId: game.homeTeamId,
        probable: game.probableAway,
      },
    ];

    for (const s of sides) {
      const missingFields: string[] = [];
      const warnings: string[] = [
        "MLB_STATSAPI_COMMERCIAL_USE_UNVERIFIED",
        "PROBABLE_NOT_CONFIRMED",
      ];
      const cutoffTime = game.commenceTimeUtc;
      // Timestamp contract: do not copy prediction snapshot time into sourceTimestamp.
      const artifactGeneratedAt = documentGeneratedAt;
      const fetchedAt = scheduleFetchedAt ?? artifactGeneratedAt;
      const sourceTimestamp = fetchedAt; // deprecated alias → fetchedAt
      const statsAsOf = cutoffTime;
      let seasonStats: StarterSeasonStats | null = null;
      let recentStarts: StarterRecentStart[] = [];
      let sampleSize: number | null = null;
      let throws: "L" | "R" | null = null;
      let probableStatus: "PROBABLE_ONLY" | "MISSING" = "MISSING";
      let postGameReview: StarterPostGameReview | null = null;

      if (!cutoffTime) {
        missingFields.push("cutoffTime", "seasonStats", "recentStarts");
        warnings.push("CUTOFF_MISSING_STATS_OMITTED");
      }

      const hasProbable =
        s.probable.id != null && Boolean(s.probable.fullName);
      if (hasProbable) {
        probableStatus = "PROBABLE_ONLY";
      } else {
        probableStatus = "MISSING";
        missingFields.push("probablePitcherId", "probablePitcherName");
      }

      if (hasProbable && cutoffTime && s.probable.id != null) {
        const person = await loadPersonCached(
          s.probable.id,
          usage,
          personMem,
        );
        const code = person?.pitchHand?.code?.toUpperCase();
        throws = code === "L" || code === "R" ? code : null;
        if (throws == null) missingFields.push("throws");

        const derived = await loadOrBuildDerivedStats({
          playerId: s.probable.id,
          cutoffTime,
          targetGamePk: game.gamePk,
          dateKst: input.dateKst,
          usage,
          gameLogMem,
        });
        if (derived.leakageFlags.includes("CUTOFF_UNPARSEABLE")) {
          cutoffViolations += 1;
          seasonStats = null;
          recentStarts = [];
          sampleSize = null;
          missingFields.push("seasonStats", "recentStarts");
          warnings.push("CUTOFF_UNPARSEABLE_STATS_OMITTED");
        } else {
          seasonStats = derived.seasonStats;
          recentStarts = derived.recentStarts;
          sampleSize = derived.sampleSize;
          if (seasonStats.era == null) missingFields.push("seasonStats.era");
          if (seasonStats.whip == null) missingFields.push("seasonStats.whip");
          if (recentStarts.length === 0) missingFields.push("recentStarts");
          warnings.push(...derived.leakageFlags);
        }

        if (input.includePostGameReview === true) {
          postGameReview = await buildPostGameReview({
            gamePk: game.gamePk,
            probableId: s.probable.id,
            probableName: s.probable.fullName,
            side: s.side,
            usage,
          });
        }
      } else if (!cutoffTime && hasProbable) {
        warnings.push("STATS_SKIPPED_NO_CUTOFF");
      }

      rows.push({
        schemaVersion: STARTER_SCHEMA_VERSION,
        builderVersion: STARTER_BUILDER_VERSION,
        predictionDate: input.dateKst,
        gameId,
        gamePk: game.gamePk,
        teamId: s.teamId,
        opponentTeamId: s.opponentTeamId,
        side: s.side,
        homeTeam: homeTeam || null,
        awayTeam: awayTeam || null,
        probablePitcherId: s.probable.id,
        probablePitcherName: s.probable.fullName,
        throws,
        probableStatus,
        sourceTimestamp,
        fetchedAt,
        artifactGeneratedAt,
        statsAsOf,
        cutoffTime,
        seasonStats,
        recentStarts,
        sampleSize,
        joinQuality,
        missingFields: [...new Set(missingFields)],
        warnings: [...new Set(warnings)],
        researchOnly: true,
        legalStatus: "INTERNAL_RESEARCH_ONLY",
        preGameImmutable: true,
        postGameReview,
      });
    }
  }

  rows.sort((a, b) => {
    const g = (a.gameId ?? "").localeCompare(b.gameId ?? "");
    if (g !== 0) return g;
    return a.side.localeCompare(b.side);
  });

  // Integrity recount: target/cutoff in recentStarts
  for (const row of rows) {
    if (!row.cutoffTime || row.gamePk == null) continue;
    const cutDate = new Date(Date.parse(row.cutoffTime))
      .toISOString()
      .slice(0, 10);
    for (const st of row.recentStarts) {
      if (st.gamePk === row.gamePk) targetGameIncludedInStats += 1;
      if (st.date && st.date >= cutDate) cutoffViolations += 1;
    }
  }

  const joinQuality: Record<StarterJoinQuality, number> = {
    MATCHED: 0,
    AMBIGUOUS: 0,
    UNLINKED: 0,
  };
  let probableRows = 0;
  let missingRows = 0;
  let homeRows = 0;
  let awayRows = 0;
  let seasonStatsAvailable = 0;
  let recentStartsAvailable = 0;
  let sampleSum = 0;
  let sampleN = 0;
  let starterChangedReviews = 0;
  for (const r of rows) {
    joinQuality[r.joinQuality] += 1;
    if (r.probableStatus === "PROBABLE_ONLY") probableRows += 1;
    else missingRows += 1;
    if (r.side === "home") homeRows += 1;
    else awayRows += 1;
    if (r.seasonStats?.era != null || r.seasonStats?.whip != null) {
      seasonStatsAvailable += 1;
    }
    if (r.recentStarts.length > 0) recentStartsAvailable += 1;
    if (r.sampleSize != null) {
      sampleSum += r.sampleSize;
      sampleN += 1;
    }
    if (r.postGameReview?.status === "STARTER_CHANGED") {
      starterChangedReviews += 1;
    }
  }

  const inputHashSha256 = hashInput([
    STARTER_DATASET_ID,
    STARTER_SCHEMA_VERSION,
    STARTER_BUILDER_VERSION,
    input.dateKst,
    predictionHash,
    scheduleAll.map((g) => ({
      gamePk: g.gamePk,
      home: g.probableHome,
      away: g.probableAway,
    })),
  ]);

  const resultHashSha256 = sha256(stableStringify(hashableRows(rows)));

  const document: StarterDatasetDocument = {
    meta: {
      datasetId: STARTER_DATASET_ID,
      schemaVersion: STARTER_SCHEMA_VERSION,
      builderVersion: STARTER_BUILDER_VERSION,
      status: "COLLECTING",
      engineAdmission: "PROHIBITED",
      engineConnected: false,
      engineUseAllowed: false,
      researchOnly: true,
      dateKst: input.dateKst,
      generatedAt: documentGeneratedAt,
      predictionHashSha256: predictionHash,
      predictionUnchanged: true,
      inputHashSha256,
      resultHashSha256,
      legal: {
        mlbStatsSource: "INTERNAL_RESEARCH_ONLY",
        publicRuntimeUseAllowed: false,
        commercialRuntimeUseAllowed: false,
        rawResponseInResearchCacheOnly: true,
        mlbHtmlCrawling: false,
        sportsDataIoScrambled: false,
      },
    },
    cacheUsage: { ...usage },
    summary: {
      totalGames: scheduleTargets.length,
      totalRows: rows.length,
      probableRows,
      missingRows,
      homeRows,
      awayRows,
      seasonStatsAvailable,
      recentStartsAvailable,
      averageSampleSize:
        sampleN > 0 ? Math.round((sampleSum / sampleN) * 10) / 10 : null,
      joinQuality,
      targetGameIncludedInStats,
      cutoffViolations,
      confirmedRows: 0,
      starterChangedReviews,
    },
    rows,
  };

  return { document, predictionHash, usage };
}

export function assertStarterDatasetIntegrity(
  doc: StarterDatasetDocument,
): string[] {
  const errors: string[] = [];
  if (doc.summary.confirmedRows !== 0) {
    errors.push("confirmedRows must be 0");
  }
  for (const row of doc.rows) {
    if ((row as { probableStatus: string }).probableStatus === "CONFIRMED") {
      errors.push(`${row.gameId}/${row.side}: CONFIRMED forbidden`);
    }
    if (!row.preGameImmutable) {
      errors.push(`${row.gameId}/${row.side}: preGameImmutable false`);
    }
    if (row.cutoffTime && row.gamePk != null) {
      const cutDate = new Date(Date.parse(row.cutoffTime))
        .toISOString()
        .slice(0, 10);
      for (const st of row.recentStarts) {
        if (st.gamePk === row.gamePk) {
          errors.push(`${row.gameId}/${row.side}: target game in recentStarts`);
        }
        if (st.date && st.date >= cutDate) {
          errors.push(`${row.gameId}/${row.side}: cutoff violation ${st.date}`);
        }
      }
    }
  }
  if (doc.summary.targetGameIncludedInStats !== 0) {
    errors.push("targetGameIncludedInStats != 0");
  }
  if (doc.summary.cutoffViolations !== 0) {
    errors.push("cutoffViolations != 0");
  }
  return errors;
}
