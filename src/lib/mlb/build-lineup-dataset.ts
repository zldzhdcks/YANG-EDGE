/**
 * MLB Lineup Dataset v1 builder — Schedule-first independent intake.
 *
 * - Schedule artifact is the sole game-list source
 * - Official lineups from MLB Stats API boxscore and/or schedule hydrate=lineups
 * - Never invents projected lineups; never reads Prediction Snapshot
 * - Engine admission PROHIBITED
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { instantToKst } from "../datetime/kst";
import { loadMlbScheduleArtifact } from "./build-mlb-schedule-artifact";
import { EMPTY_PREDICTION_HASH } from "./load-mlb-schedule-targets";
import type { MlbScheduleArtifactGame } from "./mlb-schedule-artifact-types";
import {
  createCacheUsage,
  getRawStatsJson,
  type CacheUsageStats,
} from "./research-stats-cache";
import {
  LINEUP_BUILDER_VERSION,
  LINEUP_DATASET_ID,
  LINEUP_SCHEMA_VERSION,
  type LineupBatterRow,
  type LineupCollectionPhase,
  type LineupCollectionStatus,
  type LineupDatasetDocument,
  type LineupDatasetRow,
  type LineupSide,
  type LineupStatus,
  type LineupSubstituteRow,
} from "./lineup-dataset-types";

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

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortKeys(obj[key]);
  }
  return out;
}

const STARTER_ORDER_RE = /^[1-9]00$/;

type GameTarget = {
  gameId: string;
  gamePk: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  startTimeKst: string | null;
  cutoffTime: string | null;
  statusAbstract: string;
};

async function resolveScheduleTargets(
  dateKst: string,
): Promise<{ targets: GameTarget[]; scheduleSource: string }> {
  const schedule = await loadMlbScheduleArtifact(dateKst);
  const scheduleSource = `data/research/mlb/${dateKst}-schedule-v1.json`;
  const targets: GameTarget[] = schedule.games.map(
    (g: MlbScheduleArtifactGame) => ({
      gameId: g.internalGameId,
      gamePk: g.gamePk,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      startTimeKst: g.startTimeKst,
      cutoffTime: g.commenceTimeUtc,
      statusAbstract: g.statusAbstract,
    }),
  );
  return {
    targets: targets.sort((a, b) => a.gamePk - b.gamePk),
    scheduleSource,
  };
}

type ExtractedSide = {
  teamId: number;
  teamName: string;
  starters: LineupBatterRow[];
  substitutes: LineupSubstituteRow[];
  lineupStatus: LineupStatus;
  warnings: string[];
  missingFields: string[];
  slotDuplicates: number;
  slotMissing: number;
  startersMarkedSubstitute: number;
};

function emptyExtractedSide(
  teamId: number,
  teamName: string,
  warning: string,
): ExtractedSide {
  return {
    teamId,
    teamName,
    starters: [],
    substitutes: [],
    lineupStatus: "INCOMPLETE",
    warnings: [warning],
    missingFields: [
      "battingSide",
      "preGameLineupSnapshot",
      "battingOrder",
    ],
    slotDuplicates: 0,
    slotMissing: 9,
    startersMarkedSubstitute: 0,
  };
}

function finalizeExtractedSide(
  teamId: number,
  teamName: string,
  starters: LineupBatterRow[],
  substitutes: LineupSubstituteRow[],
  warnings: string[],
  startersMarkedSubstitute: number,
): ExtractedSide {
  starters.sort((a, b) => a.slot - b.slot);
  substitutes.sort((a, b) => {
    const sa = a.slot ?? 99;
    const sb = b.slot ?? 99;
    if (sa !== sb) return sa - sb;
    return a.battingOrderCode.localeCompare(b.battingOrderCode);
  });

  const slotCounts = new Map<number, number>();
  for (const s of starters) {
    slotCounts.set(s.slot, (slotCounts.get(s.slot) ?? 0) + 1);
  }
  let slotDuplicates = 0;
  let slotMissing = 0;
  for (let slot = 1; slot <= 9; slot += 1) {
    const n = slotCounts.get(slot) ?? 0;
    if (n === 0) {
      slotMissing += 1;
      warnings.push(`BATTING_SLOT_MISSING:${slot}`);
    } else if (n > 1) {
      slotDuplicates += n - 1;
      warnings.push(`BATTING_SLOT_DUPLICATE:${slot}:count=${n}`);
    }
  }

  const missingFields = ["battingSide", "preGameLineupSnapshot"];
  let lineupStatus: LineupStatus = "COMPLETE";
  if (
    starters.length !== 9 ||
    slotMissing > 0 ||
    slotDuplicates > 0 ||
    startersMarkedSubstitute > 0
  ) {
    lineupStatus = "INCOMPLETE";
    if (starters.length !== 9) {
      warnings.push(`STARTER_COUNT_${starters.length}_EXPECTED_9`);
    }
    if (starters.length === 0) {
      missingFields.push("battingOrder");
    }
  }

  return {
    teamId,
    teamName,
    starters,
    substitutes,
    lineupStatus,
    warnings,
    missingFields,
    slotDuplicates,
    slotMissing,
    startersMarkedSubstitute,
  };
}

function extractSideFromBoxscore(teamRaw: unknown): ExtractedSide {
  const team = asRecord(teamRaw);
  const teamInfo = asRecord(team?.team);
  const teamId = asNumber(teamInfo?.id) ?? -1;
  const teamName = asString(teamInfo?.name) ?? "UNKNOWN";
  const players = asRecord(team?.players) ?? {};

  const starters: LineupBatterRow[] = [];
  const substitutes: LineupSubstituteRow[] = [];
  const warnings: string[] = [];
  let startersMarkedSubstitute = 0;

  for (const plRaw of Object.values(players)) {
    const pl = asRecord(plRaw);
    if (!pl) continue;
    const person = asRecord(pl.person);
    const playerId = asNumber(person?.id);
    const playerName = asString(person?.fullName) ?? "UNKNOWN";
    if (playerId == null) continue;

    const battingOrderCode =
      pl.battingOrder != null ? String(pl.battingOrder) : null;
    if (battingOrderCode == null) continue;

    const pos = asRecord(pl.position);
    const defensivePosition = asString(pos?.abbreviation);
    const gs = asRecord(pl.gameStatus);
    const isSubstitute = gs?.isSubstitute === true;

    if (STARTER_ORDER_RE.test(battingOrderCode)) {
      const slot = Number(battingOrderCode[0]);
      if (isSubstitute) {
        startersMarkedSubstitute += 1;
        warnings.push(
          `STARTER_SLOT_MARKED_SUBSTITUTE:${slot}:${playerId}`,
        );
        continue;
      }
      starters.push({
        slot,
        playerId,
        playerName,
        defensivePosition,
        isDh: defensivePosition === "DH",
        isSubstitute: false,
      });
      continue;
    }

    const slotDigit = Number(battingOrderCode[0]);
    substitutes.push({
      slot: Number.isFinite(slotDigit) ? slotDigit : null,
      playerId,
      playerName,
      defensivePosition,
      battingOrderCode,
      isSubstitute: true,
    });
  }

  return finalizeExtractedSide(
    teamId,
    teamName,
    starters,
    substitutes,
    warnings,
    startersMarkedSubstitute,
  );
}

function extractSideFromSchedulePlayers(
  playersRaw: unknown[],
  teamId: number,
  teamName: string,
): ExtractedSide {
  const starters: LineupBatterRow[] = [];
  const substitutes: LineupSubstituteRow[] = [];
  const warnings: string[] = [];
  let startersMarkedSubstitute = 0;

  for (const raw of playersRaw) {
    const pl = asRecord(raw);
    if (!pl) continue;
    const person = asRecord(pl.person);
    const playerId = asNumber(person?.id);
    const playerName = asString(person?.fullName) ?? "UNKNOWN";
    if (playerId == null) continue;

    const gs = asRecord(pl.gameStatus);
    const isSubstitute = gs?.isSubstitute === true;
    const battingOrderCode =
      pl.battingOrder != null ? String(pl.battingOrder) : null;
    if (battingOrderCode == null) continue;

    const pos = asRecord(pl.position);
    const defensivePosition = asString(pos?.abbreviation);

    if (STARTER_ORDER_RE.test(battingOrderCode)) {
      const slot = Number(battingOrderCode[0]);
      if (isSubstitute) {
        startersMarkedSubstitute += 1;
        warnings.push(
          `STARTER_SLOT_MARKED_SUBSTITUTE:${slot}:${playerId}`,
        );
        continue;
      }
      starters.push({
        slot,
        playerId,
        playerName,
        defensivePosition,
        isDh: defensivePosition === "DH",
        isSubstitute: false,
      });
      continue;
    }

    const slotDigit = Number(battingOrderCode[0]);
    substitutes.push({
      slot: Number.isFinite(slotDigit) ? slotDigit : null,
      playerId,
      playerName,
      defensivePosition,
      battingOrderCode,
      isSubstitute: true,
    });
  }

  return finalizeExtractedSide(
    teamId,
    teamName,
    starters,
    substitutes,
    warnings,
    startersMarkedSubstitute,
  );
}

type ScheduleLineupRef = {
  gamePk: number;
  abstractState: string | null;
  detailedState: string | null;
  homePlayers: unknown[];
  awayPlayers: unknown[];
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeTeamName: string;
  awayTeamName: string;
  sourceFetchedAt: string | null;
};

function usScheduleDateFromInstant(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

async function loadScheduleLineupsByPk(
  targets: GameTarget[],
  usage: CacheUsageStats,
): Promise<Map<number, ScheduleLineupRef>> {
  const usDates = new Set<string>();
  for (const t of targets) {
    if (t.cutoffTime) usDates.add(usScheduleDateFromInstant(t.cutoffTime));
  }

  const byPk = new Map<number, ScheduleLineupRef>();
  for (const usDate of [...usDates].sort()) {
    const hydrate = encodeURIComponent("probablePitcher,lineups");
    const pathQuery = `/api/v1/schedule?sportId=1&date=${encodeURIComponent(usDate)}&hydrate=${hydrate}`;
    let body: unknown;
    let fetchedAt: string | null = null;
    try {
      body = await getRawStatsJson(pathQuery, usage);
      const cachePath = path.join(
        process.cwd(),
        "data/cache/research/mlb/raw/statsapi",
        `api_v1_schedule_sportId_1_date_${usDate}_hydrate_probablePitcher_2Clineups.json`,
      );
      try {
        const cached = JSON.parse(await readFile(cachePath, "utf8")) as {
          meta?: { fetchedAt?: string };
        };
        fetchedAt = asString(cached.meta?.fetchedAt);
      } catch {
        fetchedAt = new Date().toISOString();
      }
    } catch {
      continue;
    }

    const root = asRecord(body);
    const dates = Array.isArray(root?.dates) ? root.dates : [];
    for (const day of dates) {
      const games = Array.isArray(asRecord(day)?.games)
        ? (asRecord(day)!.games as unknown[])
        : [];
      for (const raw of games) {
        const row = asRecord(raw);
        if (!row) continue;
        const gamePk = asNumber(row.gamePk);
        if (gamePk == null) continue;
        const teams = asRecord(row.teams);
        const home = asRecord(teams?.home);
        const away = asRecord(teams?.away);
        const status = asRecord(row.status);
        const lineups = asRecord(row.lineups);
        byPk.set(gamePk, {
          gamePk,
          abstractState: asString(status?.abstractGameState),
          detailedState: asString(status?.detailedState),
          homePlayers: Array.isArray(lineups?.homePlayers)
            ? lineups.homePlayers
            : [],
          awayPlayers: Array.isArray(lineups?.awayPlayers)
            ? lineups.awayPlayers
            : [],
          homeTeamId: asNumber(asRecord(home?.team)?.id),
          awayTeamId: asNumber(asRecord(away?.team)?.id),
          homeTeamName: asString(asRecord(home?.team)?.name) ?? "",
          awayTeamName: asString(asRecord(away?.team)?.name) ?? "",
          sourceFetchedAt: fetchedAt,
        });
      }
    }
  }
  return byPk;
}

async function readBoxscoreFetchedAt(
  gamePk: number,
): Promise<string | null> {
  const file = path.join(
    process.cwd(),
    "data/cache/research/mlb/raw/statsapi/api/v1/game",
    String(gamePk),
    "boxscore.json",
  );
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as {
      meta?: { fetchedAt?: string };
    };
    return asString(raw.meta?.fetchedAt);
  } catch {
    return null;
  }
}

function isFinalOrLive(abstract: string | null | undefined): boolean {
  const a = (abstract ?? "").toLowerCase();
  return a === "final" || a === "live";
}

function isPreview(abstract: string | null | undefined): boolean {
  const a = (abstract ?? "").toLowerCase();
  return a === "preview" || a === "" || a === "scheduled";
}

function hashableRowBody(row: LineupDatasetRow): unknown {
  return {
    schemaVersion: row.schemaVersion,
    builderVersion: row.builderVersion,
    gameDate: row.gameDate,
    gameId: row.gameId,
    gamePk: row.gamePk,
    teamId: row.teamId,
    teamName: row.teamName,
    opponentTeamId: row.opponentTeamId,
    opponentTeamName: row.opponentTeamName,
    side: row.side,
    lineupType: row.lineupType,
    collectionPhase: row.collectionPhase,
    collectionStatus: row.collectionStatus ?? null,
    reason: row.reason ?? null,
    confirmed: row.confirmed ?? null,
    lineupSource: row.lineupSource ?? null,
    preGameStatus: row.preGameStatus,
    sourceTimestamp: row.sourceTimestamp,
    cutoffTime: row.cutoffTime,
    lineupStatus: row.lineupStatus,
    battingOrder: row.battingOrder,
    substitutes: row.substitutes,
    missingFields: row.missingFields,
    warnings: row.warnings,
    researchOnly: row.researchOnly,
    legalStatus: row.legalStatus,
    engineUseAllowed: row.engineUseAllowed,
  };
}

function buildTeamRow(args: {
  generatedAt: string;
  dateKst: string;
  game: GameTarget;
  side: LineupSide;
  extracted: ExtractedSide;
  opponent: ExtractedSide;
  sourceTimestamp: string | null;
  collectionStatus: LineupCollectionStatus;
  reason: string;
  confirmed: boolean;
  lineupSource: string | null;
  collectionPhase: LineupCollectionPhase;
}): LineupDatasetRow {
  const inputHash = sha256(
    stableStringify({
      gamePk: args.game.gamePk,
      side: args.side,
      sourceTimestamp: args.sourceTimestamp,
      collectionStatus: args.collectionStatus,
      lineupSource: args.lineupSource,
      starterIds: args.extracted.starters.map((s) => [s.slot, s.playerId]),
      substituteIds: args.extracted.substitutes.map((s) => [
        s.battingOrderCode,
        s.playerId,
      ]),
    }),
  );

  const draft: LineupDatasetRow = {
    schemaVersion: LINEUP_SCHEMA_VERSION,
    builderVersion: LINEUP_BUILDER_VERSION,
    generatedAt: args.generatedAt,
    gameDate: args.dateKst,
    gameId: args.game.gameId,
    internalGameId: args.game.gameId,
    gamePk: args.game.gamePk,
    teamId: args.extracted.teamId,
    teamName: args.extracted.teamName,
    opponentTeamId: args.opponent.teamId,
    opponentTeamName: args.opponent.teamName,
    side: args.side,
    startTimeKst: args.game.startTimeKst,
    lineupType: "ACTUAL_STARTING",
    collectionPhase: args.collectionPhase,
    preGameStatus: "NOT_COLLECTED",
    collectionStatus: args.collectionStatus,
    reason: args.reason,
    confirmed: args.confirmed,
    lineupSource: args.lineupSource,
    sourceTimestamp: args.sourceTimestamp,
    cutoffTime: args.game.cutoffTime,
    lineupStatus: args.extracted.lineupStatus,
    battingOrder: args.extracted.starters,
    substitutes: args.extracted.substitutes,
    missingFields: args.extracted.missingFields,
    warnings: [
      ...args.extracted.warnings,
      `COLLECTION_STATUS=${args.collectionStatus}`,
      `SCHEDULE_FIRST_LINEUP_INTAKE_V1`,
    ],
    researchOnly: true,
    legalStatus: "INTERNAL_RESEARCH_ONLY",
    engineUseAllowed: false,
    inputHash,
    resultHash: "",
  };
  draft.resultHash = sha256(stableStringify(hashableRowBody(draft)));
  return draft;
}

function resolveGameStatus(
  home: ExtractedSide,
  away: ExtractedSide,
  opts: {
    abstractState: string | null;
    usedBoxscore: boolean;
    usedScheduleLineups: boolean;
    providerError: string | null;
  },
): {
  collectionStatus: LineupCollectionStatus;
  reason: string;
  confirmed: boolean;
  collectionPhase: LineupCollectionPhase;
  lineupSource: string | null;
} {
  if (opts.providerError) {
    return {
      collectionStatus: "PROVIDER_ERROR",
      reason: opts.providerError,
      confirmed: false,
      collectionPhase: "PRE_GAME",
      lineupSource: null,
    };
  }

  const homeComplete = home.lineupStatus === "COMPLETE";
  const awayComplete = away.lineupStatus === "COMPLETE";
  const anyStarters =
    home.starters.length > 0 || away.starters.length > 0;

  if (homeComplete && awayComplete) {
    return {
      collectionStatus: "CONFIRMED",
      reason: opts.usedBoxscore
        ? "Official starting lineups collected from MLB Stats API boxscore."
        : "Official starting lineups collected from MLB Stats API schedule lineups.",
      confirmed: true,
      collectionPhase: opts.usedBoxscore ? "POST_GAME" : "PRE_GAME",
      lineupSource: opts.usedBoxscore
        ? "mlb-statsapi-boxscore"
        : "mlb-statsapi-schedule-lineups",
    };
  }

  if (anyStarters) {
    return {
      collectionStatus: "PARTIAL",
      reason:
        "Lineup data is partially available; one or both sides are incomplete.",
      confirmed: false,
      collectionPhase: opts.usedBoxscore ? "POST_GAME" : "PRE_GAME",
      lineupSource: opts.usedBoxscore
        ? "mlb-statsapi-boxscore"
        : opts.usedScheduleLineups
          ? "mlb-statsapi-schedule-lineups"
          : null,
    };
  }

  if (isFinalOrLive(opts.abstractState)) {
    return {
      collectionStatus: "INVALID_RESPONSE",
      reason:
        "Game is live/final but no official starting batting-order slots were present.",
      confirmed: false,
      collectionPhase: "POST_GAME",
      lineupSource: opts.usedBoxscore ? "mlb-statsapi-boxscore" : null,
    };
  }

  return {
    collectionStatus: "NOT_RELEASED",
    reason: "Official starting lineup has not been released.",
    confirmed: false,
    collectionPhase: "PRE_GAME",
    lineupSource: null,
  };
}

export type BuildLineupDatasetResult = {
  document: LineupDatasetDocument;
  predictionHash: string;
  usage: CacheUsageStats;
  providerGamesCount: number;
  matchedGamesCount: number;
};

export async function buildLineupDatasetV1(input: {
  dateKst: string;
}): Promise<BuildLineupDatasetResult> {
  const predictionHash = EMPTY_PREDICTION_HASH;
  const usage = createCacheUsage();
  const { targets, scheduleSource } = await resolveScheduleTargets(
    input.dateKst,
  );
  const scheduleLineups = await loadScheduleLineupsByPk(targets, usage);
  const generatedAt = new Date().toISOString();
  const rows: LineupDatasetRow[] = [];

  let matchedGamesCount = 0;
  const providerGamePks = new Set<number>();

  const gameStatusCounts: Record<LineupCollectionStatus, number> = {
    CONFIRMED: 0,
    PARTIAL: 0,
    NOT_RELEASED: 0,
    NOT_COLLECTED: 0,
    PROVIDER_ERROR: 0,
    MATCH_NOT_FOUND: 0,
    INVALID_RESPONSE: 0,
  };

  for (const game of targets) {
    if (!Number.isFinite(game.gamePk) || game.gamePk <= 0) {
      const homeEx = emptyExtractedSide(
        game.homeTeamId ?? -1,
        game.homeTeam,
        "MATCH_NOT_FOUND",
      );
      const awayEx = emptyExtractedSide(
        game.awayTeamId ?? -1,
        game.awayTeam,
        "MATCH_NOT_FOUND",
      );
      const status = {
        collectionStatus: "MATCH_NOT_FOUND" as const,
        reason: "Schedule game is missing a valid MLB gamePk.",
        confirmed: false,
        collectionPhase: "PRE_GAME" as const,
        lineupSource: null,
      };
      gameStatusCounts.MATCH_NOT_FOUND += 1;
      rows.push(
        buildTeamRow({
          generatedAt,
          dateKst: input.dateKst,
          game,
          side: "home",
          extracted: homeEx,
          opponent: awayEx,
          sourceTimestamp: null,
          ...status,
        }),
        buildTeamRow({
          generatedAt,
          dateKst: input.dateKst,
          game,
          side: "away",
          extracted: awayEx,
          opponent: homeEx,
          sourceTimestamp: null,
          ...status,
        }),
      );
      continue;
    }

    matchedGamesCount += 1;
    const scheduleRef = scheduleLineups.get(game.gamePk) ?? null;
    if (scheduleRef) providerGamePks.add(game.gamePk);

    let homeEx: ExtractedSide | null = null;
    let awayEx: ExtractedSide | null = null;
    let usedBoxscore = false;
    let usedScheduleLineups = false;
    let sourceTimestamp: string | null = null;
    let providerError: string | null = null;
    let abstractState: string | null =
      scheduleRef?.abstractState ?? game.statusAbstract ?? null;

    try {
      const boxBody = asRecord(
        await getRawStatsJson(
          `/api/v1/game/${game.gamePk}/boxscore`,
          usage,
        ),
      );
      const teams = asRecord(boxBody?.teams);
      homeEx = extractSideFromBoxscore(teams?.home);
      awayEx = extractSideFromBoxscore(teams?.away);
      sourceTimestamp = await readBoxscoreFetchedAt(game.gamePk);
      usedBoxscore = true;
      providerGamePks.add(game.gamePk);
    } catch (e) {
      providerError =
        e instanceof Error
          ? `PROVIDER_ERROR: ${e.message}`
          : "PROVIDER_ERROR: boxscore fetch failed";
    }

    const boxHasStarters =
      (homeEx?.starters.length ?? 0) > 0 ||
      (awayEx?.starters.length ?? 0) > 0;

    // Prefer schedule hydrate lineups when boxscore has no starters (typical pre-game).
    if (
      (!boxHasStarters || isPreview(abstractState)) &&
      scheduleRef &&
      (scheduleRef.homePlayers.length > 0 ||
        scheduleRef.awayPlayers.length > 0)
    ) {
      const schedHome = extractSideFromSchedulePlayers(
        scheduleRef.homePlayers,
        scheduleRef.homeTeamId ?? game.homeTeamId ?? -1,
        scheduleRef.homeTeamName || game.homeTeam,
      );
      const schedAway = extractSideFromSchedulePlayers(
        scheduleRef.awayPlayers,
        scheduleRef.awayTeamId ?? game.awayTeamId ?? -1,
        scheduleRef.awayTeamName || game.awayTeam,
      );
      if (
        schedHome.starters.length > 0 ||
        schedAway.starters.length > 0
      ) {
        homeEx = schedHome;
        awayEx = schedAway;
        usedScheduleLineups = true;
        usedBoxscore = false;
        sourceTimestamp = scheduleRef.sourceFetchedAt;
        abstractState = scheduleRef.abstractState ?? abstractState;
        providerError = null;
      }
    }

    if (!homeEx || !awayEx) {
      homeEx = emptyExtractedSide(
        game.homeTeamId ?? -1,
        game.homeTeam,
        providerError ?? "NOT_RELEASED",
      );
      awayEx = emptyExtractedSide(
        game.awayTeamId ?? -1,
        game.awayTeam,
        providerError ?? "NOT_RELEASED",
      );
    }

    // If boxscore failed and no schedule lineups — keep PROVIDER_ERROR only when
    // we had no schedule ref either; otherwise NOT_RELEASED for empty preview.
    if (providerError && !usedScheduleLineups && !boxHasStarters) {
      if (scheduleRef || isPreview(abstractState)) {
        // Preview with failed boxscore is common; treat as not released unless
        // the error is clearly not a missing-lineup case.
        if (/404|Not Found/i.test(providerError) || isPreview(abstractState)) {
          providerError = null;
        }
      }
    }

    const status = resolveGameStatus(homeEx, awayEx, {
      abstractState,
      usedBoxscore,
      usedScheduleLineups,
      providerError,
    });
    gameStatusCounts[status.collectionStatus] += 1;

    rows.push(
      buildTeamRow({
        generatedAt,
        dateKst: input.dateKst,
        game,
        side: "home",
        extracted: homeEx,
        opponent: awayEx,
        sourceTimestamp,
        ...status,
      }),
      buildTeamRow({
        generatedAt,
        dateKst: input.dateKst,
        game,
        side: "away",
        extracted: awayEx,
        opponent: homeEx,
        sourceTimestamp,
        ...status,
      }),
    );
  }

  rows.sort((a, b) => {
    const g = a.gameId.localeCompare(b.gameId);
    if (g !== 0) return g;
    return a.side.localeCompare(b.side);
  });

  let battingSlotDuplicates = 0;
  let battingSlotMissing = 0;
  for (const row of rows) {
    const counts = new Map<number, number>();
    for (const b of row.battingOrder) {
      counts.set(b.slot, (counts.get(b.slot) ?? 0) + 1);
    }
    for (let slot = 1; slot <= 9; slot += 1) {
      const n = counts.get(slot) ?? 0;
      if (n === 0) battingSlotMissing += 1;
      if (n > 1) battingSlotDuplicates += n - 1;
    }
  }
  const substitutesSeparated = rows.reduce(
    (n, r) => n + r.substitutes.length,
    0,
  );
  const startersMarkedSubstitute = rows.reduce(
    (n, r) =>
      n +
      r.warnings.filter((w) =>
        w.startsWith("STARTER_SLOT_MARKED_SUBSTITUTE"),
      ).length,
    0,
  );
  const completeLineups = rows.filter((r) => r.lineupStatus === "COMPLETE")
    .length;
  const incompleteLineups = rows.filter(
    (r) => r.lineupStatus === "INCOMPLETE",
  ).length;
  const postGameStatuses: Record<LineupStatus, number> = {
    COMPLETE: completeLineups,
    INCOMPLETE: incompleteLineups,
  };

  const hashableRows = rows.map((r) => hashableRowBody(r));
  const inputHashSha256 = sha256(
    stableStringify({
      datasetId: LINEUP_DATASET_ID,
      schemaVersion: LINEUP_SCHEMA_VERSION,
      builderVersion: LINEUP_BUILDER_VERSION,
      dateKst: input.dateKst,
      scheduleSource,
      predictionHash,
      games: targets.map((g) => ({
        gameId: g.gameId,
        gamePk: g.gamePk,
      })),
    }),
  );
  const resultHashSha256 = sha256(stableStringify(hashableRows));
  const totalStarters = rows.reduce((n, r) => n + r.battingOrder.length, 0);

  const document: LineupDatasetDocument = {
    meta: {
      datasetId: LINEUP_DATASET_ID,
      schemaVersion: LINEUP_SCHEMA_VERSION,
      builderVersion: LINEUP_BUILDER_VERSION,
      status: "COLLECTING",
      engineAdmission: "PROHIBITED",
      engineConnected: false,
      engineUseAllowed: false,
      researchOnly: true,
      dateKst: input.dateKst,
      generatedAt,
      predictionHashSha256: predictionHash,
      predictionUnchanged: true,
      inputHashSha256,
      resultHashSha256,
      scheduleSource,
      lineupSource: "mlb-statsapi",
      legal: {
        mlbStatsSource: "INTERNAL_RESEARCH_ONLY",
        publicRuntimeUseAllowed: false,
        commercialRuntimeUseAllowed: false,
        rawResponseInResearchCacheOnly: true,
        mlbHtmlCrawling: false,
        sportsDataIoScrambled: false,
      },
      notes: [
        "Schedule-first independent lineup intake — Prediction Snapshot is not an input.",
        "Official lineups only from MLB Stats API boxscore / schedule hydrate=lineups.",
        "Projected lineups are never invented.",
        "preGameStatus=NOT_COLLECTED — no separate pre-game snapshot field.",
        "team.battingOrder not used for starters (*00 slot rule).",
        "Engine admission PROHIBITED",
      ],
    },
    cacheUsage: { ...usage },
    summary: {
      totalGames: targets.length,
      teamLineups: rows.length,
      completeLineups,
      incompleteLineups,
      totalStarters,
      battingSlotDuplicates,
      battingSlotMissing,
      substitutesSeparated,
      startersMarkedSubstitute,
      preGameStatus: "NOT_COLLECTED",
      postGameStatuses,
      battingSideCollected: 0,
      peopleApiCalls: 0,
      confirmedGames: gameStatusCounts.CONFIRMED,
      partialGames: gameStatusCounts.PARTIAL,
      notReleasedGames: gameStatusCounts.NOT_RELEASED,
      notCollectedGames:
        gameStatusCounts.NOT_COLLECTED +
        gameStatusCounts.PROVIDER_ERROR +
        gameStatusCounts.MATCH_NOT_FOUND +
        gameStatusCounts.INVALID_RESPONSE,
      collectionStatus: gameStatusCounts,
    },
    rows,
  };

  return {
    document,
    predictionHash,
    usage,
    providerGamesCount: providerGamePks.size,
    matchedGamesCount,
  };
}

export function assertLineupDatasetIntegrity(
  document: LineupDatasetDocument,
): string[] {
  const errors: string[] = [];
  if (document.meta.engineAdmission !== "PROHIBITED") {
    errors.push("engineAdmission must be PROHIBITED");
  }
  if (document.meta.engineUseAllowed !== false) {
    errors.push("engineUseAllowed must be false");
  }
  if (document.summary.battingSideCollected !== 0) {
    errors.push("battingSide must not be collected in v1");
  }
  if (document.summary.peopleApiCalls !== 0) {
    errors.push("people API calls must be 0");
  }
  if (document.summary.preGameStatus !== "NOT_COLLECTED") {
    errors.push("preGameStatus must be NOT_COLLECTED");
  }

  for (const row of document.rows) {
    if (row.preGameStatus !== "NOT_COLLECTED") {
      errors.push(`${row.gameId}/${row.side}: preGame backfill detected`);
    }
    if (
      row.collectionPhase !== "POST_GAME" &&
      row.collectionPhase !== "PRE_GAME"
    ) {
      errors.push(
        `${row.gameId}/${row.side}: collectionPhase must be POST_GAME or PRE_GAME`,
      );
    }
    if (row.lineupType !== "ACTUAL_STARTING") {
      errors.push(
        `${row.gameId}/${row.side}: lineupType must be ACTUAL_STARTING`,
      );
    }
    if (row.battingOrder.some((b) => b.isSubstitute !== false)) {
      errors.push(`${row.gameId}/${row.side}: substitute in battingOrder`);
    }
    if (row.collectionStatus === "CONFIRMED") {
      if (row.lineupStatus !== "COMPLETE" || row.battingOrder.length !== 9) {
        errors.push(
          `${row.gameId}/${row.side}: CONFIRMED requires COMPLETE 9-slot lineup`,
        );
      }
      if (row.confirmed !== true) {
        errors.push(
          `${row.gameId}/${row.side}: CONFIRMED requires confirmed=true`,
        );
      }
    }
    if (row.lineupStatus === "COMPLETE" && row.battingOrder.length !== 9) {
      errors.push(
        `${row.gameId}/${row.side}: COMPLETE but starter count != 9`,
      );
    }
    const slots = row.battingOrder.map((b) => b.slot).sort((a, b) => a - b);
    if (row.lineupStatus === "COMPLETE") {
      for (let i = 1; i <= 9; i += 1) {
        if (slots[i - 1] !== i) {
          errors.push(
            `${row.gameId}/${row.side}: COMPLETE slots not 1..9 unique`,
          );
          break;
        }
      }
    }
  }

  return errors;
}

