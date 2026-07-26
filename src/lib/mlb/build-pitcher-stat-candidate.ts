/**
 * Probable pitcher → 경기 시작 전 성적 후보 매핑.
 * 응답에 없는 값은 추정하지 않는다. Engine 미연결.
 */

import type {
  MlbPitcherGameCoverage,
  PitcherIdentity,
  PitcherStatCandidate,
  PitcherStatCoverageStatus,
  RecentPitcherOuting,
} from "./types-pitcher";

const CORE_FIELDS = ["seasonEra", "seasonWhip", "inningsPitched"] as const;

export type GameLogSplit = {
  date?: string;
  isHome?: boolean;
  game?: { gamePk?: number };
  team?: { name?: string };
  opponent?: { name?: string };
  stat?: Record<string, unknown>;
};

export type PersonPayload = {
  id?: number;
  fullName?: string;
  pitchHand?: { code?: string; description?: string };
  currentTeam?: { name?: string };
};

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

/** MLB 이닝 표기 104.1 → 104 + 1/3 */
export function parseInningsPitched(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = asString(value);
  if (!raw) return null;
  const match = /^(\d+)(?:\.(\d))?$/.exec(raw);
  if (!match) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  const whole = Number(match[1]);
  const frac = match[2] == null ? 0 : Number(match[2]);
  if (![0, 1, 2].includes(frac)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return whole + frac / 3;
}

export function roundStat(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function matchPitcherByNameAndTeam(input: {
  fullName: string;
  teamName: string;
  candidates: Array<{ id: string; fullName: string; teamName: string }>;
}): { status: "MATCHED" | "AMBIGUOUS" | "UNAVAILABLE"; id: string | null } {
  const name = input.fullName.trim().toLowerCase();
  const team = input.teamName.trim().toLowerCase();
  const hits = input.candidates.filter(
    (c) =>
      c.fullName.trim().toLowerCase() === name &&
      c.teamName.trim().toLowerCase() === team,
  );
  if (hits.length === 1) return { status: "MATCHED", id: hits[0].id };
  if (hits.length > 1) return { status: "AMBIGUOUS", id: null };
  return { status: "UNAVAILABLE", id: null };
}

function throwsFromPerson(person: PersonPayload | null): "L" | "R" | null {
  const code = person?.pitchHand?.code?.toUpperCase();
  if (code === "L" || code === "R") return code;
  return null;
}

function outingFromSplit(split: GameLogSplit): RecentPitcherOuting {
  const stat = split.stat ?? {};
  const wins = asNumber(stat.wins);
  const losses = asNumber(stat.losses);
  return {
    date: asString(split.date),
    gamePk: asNumber(split.game?.gamePk),
    inningsPitched: parseInningsPitched(stat.inningsPitched),
    earnedRuns: asNumber(stat.earnedRuns),
    strikeOuts: asNumber(stat.strikeOuts),
    baseOnBalls: asNumber(stat.baseOnBalls),
    hits: asNumber(stat.hits),
    homeRuns: asNumber(stat.homeRuns),
    numberOfPitches: asNumber(stat.numberOfPitches),
    gamesStarted: asNumber(stat.gamesStarted),
    win: wins == null ? null : wins > 0,
    loss: losses == null ? null : losses > 0,
  };
}

/**
 * cutoff 이전 gameLog만 남긴다.
 * - 대상 gamePk 제외
 * - date(YYYY-MM-DD)가 cutoff 날짜(UTC 기준 official) 이상이면 제외
 */
export function filterGameLogBeforeCutoff(
  splits: GameLogSplit[],
  cutoffTimeIso: string,
  targetGamePk: number | null,
): { kept: GameLogSplit[]; leakageSuspect: boolean } {
  const cutoffMs = Date.parse(cutoffTimeIso);
  const cutoffDateUtc = Number.isFinite(cutoffMs)
    ? new Date(cutoffMs).toISOString().slice(0, 10)
    : null;

  const kept: GameLogSplit[] = [];
  let leakageSuspect = false;

  for (const split of splits) {
    const gamePk = asNumber(split.game?.gamePk);
    if (targetGamePk != null && gamePk === targetGamePk) {
      leakageSuspect = true;
      continue;
    }
    const date = asString(split.date);
    if (date && cutoffDateUtc && date >= cutoffDateUtc) {
      // 같은 날 이후/당일 기록은 누수 위험 — 제외
      leakageSuspect = true;
      continue;
    }
    kept.push(split);
  }

  return { kept, leakageSuspect };
}

export function aggregatePitchingFromGameLog(splits: GameLogSplit[]): {
  seasonEra: number | null;
  seasonWhip: number | null;
  gamesPlayed: number | null;
  gamesStarted: number | null;
  inningsPitched: number | null;
  wins: number | null;
  losses: number | null;
  strikeOuts: number | null;
  baseOnBalls: number | null;
  homeRuns: number | null;
  numberOfPitchesTotal: number | null;
  qualityStarts: number | null;
  recentOutings: RecentPitcherOuting[];
  lastOutingDate: string | null;
  availableFields: string[];
} {
  if (splits.length === 0) {
    return {
      seasonEra: null,
      seasonWhip: null,
      gamesPlayed: null,
      gamesStarted: null,
      inningsPitched: null,
      wins: null,
      losses: null,
      strikeOuts: null,
      baseOnBalls: null,
      homeRuns: null,
      numberOfPitchesTotal: null,
      qualityStarts: null,
      recentOutings: [],
      lastOutingDate: null,
      availableFields: [],
    };
  }

  let ip = 0;
  let er = 0;
  let hits = 0;
  let bb = 0;
  let so = 0;
  let hr = 0;
  let pitches = 0;
  let gs = 0;
  let wins = 0;
  let losses = 0;
  let ipSeen = false;
  let erSeen = false;
  let hitsSeen = false;
  let bbSeen = false;

  const outings: RecentPitcherOuting[] = [];

  for (const split of splits) {
    const outing = outingFromSplit(split);
    outings.push(outing);
    const stat = split.stat ?? {};
    const splitIp = parseInningsPitched(stat.inningsPitched);
    const splitEr = asNumber(stat.earnedRuns);
    const splitHits = asNumber(stat.hits);
    const splitBb = asNumber(stat.baseOnBalls);
    const splitSo = asNumber(stat.strikeOuts);
    const splitHr = asNumber(stat.homeRuns);
    const splitPitches = asNumber(stat.numberOfPitches);
    const splitGs = asNumber(stat.gamesStarted);
    const splitW = asNumber(stat.wins);
    const splitL = asNumber(stat.losses);

    if (splitIp != null) {
      ip += splitIp;
      ipSeen = true;
    }
    if (splitEr != null) {
      er += splitEr;
      erSeen = true;
    }
    if (splitHits != null) {
      hits += splitHits;
      hitsSeen = true;
    }
    if (splitBb != null) {
      bb += splitBb;
      bbSeen = true;
    }
    if (splitSo != null) so += splitSo;
    if (splitHr != null) hr += splitHr;
    if (splitPitches != null) pitches += splitPitches;
    if (splitGs != null) gs += splitGs;
    if (splitW != null) wins += splitW;
    if (splitL != null) losses += splitL;
  }

  outings.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const starts = outings.filter((o) => (o.gamesStarted ?? 0) > 0);
  const recentOutings = (starts.length > 0 ? starts : outings).slice(0, 5);

  const availableFields: string[] = [];
  const seasonEra =
    ipSeen && erSeen && ip > 0 ? roundStat((9 * er) / ip, 2) : null;
  const seasonWhip =
    ipSeen && hitsSeen && bbSeen && ip > 0
      ? roundStat((hits + bb) / ip, 2)
      : null;

  if (seasonEra != null) availableFields.push("seasonEra");
  if (seasonWhip != null) availableFields.push("seasonWhip");
  if (ipSeen) availableFields.push("inningsPitched");
  availableFields.push("gamesPlayed", "gamesStarted", "wins", "losses");
  if (so > 0 || splits.some((s) => asNumber(s.stat?.strikeOuts) != null)) {
    availableFields.push("strikeOuts");
  }
  if (bbSeen) availableFields.push("baseOnBalls");
  if (hr > 0 || splits.some((s) => asNumber(s.stat?.homeRuns) != null)) {
    availableFields.push("homeRuns");
  }
  if (pitches > 0 || splits.some((s) => asNumber(s.stat?.numberOfPitches) != null)) {
    availableFields.push("numberOfPitches");
  }
  if (recentOutings.length > 0) availableFields.push("recentOutings");

  return {
    seasonEra,
    seasonWhip,
    gamesPlayed: splits.length,
    gamesStarted: gs,
    inningsPitched: ipSeen ? roundStat(ip, 1) : null,
    wins,
    losses,
    strikeOuts: so,
    baseOnBalls: bbSeen ? bb : null,
    homeRuns: hr,
    numberOfPitchesTotal: pitches > 0 ? pitches : null,
    qualityStarts: null, // 응답에 QS 필드 없음
    recentOutings,
    lastOutingDate: outings[0]?.date ?? null,
    availableFields,
  };
}

function coreStatCount(candidate: {
  seasonEra: number | null;
  seasonWhip: number | null;
  inningsPitched: number | null;
}): number {
  let n = 0;
  if (candidate.seasonEra != null) n += 1;
  if (candidate.seasonWhip != null) n += 1;
  if (candidate.inningsPitched != null) n += 1;
  return n;
}

export function buildPitcherStatCandidate(input: {
  probableName: string | null;
  probableId: number | null;
  sideTeamName: string | null;
  mlbGamePk: number;
  baselineGameId: string | null;
  cutoffTime: string;
  person: PersonPayload | null;
  gameLogSplits: GameLogSplit[] | null;
  seasonLiveStats: Record<string, unknown> | null;
  matchStatus: "MATCHED" | "AMBIGUOUS" | "UNAVAILABLE";
  apiBaseballPlayersSupported: boolean;
}): PitcherStatCandidate {
  const warnings: string[] = [];
  const missingFields: string[] = [];

  const identity: PitcherIdentity = {
    providerPlayerId:
      input.probableId != null ? String(input.probableId) : null,
    fullName: input.person?.fullName ?? input.probableName,
    teamName: input.person?.currentTeam?.name ?? input.sideTeamName,
    throws: throwsFromPerson(input.person),
    mlbGamePk: input.mlbGamePk,
    baselineGameId: input.baselineGameId,
    source: "mlb-statsapi",
  };

  if (!input.apiBaseballPlayersSupported) {
    warnings.push("API_BASEBALL_PLAYERS_ENDPOINT_NOT_SUPPORTED");
  }
  warnings.push("MLB_STATSAPI_COMMERCIAL_USE_UNVERIFIED");

  if (input.matchStatus === "AMBIGUOUS") {
    return {
      identity,
      seasonEra: null,
      seasonWhip: null,
      gamesPlayed: null,
      gamesStarted: null,
      inningsPitched: null,
      wins: null,
      losses: null,
      strikeOuts: null,
      baseOnBalls: null,
      homeRuns: null,
      recentOutings: [],
      lastOutingDate: null,
      numberOfPitchesTotal: null,
      qualityStarts: null,
      cutoffTime: input.cutoffTime,
      statsSource: null,
      status: "AMBIGUOUS",
      missingFields: [...CORE_FIELDS],
      warnings: [...warnings, "NAME_TEAM_MATCH_AMBIGUOUS"],
      coreStatCount: 0,
    };
  }

  if (
    input.matchStatus === "UNAVAILABLE" ||
    identity.providerPlayerId == null ||
    !identity.fullName
  ) {
    return {
      identity,
      seasonEra: null,
      seasonWhip: null,
      gamesPlayed: null,
      gamesStarted: null,
      inningsPitched: null,
      wins: null,
      losses: null,
      strikeOuts: null,
      baseOnBalls: null,
      homeRuns: null,
      recentOutings: [],
      lastOutingDate: null,
      numberOfPitchesTotal: null,
      qualityStarts: null,
      cutoffTime: input.cutoffTime,
      statsSource: null,
      status: "UNAVAILABLE",
      missingFields: [...CORE_FIELDS, "providerPlayerId"],
      warnings: [...warnings, "PITCHER_IDENTITY_UNAVAILABLE"],
      coreStatCount: 0,
    };
  }

  if (!input.gameLogSplits) {
    // live season only — as-of 스냅샷 불가
    const live = input.seasonLiveStats ?? {};
    const seasonEra = asNumber(live.era);
    const seasonWhip = asNumber(live.whip);
    const inningsPitched = parseInningsPitched(live.inningsPitched);
    const core = coreStatCount({ seasonEra, seasonWhip, inningsPitched });
    for (const field of CORE_FIELDS) {
      if (field === "seasonEra" && seasonEra == null) missingFields.push(field);
      if (field === "seasonWhip" && seasonWhip == null) missingFields.push(field);
      if (field === "inningsPitched" && inningsPitched == null) {
        missingFields.push(field);
      }
    }
    missingFields.push("recentOutings", "qualityStarts");
    warnings.push("SEASON_LIVE_ENDPOINT_NO_ASOF_SNAPSHOT");
    return {
      identity,
      seasonEra,
      seasonWhip,
      gamesPlayed: asNumber(live.gamesPlayed),
      gamesStarted: asNumber(live.gamesStarted),
      inningsPitched,
      wins: asNumber(live.wins),
      losses: asNumber(live.losses),
      strikeOuts: asNumber(live.strikeOuts),
      baseOnBalls: asNumber(live.baseOnBalls),
      homeRuns: asNumber(live.homeRuns),
      recentOutings: [],
      lastOutingDate: null,
      numberOfPitchesTotal: asNumber(live.numberOfPitches),
      qualityStarts: asNumber(live.qualityStarts),
      cutoffTime: input.cutoffTime,
      statsSource: "mlb-statsapi:/people/{id}/stats?stats=season (live cumulative)",
      status: "LEAKAGE_RISK",
      missingFields: [...new Set(missingFields)],
      warnings,
      coreStatCount: core,
    };
  }

  const { kept, leakageSuspect } = filterGameLogBeforeCutoff(
    input.gameLogSplits,
    input.cutoffTime,
    input.mlbGamePk,
  );
  if (leakageSuspect) {
    warnings.push("EXCLUDED_POST_CUTOFF_OR_TARGET_GAME_LOG_ROWS");
  }

  const agg = aggregatePitchingFromGameLog(kept);
  for (const field of CORE_FIELDS) {
    if (field === "seasonEra" && agg.seasonEra == null) missingFields.push(field);
    if (field === "seasonWhip" && agg.seasonWhip == null) missingFields.push(field);
    if (field === "inningsPitched" && agg.inningsPitched == null) {
      missingFields.push(field);
    }
  }
  if (agg.recentOutings.length === 0) missingFields.push("recentOutings");
  missingFields.push("qualityStarts"); // 필드 자체 미제공

  const core = coreStatCount(agg);
  let status: PitcherStatCoverageStatus;
  if (core >= 2 && kept.length > 0) {
    status = "READY_FOR_BACKTEST";
  } else if (identity.providerPlayerId != null && core >= 1) {
    status = "PARTIAL";
  } else if (identity.providerPlayerId != null) {
    status = "PARTIAL";
  } else {
    status = "UNAVAILABLE";
  }

  // 대상 경기가 이미 시작/종료된 뒤 live season을 섞지 않음 — gameLog cutoff만 사용
  const now = Date.now();
  const cutoffMs = Date.parse(input.cutoffTime);
  if (Number.isFinite(cutoffMs) && now >= cutoffMs) {
    // 검증 실행 시점이 경기 시작 이후여도, gameLog 필터로 재구성했으면 READY 유지 가능
    warnings.push("EVAL_TIME_AFTER_CUTOFF_BUT_GAMELOG_FILTERED");
  }

  return {
    identity,
    seasonEra: agg.seasonEra,
    seasonWhip: agg.seasonWhip,
    gamesPlayed: agg.gamesPlayed,
    gamesStarted: agg.gamesStarted,
    inningsPitched: agg.inningsPitched,
    wins: agg.wins,
    losses: agg.losses,
    strikeOuts: agg.strikeOuts,
    baseOnBalls: agg.baseOnBalls,
    homeRuns: agg.homeRuns,
    recentOutings: agg.recentOutings.slice(0, 5),
    lastOutingDate: agg.lastOutingDate,
    numberOfPitchesTotal: agg.numberOfPitchesTotal,
    qualityStarts: agg.qualityStarts,
    cutoffTime: input.cutoffTime,
    statsSource:
      "mlb-statsapi:/people/{id}/stats?stats=gameLog&group=pitching (pre-cutoff aggregate)",
    status,
    missingFields: [...new Set(missingFields)],
    warnings,
    coreStatCount: core,
  };
}

export function combineGamePitcherStatus(
  home: PitcherStatCandidate,
  away: PitcherStatCandidate,
): PitcherStatCoverageStatus {
  const statuses = [home.status, away.status];
  if (statuses.includes("AMBIGUOUS")) return "AMBIGUOUS";
  if (statuses.includes("UNAVAILABLE")) return "UNAVAILABLE";
  if (statuses.includes("LEAKAGE_RISK")) return "LEAKAGE_RISK";
  if (statuses.every((s) => s === "READY_FOR_BACKTEST")) {
    return "READY_FOR_BACKTEST";
  }
  return "PARTIAL";
}

export function buildMlbPitcherGameCoverage(input: {
  gamePk: number;
  baselineGameId: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  commenceTimeUtc: string | null;
  startTimeKst: string | null;
  home: PitcherStatCandidate;
  away: PitcherStatCandidate;
}): MlbPitcherGameCoverage {
  const gameStatus = combineGamePitcherStatus(input.home, input.away);
  const warnings = [
    ...new Set([...input.home.warnings, ...input.away.warnings]),
  ];
  return {
    gamePk: input.gamePk,
    baselineGameId: input.baselineGameId,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    commenceTimeUtc: input.commenceTimeUtc,
    startTimeKst: input.startTimeKst,
    home: input.home,
    away: input.away,
    gameStatus,
    warnings,
  };
}
