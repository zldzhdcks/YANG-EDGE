/**
 * MLB Batter Dataset v0 builder.
 * Prediction does not call this. Network default off for completed slates.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GameLogSplit } from "../build-pitcher-stat-candidate";
import type { MlbExpectedLineupObservationV0 } from "../expected-lineup-observation-v0/types";
import type { LineupDatasetDocument, LineupDatasetRow } from "../lineup-dataset-types";
import {
  createCacheUsage,
  getRawStatsJson,
  type CacheUsageStats,
} from "../research-stats-cache";
import { mlbExpectedLineupObservationRel } from "../expected-lineup-observation-v0/paths";
import { mlbLineupDatasetRel } from "../expected-lineup-observation-v0/paths";
import { mlbScheduleRel } from "../research-scorecard-v1/paths";
import { mlbPredictionRel } from "../research-scorecard-v1/paths";
import {
  filterHittingGameLogAsOf,
  latestIncludedGameDate,
  slateFullyPregame,
  statsThroughDateForGame,
} from "./cutoff";
import { sha256Json, sha256Text } from "./hash";
import {
  aggregateHittingFromGameLog,
  batsFromPerson,
  parseGameLogSplits,
} from "./hitting";
import {
  BATTER_BUILDER_VERSION,
  BATTER_DATASET_ID,
  BATTER_SCHEMA_VERSION,
  emptyCounting,
  emptyDerived,
  emptyRates,
  emptySampleSize,
  type BatterBats,
  type BatterDatasetDocument,
  type BatterGameRow,
  type BatterLineupStatus,
  type BatterReconstructionSafety,
  type BatterRowStatus,
  type BatterSideBlock,
  type BatterSlotRow,
} from "./types";

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

type ScheduleGame = {
  gameId: string;
  gamePk: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  commenceTimeUtc: string;
  officialDate: string | null;
};

type LineupSlot = {
  battingOrder: number;
  playerId: number | null;
  playerName: string | null;
  position: string | null;
  bats: BatterBats | null;
  lineupStatus: BatterLineupStatus;
  lineupObservedAt: string | null;
  lineupSource: string | null;
};

export type BatterDatasetSources = {
  scheduleGames: ScheduleGame[];
  lineupDoc: LineupDatasetDocument | null;
  expectedObs: MlbExpectedLineupObservationV0 | null;
  sourceArtifacts: string[];
  sourceArtifactHashes: Record<string, string>;
  predictionHashSha256: string;
};

export type BuildBatterDatasetInput = {
  dateKst: string;
  cwd?: string;
  generatedAt: string;
  nowMs?: number;
  allowNetwork?: boolean;
  sources?: BatterDatasetSources;
  /** Test-only in-memory Stats API bodies. Skips disk/network when set. */
  statLookup?: {
    person: (playerId: number) => unknown | null;
    hittingGameLog: (playerId: number) => unknown | null;
  };
}

function emptySlot(order: number, lineupStatus: BatterLineupStatus): BatterSlotRow {
  return {
    battingOrder: order,
    playerId: null,
    playerName: null,
    position: null,
    bats: "UNKNOWN",
    primaryPosition: null,
    lineupStatus,
    lineupObservedAt: null,
    lineupSource: null,
    rowStatus: "LINEUP_NOT_CONFIRMED",
    sampleSize: emptySampleSize(),
    counting: emptyCounting(),
    rates: emptyRates(),
    countingDerived: emptyDerived(),
    ratesDerived: emptyDerived(),
    statsThroughDate: null,
    latestIncludedGameDate: null,
    statsSource: null,
    recentCondition: null,
    splits: null,
    advanced: null,
    warnings: ["LINEUP_SLOT_EMPTY"],
  };
}

function normalizeBats(raw: string | null | undefined): BatterBats | null {
  if (!raw) return null;
  const c = raw.trim().toUpperCase();
  if (c === "L" || c === "R" || c === "S") return c;
  if (c === "LEFT") return "L";
  if (c === "RIGHT") return "R";
  if (c === "SWITCH") return "S";
  return null;
}

