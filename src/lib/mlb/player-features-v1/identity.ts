import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractSideFromBoxscore } from "../build-lineup-dataset";
import {
  latestConfirmedPregameObservation,
  listLineupObservations,
} from "../lineup-refresh-v1/store";
import {
  mlbBatterPregameGameAbs,
  mlbBatterPregameGameRel,
  mlbLineupObservationRel,
} from "../lineup-refresh-v1/paths";
import type { BatterPregameGameCaptureV1 } from "../lineup-refresh-v1/types";
import { mlbScheduleRel, mlbStarterRel } from "../research-scorecard-v1/paths";
import type {
  GameIdentity,
  HandCode,
  IdentityBatter,
  IdentityPitcher,
  LineupIdentityStatus,
  ScheduleGameLite,
  TeamSide,
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

async function readJsonIfExists(abs: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(abs, "utf8")) as unknown;
  } catch {
    return null;
  }
}

export function parseScheduleGames(json: unknown): ScheduleGameLite[] {
  const root = asRecord(json);
  const games = Array.isArray(root?.games) ? root!.games : [];
  const out: ScheduleGameLite[] = [];
  for (const raw of games) {
    const row = asRecord(raw);
    if (!row) continue;
    const gamePk = asNumber(row.gamePk);
    const gameId = asString(row.internalGameId) ?? asString(row.gameId);
    const commence =
      asString(row.commenceTimeUtc) ?? asString(row.scheduledStartTime);
    const homeTeam = asString(row.homeTeam);
    const awayTeam = asString(row.awayTeam);
    if (gamePk == null || !gameId || !commence || !homeTeam || !awayTeam) continue;
    out.push({
      gameId,
      gamePk,
      homeTeam,
      awayTeam,
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

export async function loadScheduleGames(input: {
  dateKst: string;
  cwd: string;
}): Promise<{ games: ScheduleGameLite[]; rel: string }> {
  const rel = mlbScheduleRel(input.dateKst);
  const json = await readJsonIfExists(path.join(input.cwd, rel));
  return { games: json ? parseScheduleGames(json) : [], rel };
}

function normalizeHand(raw: unknown): HandCode {
  const s = asString(raw)?.toUpperCase();
  if (s === "L" || s === "R" || s === "S") return s;
  return "UNKNOWN";
}

function battersFromPregameSide(
  side: { teamName: string | null; batters: Array<{ battingOrder: number; playerId: number | null; playerName: string | null; position: string | null; bats: string }> } | undefined,
  fallbackTeam: string,
): { teamName: string; batters: IdentityBatter[] } {
  const batters: IdentityBatter[] = [];
  for (const slot of side?.batters ?? []) {
    if (typeof slot.playerId !== "number") continue;
    batters.push({
      battingOrder: slot.battingOrder,
      playerId: slot.playerId,
      playerName: slot.playerName,
      defensivePosition: slot.position,
      bats: normalizeHand(slot.bats),
    });
  }
  batters.sort((a, b) => a.battingOrder - b.battingOrder);
  return { teamName: side?.teamName ?? fallbackTeam, batters };
}

function battersFromBoxscoreSide(
  teamRaw: unknown,
  fallbackTeam: string,
): { teamName: string; batters: IdentityBatter[] } {
  const extracted = extractSideFromBoxscore(teamRaw);
  const batters: IdentityBatter[] = extracted.starters
    .filter((s) => typeof s.playerId === "number" && s.slot >= 1 && s.slot <= 9)
    .map((s) => ({
      battingOrder: s.slot,
      playerId: s.playerId,
      playerName: s.playerName,
      defensivePosition: s.defensivePosition,
      bats: "UNKNOWN" as const,
    }))
    .sort((a, b) => a.battingOrder - b.battingOrder);
  return {
    teamName: extracted.teamName && extracted.teamName !== "UNKNOWN"
      ? extracted.teamName
      : fallbackTeam,
    batters,
  };
}

function classifyLineup(
  homeCount: number,
  awayCount: number,
): LineupIdentityStatus {
  if (homeCount >= 9 && awayCount >= 9) return "CONFIRMED";
  if (homeCount > 0 || awayCount > 0) return "PARTIAL";
  return "UNAVAILABLE";
}

function probableFromTeamRaw(teamRaw: unknown): IdentityPitcher {
  const team = asRecord(teamRaw);
  const probable = asRecord(team?.probablePitcher);
  const id = asNumber(probable?.id);
  const name = asString(probable?.fullName);
  if (id == null && !name) {
    return {
      playerId: null,
      playerName: null,
      throws: "UNKNOWN",
      starterStatus: "MISSING",
    };
  }
  return {
    playerId: id,
    playerName: name,
    throws: "UNKNOWN",
    starterStatus: "PROBABLE",
  };
}

export type StarterIdentityRow = {
  gamePk: number;
  side: TeamSide;
  probablePitcherId: number | null;
  probablePitcherName: string | null;
  throws: HandCode;
};

export function parseStarterIdentityRows(json: unknown): StarterIdentityRow[] {
  const root = asRecord(json);
  const rows = Array.isArray(root?.rows) ? root!.rows : [];
  const out: StarterIdentityRow[] = [];
  for (const raw of rows) {
    const row = asRecord(raw);
    if (!row) continue;
    const gamePk = asNumber(row.gamePk);
    const side = row.side === "home" || row.side === "away" ? row.side : null;
    if (gamePk == null || !side) continue;
    out.push({
      gamePk,
      side,
      probablePitcherId: asNumber(row.probablePitcherId),
      probablePitcherName: asString(row.probablePitcherName),
      throws: normalizeHand(row.throws),
    });
  }
  return out;
}

function starterFromRows(
  rows: StarterIdentityRow[],
  gamePk: number,
  side: TeamSide,
  fallback: IdentityPitcher,
): IdentityPitcher {
  const hit = rows.find((r) => r.gamePk === gamePk && r.side === side);
  if (!hit || (hit.probablePitcherId == null && !hit.probablePitcherName)) {
    return fallback;
  }
  return {
    playerId: hit.probablePitcherId,
    playerName: hit.probablePitcherName,
    throws: hit.throws,
    starterStatus: hit.probablePitcherId != null ? "PROBABLE" : "MISSING",
  };
}

export type PlayerFeatureSources = {
  scheduleGames?: ScheduleGameLite[];
  identityByGamePk?: Record<number, GameIdentity>;
  starterRows?: StarterIdentityRow[];
};

export async function loadGameIdentity(input: {
  dateKst: string;
  cwd: string;
  game: ScheduleGameLite;
  starterRows: StarterIdentityRow[];
}): Promise<GameIdentity> {
  const captureAbs = mlbBatterPregameGameAbs(
    input.dateKst,
    input.game.gamePk,
    input.cwd,
  );
  const captureJson = await readJsonIfExists(captureAbs);
  const capture = asRecord(captureJson) as BatterPregameGameCaptureV1 | null;
  if (
    capture &&
    capture.collectionPhase === "PRE_GAME" &&
    capture.collectionStatus === "CONFIRMED"
  ) {
    const home = battersFromPregameSide(capture.home, input.game.homeTeam);
    const away = battersFromPregameSide(capture.away, input.game.awayTeam);
    const snapshots = await listLineupObservations({
      dateKst: input.dateKst,
      gamePk: input.game.gamePk,
      cwd: input.cwd,
    });
    const box = asRecord(snapshots[0]?.body);
    const teams = asRecord(box?.teams);
    return {
      gamePk: input.game.gamePk,
      lineupStatus: classifyLineup(home.batters.length, away.batters.length),
      collectionPhase: "PRE_GAME",
      home,
      away,
      homeStarter: starterFromRows(
        input.starterRows,
        input.game.gamePk,
        "home",
        probableFromTeamRaw(teams?.home),
      ),
      awayStarter: starterFromRows(
        input.starterRows,
        input.game.gamePk,
        "away",
        probableFromTeamRaw(teams?.away),
      ),
      lineupObservationId: capture.lineupObservationId,
      lineupPayloadHash: capture.lineupPayloadHash,
      lineupRel: mlbBatterPregameGameRel(input.dateKst, input.game.gamePk),
    };
  }

  const snapshots = await listLineupObservations({
    dateKst: input.dateKst,
    gamePk: input.game.gamePk,
    cwd: input.cwd,
  });
  const confirmed = latestConfirmedPregameObservation(snapshots);
  if (!confirmed || confirmed.collectionPhase !== "PRE_GAME") {
    return {
      gamePk: input.game.gamePk,
      lineupStatus: "UNAVAILABLE",
      collectionPhase: confirmed?.collectionPhase ?? null,
      home: { teamName: input.game.homeTeam, batters: [] },
      away: { teamName: input.game.awayTeam, batters: [] },
      homeStarter: starterFromRows(
        input.starterRows,
        input.game.gamePk,
        "home",
        {
          playerId: null,
          playerName: null,
          throws: "UNKNOWN",
          starterStatus: "MISSING",
        },
      ),
      awayStarter: starterFromRows(
        input.starterRows,
        input.game.gamePk,
        "away",
        {
          playerId: null,
          playerName: null,
          throws: "UNKNOWN",
          starterStatus: "MISSING",
        },
      ),
      lineupObservationId: null,
      lineupPayloadHash: null,
      lineupRel: null,
    };
  }

  const box = asRecord(confirmed.body);
  const teams = asRecord(box?.teams);
  const home = battersFromBoxscoreSide(teams?.home, input.game.homeTeam);
  const away = battersFromBoxscoreSide(teams?.away, input.game.awayTeam);
  return {
    gamePk: input.game.gamePk,
    lineupStatus: classifyLineup(home.batters.length, away.batters.length),
    collectionPhase: "PRE_GAME",
    home,
    away,
    homeStarter: starterFromRows(
      input.starterRows,
      input.game.gamePk,
      "home",
      probableFromTeamRaw(teams?.home),
    ),
    awayStarter: starterFromRows(
      input.starterRows,
      input.game.gamePk,
      "away",
      probableFromTeamRaw(teams?.away),
    ),
    lineupObservationId: confirmed.observationId,
    lineupPayloadHash: confirmed.payloadHash,
    lineupRel: mlbLineupObservationRel(
      input.dateKst,
      input.game.gamePk,
      confirmed.observationId,
    ),
  };
}

export async function loadStarterIdentityRows(input: {
  dateKst: string;
  cwd: string;
}): Promise<{ rows: StarterIdentityRow[]; rel: string }> {
  const rel = mlbStarterRel(input.dateKst);
  const json = await readJsonIfExists(path.join(input.cwd, rel));
  return { rows: json ? parseStarterIdentityRows(json) : [], rel };
}
