/**
 * Per-game incremental batter pregame capture.
 * Write-once under data/research/mlb/batter-pregame/{date}/games/{gamePk}.json
 *
 * Does not rewrite sealed files. Does not write daily batter-dataset-v0.json.
 * Prediction / Engine / Market: unused.
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractSideFromBoxscore } from "../build-lineup-dataset";
import {
  filterHittingGameLogAsOf,
  latestIncludedGameDate,
  statsThroughDateForGame,
} from "../batter-dataset-v0/cutoff";
import { sha256Json } from "../batter-dataset-v0/hash";
import {
  aggregateHittingFromGameLog,
  batsFromPerson,
  parseGameLogSplits,
} from "../batter-dataset-v0/hitting";
import {
  createCacheUsage,
  getRawStatsJson,
  type CacheUsageStats,
} from "../research-stats-cache";
import {
  mlbBatterPregameGameAbs,
  mlbBatterPregameGameRel,
  mlbLineupSnapshotRel,
} from "./paths";
import type {
  BatterPregameGameCaptureV1,
  BatterPregameSlotV1,
  LineupRawSnapshotV1,
  LineupRefreshTemporalProof,
} from "./types";
import { BATTER_PREGAME_GAME_SCHEMA } from "./types";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

async function fileExists(abs: string): Promise<boolean> {
  try {
    await access(abs);
    return true;
  } catch {
    return false;
  }
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

function hittingPath(playerId: number, season: number): string {
  return `/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=${season}&sportId=1`;
}

function personPath(playerId: number): string {
  return `/api/v1/people/${playerId}`;
}

function emptySlot(
  battingOrder: number,
  statsThroughDate: string,
  extra: Partial<BatterPregameSlotV1> = {},
): BatterPregameSlotV1 {
  return {
    battingOrder,
    playerId: extra.playerId ?? null,
    playerName: extra.playerName ?? null,
    position: extra.position ?? null,
    bats: extra.bats ?? "UNKNOWN",
    statsThroughDate,
    statsSource: extra.statsSource ?? null,
    latestIncludedGameDate: extra.latestIncludedGameDate ?? null,
    counting: extra.counting ?? {
      gamesPlayed: null,
      plateAppearances: null,
      atBats: null,
      hits: null,
      homeRuns: null,
    },
    rates: extra.rates ?? {
      avg: null,
      obp: null,
      slg: null,
      ops: null,
    },
    warnings: extra.warnings ?? ["LINEUP_SLOT_EMPTY"],
  };
}

function nineFromBoxscoreSide(
  teamRaw: unknown,
  statsThroughDate: string,
): { teamName: string | null; batters: BatterPregameSlotV1[] } {
  const extracted = extractSideFromBoxscore(teamRaw);
  const bySlot = new Map(extracted.starters.map((s) => [s.slot, s]));
  const batters = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((slot) => {
    const s = bySlot.get(slot);
    if (!s) return emptySlot(slot, statsThroughDate);
    return emptySlot(slot, statsThroughDate, {
      playerId: s.playerId,
      playerName: s.playerName,
      position: s.defensivePosition,
      warnings: [],
    });
  });
  return { teamName: extracted.teamName, batters };
}

export type BatterPregameStatLookup = {
  person: (playerId: number) => unknown | null;
  hittingGameLog: (playerId: number) => unknown | null;
};

export type CaptureBatterPregameGameInput = {
  dateKst: string;
  gamePk: number;
  internalGameId: string | null;
  cutoffTime: string;
  officialDate: string | null;
  snapshot: LineupRawSnapshotV1;
  cwd?: string;
  nowMs?: number;
  allowNetwork?: boolean;
  cacheOnly?: boolean;
  statLookup?: BatterPregameStatLookup;
};

export type CaptureBatterPregameGameResult =
  | { status: "SKIPPED_SEALED"; abs: string; rel: string }
  | {
      status: "WRITTEN";
      abs: string;
      rel: string;
      capture: BatterPregameGameCaptureV1;
    };

export async function captureBatterPregameGameIfEligible(
  input: CaptureBatterPregameGameInput,
): Promise<CaptureBatterPregameGameResult> {
  const cwd = input.cwd ?? process.cwd();
  const abs = mlbBatterPregameGameAbs(input.dateKst, input.gamePk, cwd);
  const rel = mlbBatterPregameGameRel(input.dateKst, input.gamePk);
  if (await fileExists(abs)) {
    return { status: "SKIPPED_SEALED", abs, rel };
  }

  const snap = input.snapshot;
  const temporalProof: Exclude<LineupRefreshTemporalProof, "NONE"> =
    snap.temporalProof === "SOURCE_TIMESTAMP" ||
    snap.temporalProof === "CAPTURE_TIMESTAMP"
      ? snap.temporalProof
      : "CAPTURE_TIMESTAMP";
  const capturedAt = snap.capturedAt || snap.fetchedAt;
  const cutoffMs = Date.parse(input.cutoffTime);
  const capturedMs = Date.parse(capturedAt);
  const capturedBeforeGame =
    Number.isFinite(cutoffMs) &&
    Number.isFinite(capturedMs) &&
    capturedMs < cutoffMs;

  const statsThroughDate = statsThroughDateForGame({
    dateKst: input.dateKst,
    officialDate: input.officialDate,
  });
  const teams = asRecord(asRecord(snap.body)?.teams);
  const home = nineFromBoxscoreSide(teams?.home, statsThroughDate);
  const away = nineFromBoxscoreSide(teams?.away, statsThroughDate);

  const usage = createCacheUsage();
  const season = Number(input.dateKst.slice(0, 4));
  const personById = new Map<
    number,
    ReturnType<typeof batsFromPerson> & { ok: boolean }
  >();
  const hittingById = new Map<
    number,
    { splits: ReturnType<typeof parseGameLogSplits> | null; ok: boolean }
  >();

  const playerIds = [
    ...home.batters.map((b) => b.playerId),
    ...away.batters.map((b) => b.playerId),
  ].filter((id): id is number => typeof id === "number");
  const uniqueIds = [...new Set(playerIds)].sort((a, b) => a - b);

  async function loadPerson(playerId: number) {
    if (personById.has(playerId)) return;
    let payload: unknown | null = input.statLookup
      ? input.statLookup.person(playerId)
      : await tryReadCachedStatsJson(personPath(playerId), usage, cwd);
    if (payload == null && input.allowNetwork === true && !input.statLookup) {
      try {
        payload = await getRawStatsJson(personPath(playerId), usage, {
          cwd,
          cacheOnly: input.cacheOnly === true,
        });
      } catch {
        payload = null;
      }
    }
    if (payload == null) {
      personById.set(playerId, {
        bats: "UNKNOWN",
        primaryPosition: null,
        fullName: null,
        ok: false,
      });
      return;
    }
    personById.set(playerId, { ...batsFromPerson(payload), ok: true });
  }

  async function loadHitting(playerId: number) {
    if (hittingById.has(playerId)) return;
    let payload: unknown | null = input.statLookup
      ? input.statLookup.hittingGameLog(playerId)
      : await tryReadCachedStatsJson(hittingPath(playerId, season), usage, cwd);
    if (payload == null && input.allowNetwork === true && !input.statLookup) {
      try {
        payload = await getRawStatsJson(hittingPath(playerId, season), usage, {
          cwd,
          cacheOnly: input.cacheOnly === true,
        });
      } catch {
        payload = null;
      }
    }
    if (payload == null) {
      hittingById.set(playerId, { splits: null, ok: false });
      return;
    }
    hittingById.set(playerId, {
      splits: parseGameLogSplits(payload),
      ok: true,
    });
  }

  for (const id of uniqueIds) {
    await loadPerson(id);
    await loadHitting(id);
  }

  function enrich(slot: BatterPregameSlotV1): BatterPregameSlotV1 {
    if (slot.playerId == null) return slot;
    const person = personById.get(slot.playerId);
    const hitting = hittingById.get(slot.playerId);
    const warnings = [...slot.warnings];
    const bats = person?.bats ?? "UNKNOWN";
    if (!person?.ok) warnings.push("PEOPLE_CACHE_MISS");
    let statsSource: string | null = null;
    let latest: string | null = null;
    let counting = slot.counting;
    let rates = slot.rates;
    if (!hitting?.ok || hitting.splits == null) {
      warnings.push("STATS_MISSING_NO_SAFE_GAMELOG");
    } else {
      const filtered = filterHittingGameLogAsOf({
        splits: hitting.splits,
        targetGamePk: input.gamePk,
        statsThroughDate,
      });
      if (filtered.excludedTarget > 0) {
        warnings.push("TARGET_GAME_EXCLUDED_FROM_STATS");
      }
      if (filtered.excludedSameDayOrLater > 0) {
        warnings.push("SAME_DAY_OR_LATER_EXCLUDED");
      }
      const agg = aggregateHittingFromGameLog(filtered.kept);
      counting = {
        gamesPlayed: agg.counting.gamesPlayed,
        plateAppearances: agg.counting.plateAppearances,
        atBats: agg.counting.atBats,
        hits: agg.counting.hits,
        homeRuns: agg.counting.homeRuns,
      };
      rates = {
        avg: agg.rates.avg,
        obp: agg.rates.obp,
        slg: agg.rates.slg,
        ops: agg.rates.ops,
      };
      latest = latestIncludedGameDate(filtered.kept);
      statsSource =
        "mlb-stats-api:/people/{id}/stats?stats=gameLog&group=hitting (cutoff-filtered)";
      if (filtered.kept.length === 0) {
        warnings.push("STATS_MISSING_EMPTY_AFTER_CUTOFF");
      }
    }
    return {
      ...slot,
      playerName: person?.fullName ?? slot.playerName,
      bats,
      statsSource,
      latestIncludedGameDate: latest,
      counting,
      rates,
      warnings: [...new Set(warnings)],
    };
  }

  const homeBatters = home.batters.map(enrich);
  const awayBatters = away.batters.map(enrich);

  const withoutHash = {
    schemaVersion: BATTER_PREGAME_GAME_SCHEMA,
    dateKst: input.dateKst,
    gamePk: input.gamePk,
    internalGameId: input.internalGameId,
    captureId: snap.observationId || snap.payloadHash,
    lineupObservationId: snap.observationId,
    lineupSnapshotRel: mlbLineupSnapshotRel(
      input.dateKst,
      input.gamePk,
      snap.observationId,
    ),
    lineupPayloadHash: snap.payloadHash,
    sourceTimestamp: snap.sourceTimestamp,
    capturedAt,
    cutoffTime: input.cutoffTime,
    statsThroughDate,
    capturedBeforeGame,
    collectionPhase: "PRE_GAME" as const,
    collectionStatus: "CONFIRMED" as const,
    temporalProof,
    playerIds: uniqueIds,
    home: { teamName: home.teamName, batters: homeBatters },
    away: { teamName: away.teamName, batters: awayBatters },
    hash: "",
    researchOnly: true as const,
    engineUseAllowed: false as const,
    predictionInputAllowed: false as const,
    engineAdmission: "PROHIBITED" as const,
    marketDataAllowed: false as const,
    koreanMarketInput: false as const,
    overseasMarketInput: false as const,
    independentModelSample: 0 as const,
  };

  const hash = sha256Json({ ...withoutHash, hash: "" });
  const capture: BatterPregameGameCaptureV1 = { ...withoutHash, hash };

  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(capture, null, 2)}\n`, "utf8");
  return { status: "WRITTEN", abs, rel, capture };
}

export async function batterPregameGameExists(
  dateKst: string,
  gamePk: number,
  cwd = process.cwd(),
): Promise<boolean> {
  return fileExists(mlbBatterPregameGameAbs(dateKst, gamePk, cwd));
}