function officialPregameLineup(
  row: LineupDatasetRow | undefined,
): LineupSlot[] | null {
  if (!row) return null;
  if (row.collectionPhase === "POST_GAME") return null;
  if (row.collectionStatus !== "CONFIRMED" || row.confirmed !== true) return null;
  if (!Array.isArray(row.battingOrder) || row.battingOrder.length === 0) {
    return null;
  }
  return row.battingOrder
    .filter((b) => b.slot >= 1 && b.slot <= 9)
    .map((b) => ({
      battingOrder: b.slot,
      playerId: b.playerId,
      playerName: b.playerName,
      position: b.defensivePosition,
      bats: null,
      lineupStatus: "CONFIRMED" as const,
      lineupObservedAt: row.lineupConfirmedAt ?? row.fetchedAt ?? null,
      lineupSource: row.lineupSource ?? "mlb-statsapi",
    }));
}

function expectedSlots(
  obs: MlbExpectedLineupObservationV0 | null,
  gamePk: number,
  side: "home" | "away",
): LineupSlot[] | null {
  const game = obs?.games.find((g) => g.gamePk === gamePk);
  if (!game) return null;
  if (game.observationStatus === "NOT_OBSERVED") return null;
  const list = side === "home" ? game.homeLineup : game.awayLineup;
  if (!Array.isArray(list) || list.length === 0) return null;
  return list
    .filter((b) => b.battingOrder >= 1 && b.battingOrder <= 9)
    .map((b) => ({
      battingOrder: b.battingOrder,
      playerId: null,
      playerName: b.displayName,
      position: b.position,
      bats: normalizeBats(b.bats),
      lineupStatus: "EXPECTED" as const,
      lineupObservedAt: game.observedAt ?? obs?.observedAt ?? null,
      lineupSource: "expected-lineup-observation-v0",
    }));
}

function resolveSideSlots(input: {
  lineupRows: LineupDatasetRow[];
  expected: MlbExpectedLineupObservationV0 | null;
  gamePk: number;
  side: "home" | "away";
}): { slots: LineupSlot[]; status: BatterLineupStatus; warnings: string[] } {
  const warnings: string[] = [];
  const official = input.lineupRows.find(
    (r) => r.gamePk === input.gamePk && r.side === input.side,
  );
  if (official?.collectionPhase === "POST_GAME" && official.confirmed) {
    warnings.push("POSTGAME_LINEUP_EXCLUDED");
  }
  const confirmed = officialPregameLineup(official);
  if (confirmed && confirmed.length > 0) {
    return { slots: confirmed, status: "CONFIRMED", warnings };
  }
  const expected = expectedSlots(input.expected, input.gamePk, input.side);
  if (expected && expected.length > 0) {
    return { slots: expected, status: "EXPECTED", warnings };
  }
  return { slots: [], status: "UNAVAILABLE", warnings };
}

function mergeNine(slots: LineupSlot[], status: BatterLineupStatus): LineupSlot[] {
  const byOrder = new Map(slots.map((s) => [s.battingOrder, s]));
  const out: LineupSlot[] = [];
  for (let order = 1; order <= 9; order += 1) {
    const hit = byOrder.get(order);
    out.push(
      hit ?? {
        battingOrder: order,
        playerId: null,
        playerName: null,
        position: null,
        bats: null,
        lineupStatus: status === "CONFIRMED" ? "CONFIRMED" : status,
        lineupObservedAt: null,
        lineupSource: null,
      },
    );
  }
  return out;
}

async function readJsonIfExists(abs: string): Promise<{ raw: string; json: unknown } | null> {
  try {
    const raw = await readFile(abs, "utf8");
    return { raw, json: JSON.parse(raw) as unknown };
  } catch {
    return null;
  }
}

function parseScheduleGames(json: unknown): ScheduleGame[] {
  const root = asRecord(json);
  const games = Array.isArray(root?.games) ? root!.games : [];
  const out: ScheduleGame[] = [];
  for (const raw of games) {
    const row = asRecord(raw);
    if (!row) continue;
    const gamePk = asNumber(row.gamePk);
    const gameId = asString(row.internalGameId) ?? asString(row.gameId);
    const commence = asString(row.commenceTimeUtc) ?? asString(row.scheduledStartTime);
    const homeTeam = asString(row.homeTeam);
    const awayTeam = asString(row.awayTeam);
    if (gamePk == null || !gameId || !commence || !homeTeam || !awayTeam) continue;
    out.push({
      gameId,
      gamePk,
      homeTeam,
      awayTeam,
      homeTeamId: asNumber(row.homeTeamId),
      awayTeamId: asNumber(row.awayTeamId),
      commenceTimeUtc: commence,
      officialDate: asString(row.officialDate),
    });
  }
  out.sort((a, b) => {
    const c = a.commenceTimeUtc.localeCompare(b.commenceTimeUtc);
    if (c !== 0) return c;
    return a.gamePk - b.gamePk;
  });
  return out;
}

