/**
 * MLB Travel / Rest Dataset v1 builder — PRE_GAME_SCHEDULE_CONTEXT only.
 *
 * - One row per team per game (starter join)
 * - Haversine distance on official venue coordinates (approximate)
 * - No actual travel / flight / hotel / transport inference
 * - No hoursSinceFinal / extra innings
 * - No Engine / Score / Framework imports
 */
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { getKstDateString } from "../datetime/kst";
import {
  createCacheUsage,
  getRawStatsJson,
  type CacheUsageStats,
} from "./research-stats-cache";
import {
  TRAVEL_REST_BUILDER_VERSION,
  TRAVEL_REST_COLLECTION_PHASE,
  TRAVEL_REST_DATASET_ID,
  TRAVEL_REST_SCHEMA_VERSION,
  type BuildTravelRestDatasetResult,
  type DoubleheaderStatus,
  type RestSnapshot,
  type TravelRestDatasetDocument,
  type TravelRestDatasetRow,
  type TravelSnapshot,
  type TravelTimezoneChange,
  type TravelTransitionType,
  type TravelVenueSnapshot,
} from "./travel-rest-dataset-types";

const SCHEDULE_LOOKBACK_DAYS = 14;

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

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function addDaysKst(dateKst: string, delta: number): string {
  const ms = Date.parse(`${dateKst}T12:00:00+09:00`) + delta * 86400000;
  return getKstDateString(new Date(ms));
}