export async function loadBatterDatasetSources(input: {
  dateKst: string;
  cwd: string;
}): Promise<BatterDatasetSources> {
  const scheduleRel = mlbScheduleRel(input.dateKst);
  const lineupRel = mlbLineupDatasetRel(input.dateKst);
  const expectedRel = mlbExpectedLineupObservationRel(input.dateKst);
  const predictionRel = mlbPredictionRel(input.dateKst);

  const scheduleFile = await readJsonIfExists(path.join(input.cwd, scheduleRel));
  const lineupFile = await readJsonIfExists(path.join(input.cwd, lineupRel));
  const expectedFile = await readJsonIfExists(path.join(input.cwd, expectedRel));
  const predictionFile = await readJsonIfExists(path.join(input.cwd, predictionRel));

  const hashes: Record<string, string> = {};
  const artifacts: string[] = [];
  if (scheduleFile) {
    artifacts.push(scheduleRel);
    hashes[scheduleRel] = sha256Text(scheduleFile.raw);
  }
  if (lineupFile) {
    artifacts.push(lineupRel);
    hashes[lineupRel] = sha256Text(lineupFile.raw);
  }
  if (expectedFile) {
    artifacts.push(expectedRel);
    hashes[expectedRel] = sha256Text(expectedFile.raw);
  }
  if (predictionFile) {
    hashes[predictionRel] = sha256Text(predictionFile.raw);
  }

  return {
    scheduleGames: scheduleFile ? parseScheduleGames(scheduleFile.json) : [],
    lineupDoc: lineupFile ? (lineupFile.json as LineupDatasetDocument) : null,
    expectedObs: expectedFile
      ? (expectedFile.json as MlbExpectedLineupObservationV0)
      : null,
    sourceArtifacts: artifacts,
    sourceArtifactHashes: hashes,
    predictionHashSha256: predictionFile
      ? sha256Text(predictionFile.raw)
      : sha256Text(""),
  };
}

async function tryReadCachedStatsJson(
  pathQuery: string,
  usage: CacheUsageStats,
  cwd: string,
): Promise<unknown | null> {
  const key = pathQuery.replace(/^\//, "").replace(/[?&=]/g, "_");
  const file = path.join(
    cwd,
    "data",
    "cache",
    "research",
    "mlb",
    "raw",
    "statsapi",
    `${key}.json`,
  );
  try {
    const raw = await readFile(file, "utf8");
    usage.rawHit += 1;
    const parsed = JSON.parse(raw) as { body?: unknown };
    return parsed.body ?? parsed;
  } catch {
    usage.rawMiss += 1;
    return null;
  }
}

type PersonCache = {
  bats: BatterBats;
  primaryPosition: string | null;
  fullName: string | null;
  ok: boolean;
};

type HittingCache = {
  splits: GameLogSplit[] | null;
  ok: boolean;
  error: string | null;
};

function hittingPath(playerId: number, season: number): string {
  return `/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=${season}&sportId=1`;
}

function personPath(playerId: number): string {
  return `/api/v1/people/${playerId}`;
}

function chooseRowStatus(input: {
  lineupStatus: BatterLineupStatus;
  playerId: number | null;
  statsReady: boolean;
  statsPartial: boolean;
  cutoffUnsafe: boolean;
  providerError: boolean;
}): BatterRowStatus {
  if (input.cutoffUnsafe) return "CUTOFF_UNSAFE";
  if (input.providerError) return "PROVIDER_ERROR";
  if (input.lineupStatus === "UNAVAILABLE") return "LINEUP_NOT_CONFIRMED";
  if (input.playerId == null) return "IDENTITY_MISSING";
  if (input.statsReady) return "READY";
  if (input.statsPartial) return "PARTIAL";
  if (input.lineupStatus === "EXPECTED") return "LINEUP_NOT_CONFIRMED";
  return "STATS_MISSING";
}

export async function buildBatterDatasetV0(
  input: BuildBatterDatasetInput,
): Promise<{ document: BatterDatasetDocument; predictionHash: string }> {
  const cwd = input.cwd ?? process.cwd();
  const allowNetwork = input.allowNetwork === true;
  const nowMs = input.nowMs ?? Date.now();
  const season = Number(input.dateKst.slice(0, 4));
  const sources =
    input.sources ??
    (await loadBatterDatasetSources({ dateKst: input.dateKst, cwd }));

  const usage = createCacheUsage();
  const games = sources.scheduleGames;
  const lineupRows = sources.lineupDoc?.rows ?? [];
  const fullyPregame = slateFullyPregame(
    games.map((g) => g.commenceTimeUtc),
    nowMs,
  );

  let reconstructionSafety: BatterReconstructionSafety = "PREGAME_SAFE";
  const metaNotes: string[] = [
    "Pregame batter intake. engineUseAllowed=false. predictionInputAllowed=false.",
    "Market/odds are not inputs. Independent model sample = 0.",
    "SAME_DAY_GAME_RESULT_EXCLUDED: statsThroughDate is the day before min(dateKst, officialDate).",
    "POST_GAME official lineups are never stored as pregame CONFIRMED.",
    "recentCondition/splits/sabermetrics are schema extension points only (null).",
  ];

  if (!fullyPregame) {
    reconstructionSafety = "NOT_BACKFILLABLE_V0";
    metaNotes.push(
      "Slate contains commenceTimeUtc in the past relative to build now. Network hitting fetches are blocked to prevent season-to-date leakage.",
    );
  }
  if (allowNetwork && !fullyPregame) {
    metaNotes.push("allowNetwork ignored because slate is not fully pregame.");
  }
  const networkOk = allowNetwork && fullyPregame;

  const uniqueIds = new Set<number>();
  let slotIdCount = 0;
  const sidePlan: Array<{
    game: ScheduleGame;
    home: ReturnType<typeof resolveSideSlots>;
    away: ReturnType<typeof resolveSideSlots>;
    statsThroughDate: string;
  }> = [];

  for (const game of games) {
    const home = resolveSideSlots({
      lineupRows,
      expected: sources.expectedObs,
      gamePk: game.gamePk,
      side: "home",
    });
    const away = resolveSideSlots({
      lineupRows,
      expected: sources.expectedObs,
      gamePk: game.gamePk,
      side: "away",
    });
    for (const slot of [...home.slots, ...away.slots]) {
      if (typeof slot.playerId === "number") {
        uniqueIds.add(slot.playerId);
        slotIdCount += 1;
      }
    }
    sidePlan.push({
      game,
      home,
      away,
      statsThroughDate: statsThroughDateForGame({
        dateKst: input.dateKst,
        officialDate: game.officialDate,
      }),
    });
  }

  const personById = new Map<number, PersonCache>();
  const hittingById = new Map<number, HittingCache>();
  let fetchesAttempted = 0;

  async function loadPerson(playerId: number): Promise<PersonCache> {
    const cached = personById.get(playerId);
    if (cached) {
      return cached;
    }
    fetchesAttempted += 1;
    const pathQuery = personPath(playerId);
    let payload: unknown | null = input.statLookup
      ? input.statLookup.person(playerId)
      : await tryReadCachedStatsJson(pathQuery, usage, cwd);
    if (payload == null && networkOk && !input.statLookup) {
      payload = await getRawStatsJson(pathQuery, usage, cwd);
    }
    if (payload == null) {
      const miss: PersonCache = {
        bats: "UNKNOWN",
        primaryPosition: null,
        fullName: null,
        ok: false,
      };
      personById.set(playerId, miss);
      return miss;
    }
    const parsed = batsFromPerson(payload);
    const hit: PersonCache = { ...parsed, ok: true };
    personById.set(playerId, hit);
    return hit;
  }

  async function loadHitting(playerId: number): Promise<HittingCache> {
    const cached = hittingById.get(playerId);
    if (cached) {
      return cached;
    }
    fetchesAttempted += 1;
    const pathQuery = hittingPath(playerId, season);
    let payload: unknown | null = input.statLookup
      ? input.statLookup.hittingGameLog(playerId)
      : await tryReadCachedStatsJson(pathQuery, usage, cwd);
    if (payload == null && networkOk && !input.statLookup) {
      try {
        payload = await getRawStatsJson(pathQuery, usage, cwd);
      } catch (err) {
        const fail: HittingCache = {
          splits: null,
          ok: false,
          error: err instanceof Error ? err.message : "provider error",
        };
        hittingById.set(playerId, fail);
        return fail;
      }
    }
    if (payload == null) {
      const miss: HittingCache = {
        splits: null,
        ok: false,
        error: networkOk ? "empty hitting payload" : "HITTING_GAMELOG_NOT_IN_CACHE",
      };
      hittingById.set(playerId, miss);
      return miss;
    }
    const hit: HittingCache = {
      splits: parseGameLogSplits(payload),
      ok: true,
      error: null,
    };
    hittingById.set(playerId, hit);
    return hit;
  }

  for (const playerId of [...uniqueIds].sort((a, b) => a - b)) {
    await loadPerson(playerId);
    await loadHitting(playerId);
  }

  if (
    reconstructionSafety !== "PREGAME_SAFE" &&
    uniqueIds.size > 0 &&
    [...hittingById.values()].every((h) => !h.ok)
  ) {
    reconstructionSafety = "NOT_BACKFILLABLE_V0";
    metaNotes.push(
      "Hitting gameLog was not in the pregame research cache. v0 does not backfill completed slates from live season aggregates.",
    );
  }

  const gameRows: BatterGameRow[] = [];

  const buildSide = (
    plan: (typeof sidePlan)[number],
    side: "home" | "away",
  ): BatterSideBlock => {
    const resolved = side === "home" ? plan.home : plan.away;
    const teamId = side === "home" ? plan.game.homeTeamId : plan.game.awayTeamId;
    const teamName = side === "home" ? plan.game.homeTeam : plan.game.awayTeam;
    const nine = mergeNine(resolved.slots, resolved.status);
    const batters: BatterSlotRow[] = nine.map((slot) => {
      const warnings = [...resolved.warnings];
      if (resolved.status !== "CONFIRMED") {
        warnings.push("LINEUP_NOT_CONFIRMED");
      }
      if (slot.playerId == null) {
        const slotWarnings = [...warnings];
        if (slot.playerName) slotWarnings.push("IDENTITY_MISSING_NO_PLAYER_ID");
        else slotWarnings.push("LINEUP_SLOT_EMPTY");
        if (slot.bats) slotWarnings.push("BATS_FROM_LINEUP_OBSERVATION");
        return {
          ...emptySlot(slot.battingOrder, resolved.status),
          playerName: slot.playerName,
          position: slot.position,
          bats: slot.bats ?? "UNKNOWN",
          lineupObservedAt: slot.lineupObservedAt,
          lineupSource: slot.lineupSource,
          rowStatus:
            resolved.status === "UNAVAILABLE"
              ? "LINEUP_NOT_CONFIRMED"
              : "IDENTITY_MISSING",
          statsThroughDate: plan.statsThroughDate,
          warnings: [...new Set(slotWarnings)],
        };
      }

      const person = personById.get(slot.playerId);
      const hitting = hittingById.get(slot.playerId);
      const bats: BatterBats = person?.bats ?? slot.bats ?? "UNKNOWN";
      if (!person?.ok) warnings.push("PEOPLE_CACHE_MISS");
      if (slot.bats && person?.ok && person.bats === "UNKNOWN") {
        warnings.push("BATS_FROM_LINEUP_OBSERVATION");
      }

      let cutoffUnsafe = false;
      let providerError = false;
      let statsReady = false;
      let statsPartial = false;
      let counting = emptyCounting();
      let rates = emptyRates();
      let sampleSize = emptySampleSize();
      let countingDerived = emptyDerived();
      let ratesDerived = emptyDerived();
      let latest: string | null = null;
      let statsSource: string | null = null;

      if (hitting?.error && hitting.error !== "HITTING_GAMELOG_NOT_IN_CACHE") {
        providerError = true;
        warnings.push(`PROVIDER_ERROR:${hitting.error}`);
      } else if (!hitting?.ok || hitting.splits == null) {
        warnings.push("STATS_MISSING_NO_SAFE_GAMELOG");
        if (reconstructionSafety !== "PREGAME_SAFE") {
          warnings.push("NOT_BACKFILLABLE_V0");
        }
      } else {
        const filtered = filterHittingGameLogAsOf({
          splits: hitting.splits,
          targetGamePk: plan.game.gamePk,
          statsThroughDate: plan.statsThroughDate,
        });
        if (filtered.excludedTarget > 0) {
          warnings.push("TARGET_GAME_EXCLUDED_FROM_STATS");
        }
        if (filtered.excludedSameDayOrLater > 0) {
          warnings.push("SAME_DAY_OR_LATER_EXCLUDED");
        }
        const agg = aggregateHittingFromGameLog(filtered.kept);
        counting = agg.counting;
        rates = agg.rates;
        sampleSize = agg.sampleSize;
        countingDerived = agg.countingDerived;
        ratesDerived = agg.ratesDerived;
        latest = latestIncludedGameDate(filtered.kept);
        statsSource =
          "mlb-stats-api:/people/{id}/stats?stats=gameLog&group=hitting (cutoff-filtered)";
        if (filtered.kept.length === 0) {
          warnings.push("STATS_MISSING_EMPTY_AFTER_CUTOFF");
        } else if (
          counting.plateAppearances == null ||
          counting.atBats == null ||
          rates.avg == null
        ) {
          statsPartial = true;
          warnings.push("PARTIAL_COUNTING_OR_RATES");
        } else {
          statsReady = true;
        }
      }

      if (bats === "UNKNOWN") {
        statsPartial = statsReady || statsPartial;
        if (statsReady) {
          statsReady = false;
          statsPartial = true;
        }
        warnings.push("BATS_UNKNOWN");
      }

      const rowStatus = chooseRowStatus({
        lineupStatus: resolved.status,
        playerId: slot.playerId,
        statsReady,
        statsPartial,
        cutoffUnsafe,
        providerError,
      });

      return {
        battingOrder: slot.battingOrder,
        playerId: slot.playerId,
        playerName: person?.fullName ?? slot.playerName,
        position: slot.position,
        bats,
        primaryPosition: person?.primaryPosition ?? null,
        lineupStatus: resolved.status,
        lineupObservedAt: slot.lineupObservedAt,
        lineupSource: slot.lineupSource,
        rowStatus,
        sampleSize,
        counting,
        rates,
        countingDerived,
        ratesDerived,
        statsThroughDate: plan.statsThroughDate,
        latestIncludedGameDate: latest,
        statsSource,
        recentCondition: null,
        splits: null,
        advanced: null,
        warnings: [...new Set(warnings)],
      };
    });

    return {
      teamId,
      teamName,
      lineupStatus: resolved.status,
      batters,
    };
  };

  for (const plan of sidePlan) {
    const home = buildSide(plan, "home");
    const away = buildSide(plan, "away");
    const gameWarnings = [...plan.home.warnings, ...plan.away.warnings];
    if (plan.home.status !== "CONFIRMED" || plan.away.status !== "CONFIRMED") {
      gameWarnings.push("GAME_LINEUP_NOT_FULLY_CONFIRMED");
    }
    gameRows.push({
      schemaVersion: BATTER_SCHEMA_VERSION,
      builderVersion: BATTER_BUILDER_VERSION,
      gameId: plan.game.gameId,
      gamePk: plan.game.gamePk,
      commenceTimeUtc: plan.game.commenceTimeUtc,
      officialDate: plan.game.officialDate,
      capturedAt: input.generatedAt,
      cutoffStatus: reconstructionSafety,
      statsThroughDate: plan.statsThroughDate,
      home,
      away,
      warnings: [...new Set(gameWarnings)],
      researchOnly: true,
      engineUseAllowed: false,
      predictionInputAllowed: false,
    });
  }

  const allSlots = gameRows.flatMap((g) => [...g.home.batters, ...g.away.batters]);
  const summary = {
    totalGames: gameRows.length,
    confirmedGames: gameRows.filter(
      (g) => g.home.lineupStatus === "CONFIRMED" && g.away.lineupStatus === "CONFIRMED",
    ).length,
    expectedOnlyGames: gameRows.filter(
      (g) =>
        (g.home.lineupStatus === "EXPECTED" || g.away.lineupStatus === "EXPECTED") &&
        g.home.lineupStatus !== "CONFIRMED" &&
        g.away.lineupStatus !== "CONFIRMED",
    ).length,
    unavailableGames: gameRows.filter(
      (g) =>
        g.home.lineupStatus === "UNAVAILABLE" && g.away.lineupStatus === "UNAVAILABLE",
    ).length,
    totalBatterSlots: allSlots.length,
    joinedPlayerIds: allSlots.filter((s) => s.playerId != null).length,
    batsResolved: allSlots.filter((s) => s.bats !== "UNKNOWN").length,
    statsReady: allSlots.filter((s) => s.rowStatus === "READY").length,
    partial: allSlots.filter((s) => s.rowStatus === "PARTIAL").length,
    blocked: allSlots.filter((s) =>
      ["CUTOFF_UNSAFE", "PROVIDER_ERROR"].includes(s.rowStatus),
    ).length,
    identityMissing: allSlots.filter((s) => s.rowStatus === "IDENTITY_MISSING").length,
    statsMissing: allSlots.filter((s) => s.rowStatus === "STATS_MISSING").length,
    cutoffUnsafe: allSlots.filter((s) => s.rowStatus === "CUTOFF_UNSAFE").length,
    providerError: allSlots.filter((s) => s.rowStatus === "PROVIDER_ERROR").length,
  };

  const inputHashSha256 = sha256Json({
    dateKst: input.dateKst,
    sourceArtifactHashes: sources.sourceArtifactHashes,
    leakagePolicy: "SAME_DAY_GAME_RESULT_EXCLUDED",
    allowNetwork: networkOk,
  });

  const documentWithoutHash: Omit<BatterDatasetDocument, "meta"> & {
    meta: Omit<BatterDatasetDocument["meta"], "datasetHashSha256"> & {
      datasetHashSha256: "";
    };
  } = {
    meta: {
      datasetId: BATTER_DATASET_ID,
      schemaVersion: BATTER_SCHEMA_VERSION,
      builderVersion: BATTER_BUILDER_VERSION,
      dateKst: input.dateKst,
      generatedAt: input.generatedAt,
      capturedAt: input.generatedAt,
      researchOnly: true,
      engineUseAllowed: false,
      predictionInputAllowed: false,
      engineAdmission: "PROHIBITED",
      independentModelSample: 0,
      marketDataAllowed: false,
      koreanMarketInput: false,
      overseasMarketInput: false,
      provider: "mlb-stats-api",
      leakagePolicy: "SAME_DAY_GAME_RESULT_EXCLUDED",
      reconstructionSafety,
      allowNetwork: networkOk,
      networkCalls: usage.networkCalls,
      uniquePlayerIds: uniqueIds.size,
      providerFetchesAttempted: fetchesAttempted,
      providerFetchesDeduped: Math.max(0, slotIdCount - uniqueIds.size),
      deterministic: true,
      sourceArtifacts: sources.sourceArtifacts,
      sourceArtifactHashes: sources.sourceArtifactHashes,
      predictionHashSha256: sources.predictionHashSha256,
      predictionUnchanged: true,
      inputHashSha256,
      datasetHashSha256: "",
      notes: metaNotes,
    },
    cacheUsage: usage,
    summary,
    games: gameRows,
  };

  const datasetHashSha256 = sha256Json(documentWithoutHash);
  const document: BatterDatasetDocument = {
    ...documentWithoutHash,
    meta: {
      ...documentWithoutHash.meta,
      datasetHashSha256,
    },
  };

  return { document, predictionHash: sources.predictionHashSha256 };
}

export function assertBatterDatasetIntegrity(
  doc: BatterDatasetDocument,
): string[] {
  const errors: string[] = [];
  if (doc.meta.engineUseAllowed !== false) errors.push("engineUseAllowed");
  if (doc.meta.predictionInputAllowed !== false) {
    errors.push("predictionInputAllowed");
  }
  if (doc.meta.marketDataAllowed !== false) errors.push("marketDataAllowed");
  if (doc.meta.independentModelSample !== 0) {
    errors.push("independentModelSample");
  }
  if (doc.meta.koreanMarketInput !== false) errors.push("koreanMarketInput");
  if (doc.meta.overseasMarketInput !== false) errors.push("overseasMarketInput");
  const blob = JSON.stringify(doc);
  if (/marketProbability|openingOdds|latestOdds|marketPrior/i.test(blob)) {
    errors.push("market_fields_present");
  }
  for (const game of doc.games) {
    if (game.home.batters.length !== 9 || game.away.batters.length !== 9) {
      errors.push(`${game.gameId}: slot count`);
    }
    const orders = game.home.batters.map((b) => b.battingOrder).join(",");
    if (orders !== "1,2,3,4,5,6,7,8,9") {
      errors.push(`${game.gameId}: home order`);
    }
    if (game.cutoffStatus === "PREGAME_SAFE") {
      for (const slot of [...game.home.batters, ...game.away.batters]) {
        if (
          slot.latestIncludedGameDate &&
          game.statsThroughDate &&
          slot.latestIncludedGameDate > game.statsThroughDate
        ) {
          errors.push(`${game.gameId}: leakage ${slot.playerId}`);
        }
      }
    }
  }
  return errors;
}