function addDaysOfficial(officialDate: string, delta: number): string {
  const ms = Date.parse(`${officialDate}T12:00:00Z`) + delta * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

function daysBetweenOfficial(from: string, to: string): number {
  const msFrom = Date.parse(`${from}T12:00:00Z`);
  const msTo = Date.parse(`${to}T12:00:00Z`);
  return Math.round((msTo - msFrom) / 86400000);
}

function hoursBetweenIso(from: string, to: string): number {
  const msFrom = Date.parse(from);
  const msTo = Date.parse(to);
  if (Number.isNaN(msFrom) || Number.isNaN(msTo)) return NaN;
  return (msTo - msFrom) / 3600000;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type TeamSlot = {
  gameId: string;
  gamePk: number;
  teamId: number;
  teamName: string;
  side: "home" | "away";
  cutoffTime: string | null;
};

type ScheduleGame = {
  gamePk: number;
  gameDate: string;
  officialDate: string;
  venueId: number;
  venueName: string;
  homeId: number;
  awayId: number;
  homeName: string;
  awayName: string;
  statusCode: string;
  abstractGameState: string;
  doubleHeader: string;
  gameNumber: number;
};

async function loadTeamSlots(dateKst: string): Promise<TeamSlot[]> {
  const starterPath = path.join(
    process.cwd(),
    "data/research/mlb",
    `${dateKst}-starter-dataset-v1.json`,
  );
  const predPath = path.join(
    process.cwd(),
    "data/predictions/mlb",
    `${dateKst}.json`,
  );

  if (!(await fileExists(predPath))) {
    throw new Error(`prediction snapshot missing: ${predPath}`);
  }
  if (!(await fileExists(starterPath))) {
    throw new Error(
      `starter dataset missing (read-only join for gamePk): ${starterPath}`,
    );
  }

  const pred = JSON.parse(await readFile(predPath, "utf8")) as {
    predictions?: unknown[];
  };
  const starter = JSON.parse(await readFile(starterPath, "utf8")) as {
    rows?: unknown[];
  };

  const predGameIds = new Set<string>();
  for (const raw of pred.predictions ?? []) {
    const p = asRecord(raw);
    const gameId = asString(p?.gameId);
    if (gameId) predGameIds.add(gameId);
  }

  const slots: TeamSlot[] = [];
  for (const raw of starter.rows ?? []) {
    const r = asRecord(raw);
    if (!r) continue;
    if (asString(r.predictionDate) !== dateKst) continue;
    const gameId = asString(r.gameId);
    const gamePk = asNumber(r.gamePk);
    const teamId = asNumber(r.teamId);
    const side = asString(r.side);
    if (!gameId || gamePk == null || teamId == null) continue;
    if (!predGameIds.has(gameId)) continue;
    if (side !== "home" && side !== "away") continue;

    const teamName =
      side === "home"
        ? (asString(r.homeTeam) ?? "")
        : (asString(r.awayTeam) ?? "");

    slots.push({
      gameId,
      gamePk,
      teamId,
      teamName,
      side,
      cutoffTime: asString(r.cutoffTime),
    });
  }

  return slots.sort(
    (a, b) => a.gamePk - b.gamePk || a.teamId - b.teamId,
  );
}

function parseScheduleGame(raw: unknown): ScheduleGame | null {
  const g = asRecord(raw);
  if (!g) return null;

  const gamePk = asNumber(g.gamePk);
  const gameDate = asString(g.gameDate);
  const officialDate = asString(g.officialDate);
  const venue = asRecord(g.venue);
  const venueId = asNumber(venue?.id);
  const venueName = asString(venue?.name);
  const teams = asRecord(g.teams);
  const home = asRecord(teams?.home);
  const away = asRecord(teams?.away);
  const homeTeam = asRecord(home?.team);
  const awayTeam = asRecord(away?.team);
  const homeId = asNumber(homeTeam?.id);
  const awayId = asNumber(awayTeam?.id);
  const homeName = asString(homeTeam?.name);
  const awayName = asString(awayTeam?.name);
  const status = asRecord(g.status);
  const statusCode = asString(status?.statusCode) ?? "";
  const abstractGameState = asString(status?.abstractGameState) ?? "";
  const doubleHeader = asString(g.doubleHeader) ?? "N";
  const gameNumber = asNumber(g.gameNumber) ?? 1;

  if (
    gamePk == null ||
    !gameDate ||
    !officialDate ||
    venueId == null ||
    !venueName ||
    homeId == null ||
    awayId == null ||
    !homeName ||
    !awayName
  ) {
    return null;
  }

  return {
    gamePk,
    gameDate,
    officialDate,
    venueId,
    venueName,
    homeId,
    awayId,
    homeName,
    awayName,
    statusCode,
    abstractGameState,
    doubleHeader,
    gameNumber,
  };
}

async function loadScheduleGamesInRange(
  startDate: string,
  endDate: string,
  usage: CacheUsageStats,
): Promise<Map<number, ScheduleGame>> {
  const body = asRecord(
    await getRawStatsJson(
      `/api/v1/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}`,
      usage,
    ),
  );
  const byPk = new Map<number, ScheduleGame>();
  for (const day of Array.isArray(body?.dates) ? body!.dates : []) {
    const games = Array.isArray(asRecord(day)?.games)
      ? (asRecord(day)!.games as unknown[])
      : [];
    for (const raw of games) {
      const parsed = parseScheduleGame(raw);
      if (parsed) byPk.set(parsed.gamePk, parsed);
    }
  }
  return byPk;
}

function buildTeamTimelines(
  games: Map<number, ScheduleGame>,
): Map<number, ScheduleGame[]> {
  const byTeam = new Map<number, ScheduleGame[]>();
  for (const game of games.values()) {
    for (const teamId of [game.homeId, game.awayId]) {
      const list = byTeam.get(teamId) ?? [];
      list.push(game);
      byTeam.set(teamId, list);
    }
  }
  for (const [teamId, list] of byTeam) {
    list.sort(
      (a, b) =>
        a.officialDate.localeCompare(b.officialDate) ||
        a.gameDate.localeCompare(b.gameDate) ||
        a.gamePk - b.gamePk,
    );
    byTeam.set(teamId, list);
  }
  return byTeam;
}

function teamSide(game: ScheduleGame, teamId: number): "home" | "away" {
  return game.homeId === teamId ? "home" : "away";
}

function isSkippedPrevious(game: ScheduleGame): boolean {
  const state = game.abstractGameState.toLowerCase();
  const code = game.statusCode.toLowerCase();
  if (state.includes("postponed") || code.includes("postponed")) return true;
  if (state.includes("cancelled") || code.includes("cancelled")) return true;
  return false;
}

function findPreviousGame(
  timeline: ScheduleGame[],
  currentIdx: number,
): { game: ScheduleGame | null; warnings: string[] } {
  const warnings: string[] = [];
  for (let i = currentIdx - 1; i >= 0; i--) {
    const candidate = timeline[i]!;
    if (isSkippedPrevious(candidate)) {
      warnings.push("PREVIOUS_POSTPONED_SKIPPED");
      continue;
    }
    return { game: candidate, warnings };
  }
  return { game: null, warnings };
}

function resolveDoubleheaderStatus(game: ScheduleGame): DoubleheaderStatus {
  if (game.doubleHeader !== "Y") return "SINGLE";
  return game.gameNumber === 2 ? "GAME2" : "GAME1";
}

function countGamesInOfficialWindow(
  timeline: ScheduleGame[],
  currentIdx: number,
  days: number,
): number {
  const currentDate = timeline[currentIdx]!.officialDate;
  const windowStart = addDaysOfficial(currentDate, -(days - 1));
  let count = 0;
  for (let i = 0; i <= currentIdx; i++) {
    const g = timeline[i]!;
    if (g.officialDate >= windowStart && g.officialDate <= currentDate) {
      count += 1;
    }
  }
  return count;
}

function countConsecutive(
  timeline: ScheduleGame[],
  currentIdx: number,
  teamId: number,
  side: "home" | "away",
): number {
  let count = 0;
  for (let i = currentIdx; i >= 0; i--) {
    if (teamSide(timeline[i]!, teamId) === side) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

function transitionType(
  prevSide: "home" | "away",
  curSide: "home" | "away",
): TravelTransitionType {
  if (prevSide === "home" && curSide === "home") return "HOME_TO_HOME";
  if (prevSide === "home" && curSide === "away") return "HOME_TO_AWAY";
  if (prevSide === "away" && curSide === "away") return "AWAY_TO_AWAY";
  return "AWAY_TO_HOME";
}

type VenueDetails = {
  latitude: number | null;
  longitude: number | null;
  timezoneId: string | null;
  timezoneOffsetHours: number | null;
};

async function loadVenueDetails(
  venueId: number,
  usage: CacheUsageStats,
  cache: Map<number, VenueDetails>,
): Promise<VenueDetails> {
  const cached = cache.get(venueId);
  if (cached) return cached;

  const body = asRecord(
    await getRawStatsJson(
      `/api/v1/venues/${venueId}?hydrate=location,timezone`,
      usage,
    ),
  );
  const venues = Array.isArray(body?.venues) ? body!.venues : [];
  const venue = asRecord(venues[0]);
  const location = asRecord(venue?.location);
  const coords = asRecord(location?.defaultCoordinates);
  const timeZone = asRecord(venue?.timeZone);

  const details: VenueDetails = {
    latitude: asNumber(coords?.latitude),
    longitude: asNumber(coords?.longitude),
    timezoneId: asString(timeZone?.id),
    timezoneOffsetHours: asNumber(timeZone?.offsetAtGameTime),
  };

  cache.set(venueId, details);
  return details;
}

function buildVenueSnapshot(
  venueId: number,
  venueName: string,
  details: VenueDetails,
): TravelVenueSnapshot {
  return {
    id: venueId,
    name: venueName,
    latitude: details.latitude,
    longitude: details.longitude,
    timezoneId: details.timezoneId,
    timezoneOffsetHours: details.timezoneOffsetHours,
  };
}

function buildTimezoneChange(
  prev: TravelVenueSnapshot | null,
  cur: TravelVenueSnapshot | null,
): TravelTimezoneChange | null {
  if (!prev && !cur) return null;
  const prevOffset = prev?.timezoneOffsetHours ?? null;
  const curOffset = cur?.timezoneOffsetHours ?? null;
  const changeHours =
    prevOffset != null && curOffset != null ? curOffset - prevOffset : null;
  return {
    previousOffsetHours: prevOffset,
    currentOffsetHours: curOffset,
    changeHours,
  };
}

function emptyTravelSnapshot(): TravelSnapshot {
  return {
    venueChanged: null,
    previousVenue: null,
    currentVenue: null,
    timezoneChange: null,
    distanceKm: null,
    transitionType: null,
  };
}

function emptyRestSnapshot(
  doubleheaderStatus: DoubleheaderStatus,
): RestSnapshot {
  return {
    gamesLast2: null,
    gamesLast3: null,
    gamesLast7: null,
    daysSincePreviousGame: null,
    hoursSincePreviousScheduledStart: null,
    consecutiveHomeGames: null,
    consecutiveAwayGames: null,
    doubleheaderStatus,
  };
}

function hashableRowBody(row: TravelRestDatasetRow): Record<string, unknown> {
  return {
    gameId: row.gameId,
    gamePk: row.gamePk,
    teamId: row.teamId,
    side: row.side,
    gameDate: row.gameDate,
    collectionPhase: row.collectionPhase,
    joinQuality: row.joinQuality,
    travel: row.travel,
    rest: row.rest,
    cutoffTime: row.cutoffTime,
    missing: row.missing,
    warnings: row.warnings,
  };
}

export function assertTravelRestDatasetIntegrity(
  document: TravelRestDatasetDocument,
): string[] {
  const issues: string[] = [];
  if (document.meta.engineAdmission !== "PROHIBITED") {
    issues.push("engineAdmission must be PROHIBITED");
  }
  for (const row of document.rows) {
    if (row.collectionPhase !== TRAVEL_REST_COLLECTION_PHASE) {
      issues.push(`${row.gameId}/${row.teamId}: invalid collectionPhase`);
    }
    if (row.rest.doubleheaderStatus === undefined) {
      issues.push(`${row.gameId}/${row.teamId}: doubleheaderStatus required`);
    }
  }
  return issues;
}

export async function buildTravelRestDatasetV1(input: {
  dateKst: string;
  predictionRaw: string;
}): Promise<BuildTravelRestDatasetResult> {
  const predictionHash = sha256(input.predictionRaw);
  const usage = createCacheUsage();
  const slots = await loadTeamSlots(input.dateKst);

  const startDate = addDaysKst(input.dateKst, -SCHEDULE_LOOKBACK_DAYS);
  const scheduleGames = await loadScheduleGamesInRange(
    startDate,
    input.dateKst,
    usage,
  );
  const teamTimelines = buildTeamTimelines(scheduleGames);
  const venueCache = new Map<number, VenueDetails>();
  const generatedAt = new Date().toISOString();
  const rows: TravelRestDatasetRow[] = [];

  const joinQualityCounts = {
    MATCHED: 0,
    MISSING_PREVIOUS: 0,
  };

  let travelResolved = 0;
  let restResolved = 0;
  let venueChanges = 0;
  let timezoneChanges = 0;

  for (const slot of slots) {
    const missing: string[] = [];
    const warnings: string[] = [];
    const timeline = teamTimelines.get(slot.teamId) ?? [];
    const currentIdx = timeline.findIndex((g) => g.gamePk === slot.gamePk);
    const currentGame = currentIdx >= 0 ? timeline[currentIdx]! : null;

    if (!currentGame) {
      missing.push("currentGame");
      warnings.push("CURRENT_GAME_NOT_IN_SCHEDULE");
    }

    const dhStatus = currentGame
      ? resolveDoubleheaderStatus(currentGame)
      : "SINGLE";

    let joinQuality: "MATCHED" | "MISSING_PREVIOUS" = "MISSING_PREVIOUS";
    let travel: TravelSnapshot = emptyTravelSnapshot();
    let rest: RestSnapshot = emptyRestSnapshot(dhStatus);

    if (currentGame && currentIdx >= 0) {
      rest.consecutiveHomeGames = countConsecutive(
        timeline,
        currentIdx,
        slot.teamId,
        "home",
      );
      rest.consecutiveAwayGames = countConsecutive(
        timeline,
        currentIdx,
        slot.teamId,
        "away",
      );
      rest.gamesLast2 = countGamesInOfficialWindow(timeline, currentIdx, 2);
      rest.gamesLast3 = countGamesInOfficialWindow(timeline, currentIdx, 3);
      rest.gamesLast7 = countGamesInOfficialWindow(timeline, currentIdx, 7);
      rest.doubleheaderStatus = resolveDoubleheaderStatus(currentGame);

      const { game: previousGame, warnings: prevWarnings } = findPreviousGame(
        timeline,
        currentIdx,
      );
      warnings.push(...prevWarnings);

      if (previousGame) {
        joinQuality = "MATCHED";
        rest.daysSincePreviousGame = daysBetweenOfficial(
          previousGame.officialDate,
          currentGame.officialDate,
        );
        const hours = hoursBetweenIso(
          previousGame.gameDate,
          currentGame.gameDate,
        );
        rest.hoursSincePreviousScheduledStart = Number.isFinite(hours)
          ? Math.round(hours * 100) / 100
          : null;

        const prevVenueDetails = await loadVenueDetails(
          previousGame.venueId,
          usage,
          venueCache,
        );
        const curVenueDetails = await loadVenueDetails(
          currentGame.venueId,
          usage,
          venueCache,
        );

        const previousVenue = buildVenueSnapshot(
          previousGame.venueId,
          previousGame.venueName,
          prevVenueDetails,
        );
        const currentVenue = buildVenueSnapshot(
          currentGame.venueId,
          currentGame.venueName,
          curVenueDetails,
        );

        travel.previousVenue = previousVenue;
        travel.currentVenue = currentVenue;
        travel.venueChanged = previousGame.venueId !== currentGame.venueId;
        travel.timezoneChange = buildTimezoneChange(previousVenue, currentVenue);

        const prevSide = teamSide(previousGame, slot.teamId);
        const curSide = teamSide(currentGame, slot.teamId);
        travel.transitionType = transitionType(prevSide, curSide);

        if (
          previousVenue.latitude != null &&
          previousVenue.longitude != null &&
          currentVenue.latitude != null &&
          currentVenue.longitude != null
        ) {
          travel.distanceKm =
            Math.round(
              haversineKm(
                previousVenue.latitude,
                previousVenue.longitude,
                currentVenue.latitude,
                currentVenue.longitude,
              ) * 100,
            ) / 100;
        } else {
          missing.push("distanceKm");
          warnings.push("VENUE_COORDINATES_UNAVAILABLE");
        }

        if (previousVenue.timezoneOffsetHours == null) {
          missing.push("previousVenue.timezoneOffsetHours");
        }
        if (currentVenue.timezoneOffsetHours == null) {
          missing.push("currentVenue.timezoneOffsetHours");
        }
      } else {
        missing.push(
          "previousGame",
          "daysSincePreviousGame",
          "hoursSincePreviousScheduledStart",
          "travel",
        );
        warnings.push("MISSING_PREVIOUS_GAME");
      }
    } else {
      missing.push(
        "currentGame",
        "daysSincePreviousGame",
        "hoursSincePreviousScheduledStart",
        "travel",
      );
    }

    if (!slot.cutoffTime) {
      missing.push("cutoffTime");
    }

    joinQualityCounts[joinQuality] += 1;

    if (joinQuality === "MATCHED" && travel.currentVenue) {
      travelResolved += 1;
    }
    if (joinQuality === "MATCHED" && rest.daysSincePreviousGame != null) {
      restResolved += 1;
    }
    if (travel.venueChanged === true) venueChanges += 1;
    if (
      travel.timezoneChange?.changeHours != null &&
      travel.timezoneChange.changeHours !== 0
    ) {
      timezoneChanges += 1;
    }

    const rowInputHash = sha256(
      stableStringify({
        gameId: slot.gameId,
        gamePk: slot.gamePk,
        teamId: slot.teamId,
        side: slot.side,
        predictionHash,
        scheduleStart: startDate,
        scheduleEnd: input.dateKst,
      }),
    );

    const rowBody: Omit<TravelRestDatasetRow, "inputHash" | "resultHash"> = {
      schemaVersion: TRAVEL_REST_SCHEMA_VERSION,
      builderVersion: TRAVEL_REST_BUILDER_VERSION,
      generatedAt,
      gameDate: input.dateKst,
      gameId: slot.gameId,
      gamePk: slot.gamePk,
      teamId: slot.teamId,
      teamName: slot.teamName,
      side: slot.side,
      collectionPhase: TRAVEL_REST_COLLECTION_PHASE,
      cutoffTime: slot.cutoffTime,
      researchOnly: true,
      legalStatus: "INTERNAL_RESEARCH_ONLY",
      engineUseAllowed: false,
      joinQuality,
      travel,
      rest,
      missing: [...new Set(missing)].sort(),
      warnings: [...new Set(warnings)].sort(),
    };

    const resultHash = sha256(
      stableStringify(hashableRowBody(rowBody as TravelRestDatasetRow)),
    );

    rows.push({
      ...rowBody,
      inputHash: rowInputHash,
      resultHash,
    });
  }

  const uniqueGameIds = new Set(rows.map((r) => r.gameId));
  const inputHashSha256 = sha256(
    stableStringify({
      dateKst: input.dateKst,
      predictionHash,
      scheduleStart: startDate,
      scheduleEnd: input.dateKst,
      rowInputs: rows.map((r) => r.inputHash).sort(),
    }),
  );
  const resultHashSha256 = sha256(
    stableStringify(rows.map((r) => hashableRowBody(r))),
  );

  const document: TravelRestDatasetDocument = {
    meta: {
      datasetId: TRAVEL_REST_DATASET_ID,
      schemaVersion: TRAVEL_REST_SCHEMA_VERSION,
      builderVersion: TRAVEL_REST_BUILDER_VERSION,
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
      legal: {
        mlbStatsSource: "INTERNAL_RESEARCH_ONLY",
        publicRuntimeUseAllowed: false,
        commercialRuntimeUseAllowed: false,
        rawResponseInResearchCacheOnly: true,
        mlbHtmlCrawling: false,
        sportsDataIoScrambled: false,
        routeInference: false,
      },
      notes: [
        "PRE_GAME_SCHEDULE_CONTEXT only — no actual travel or transport inference.",
        "distanceKm is haversine on official venue coordinates (approximate).",
        "hoursSincePreviousFinal and extra-inning effects excluded.",
        "Engine admission PROHIBITED.",
      ],
    },
    cacheUsage: {
      rawHit: usage.rawHit,
      rawMiss: usage.rawMiss,
      derivedHit: usage.derivedHit,
      derivedMiss: usage.derivedMiss,
      networkCalls: usage.networkCalls,
    },
    summary: {
      totalGames: uniqueGameIds.size,
      totalRows: rows.length,
      travelResolved,
      restResolved,
      venueChanges,
      timezoneChanges,
      joinQuality: joinQualityCounts,
    },
    rows,
  };

  return { document, usage };
}
