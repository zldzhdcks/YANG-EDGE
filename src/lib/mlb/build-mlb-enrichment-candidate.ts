/**
 * SportsDataIO → MLBEnrichmentCandidate 안전 계층.
 *
 * - 기존 SportsDataIoProvider 재사용
 * - Engine에 전달하지 않음
 * - Scrambled/Trial 확인 전에는 usableForEngine=false
 */

import { normalizeTeamNameForOdds } from "@/lib/odds";
import type { SportsDataInjury, SportsDataLineup } from "@/lib/sportsdata";
import type {
  MlbBaselineMatchGame,
  MlbEnrichmentCandidate,
  MlbEnrichmentInjuriesSummary,
  MlbEnrichmentLineupSummary,
  MlbEnrichmentMatchStatus,
  MlbEnrichmentStartingPitchers,
  MlbEnrichmentWarning,
  SportsDataMatchGame,
} from "./types-enrichment";

const MATCH_TOLERANCE_MS = 3 * 60 * 60 * 1000;
const MIN_CONFIDENCE = 0.7;

/** SportsDataIO HomeTeam 약어 → 풀네임 (매칭 전용, 값 생성 아님) */
const MLB_TEAM_CODE_TO_NAME: Record<string, string> = {
  ari: "Arizona Diamondbacks",
  atl: "Atlanta Braves",
  bal: "Baltimore Orioles",
  bos: "Boston Red Sox",
  chc: "Chicago Cubs",
  chi: "Chicago Cubs",
  cin: "Cincinnati Reds",
  cle: "Cleveland Guardians",
  col: "Colorado Rockies",
  cws: "Chicago White Sox",
  chw: "Chicago White Sox",
  det: "Detroit Tigers",
  hou: "Houston Astros",
  kc: "Kansas City Royals",
  laa: "Los Angeles Angels",
  lad: "Los Angeles Dodgers",
  mia: "Miami Marlins",
  mil: "Milwaukee Brewers",
  min: "Minnesota Twins",
  nym: "New York Mets",
  nyy: "New York Yankees",
  oak: "Athletics",
  ath: "Athletics",
  phi: "Philadelphia Phillies",
  pit: "Pittsburgh Pirates",
  sd: "San Diego Padres",
  sea: "Seattle Mariners",
  sf: "San Francisco Giants",
  stl: "St. Louis Cardinals",
  tb: "Tampa Bay Rays",
  tex: "Texas Rangers",
  tor: "Toronto Blue Jays",
  wsh: "Washington Nationals",
  was: "Washington Nationals",
};

export type ScrambledDetection = {
  scrambled: boolean | null;
  evidence: string[];
  warnings: MlbEnrichmentWarning[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function expandTeamLabel(label: string): string {
  const trimmed = label.trim();
  const code = MLB_TEAM_CODE_TO_NAME[trimmed.toLowerCase()];
  return code ?? trimmed;
}

function teamScore(a: string, b: string): number {
  const left = normalizeTeamNameForOdds(expandTeamLabel(a));
  const right = normalizeTeamNameForOdds(expandTeamLabel(b));
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (
    left.length >= 4 &&
    right.length >= 4 &&
    (left.includes(right) || right.includes(left))
  ) {
    return 0.8;
  }
  return 0;
}

function timeDiffMinutes(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const aMs = Date.parse(a);
  const bMs = Date.parse(b);
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return null;
  return Math.round(Math.abs(aMs - bMs) / 60000);
}

function toCommenceUtc(value: string | null | undefined): string | null {
  if (!value) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const normalized = hasZone ? value : `${value}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * SportsDataIO 응답에서 Scrambled/Trial 표시를 확인한다.
 * 확인되지 않으면 추측하지 않고 null.
 */
export function detectScrambledStatus(
  payloads: unknown[],
): ScrambledDetection {
  let sawTrue = false;
  let sawFalse = false;
  let sawTrialMeta = false;
  let sawScrambledString = false;
  const evidence: string[] = [];

  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    const row = asRecord(value);
    if (!row) {
      if (typeof value === "string" && value.trim().toLowerCase() === "scrambled") {
        sawScrambledString = true;
        if (evidence.length < 12) evidence.push(`${path}=Scrambled`);
      }
      return;
    }

    for (const [key, child] of Object.entries(row)) {
      const keyLower = key.toLowerCase();
      if (
        keyLower === "scrambled" ||
        keyLower === "isscrambled" ||
        keyLower === "isscrambleddatas"
      ) {
        if (child === true) {
          sawTrue = true;
          evidence.push(`${path}.${key}=true`);
        } else if (child === false) {
          sawFalse = true;
          evidence.push(`${path}.${key}=false`);
        } else if (
          typeof child === "string" &&
          /^(true|yes|1)$/i.test(child.trim())
        ) {
          sawTrue = true;
          evidence.push(`${path}.${key}=${child}`);
        }
      }

      if (
        (keyLower === "trial" ||
          keyLower === "istrial" ||
          keyLower === "istrialaccount" ||
          keyLower === "subscription" ||
          keyLower === "accounttype" ||
          keyLower === "plan") &&
        (child === true ||
          (typeof child === "string" &&
            /trial|scramble/i.test(child)))
      ) {
        sawTrialMeta = true;
        evidence.push(`${path}.${key}=${String(child)}`);
      }

      visit(child, `${path}.${key}`);
    }
  };

  for (const [index, payload] of payloads.entries()) {
    visit(payload, `payload[${index}]`);
  }

  const warnings: MlbEnrichmentWarning[] = [];

  if (sawTrue || sawTrialMeta || sawScrambledString) {
    if (sawTrue) evidence.unshift("Scrambled===true");
    if (sawTrialMeta) evidence.unshift("trial_meta");
    if (sawScrambledString) evidence.unshift("literal_Scrambled_value");
    warnings.push("SCRAMBLED_DATA_CONFIRMED");
    return { scrambled: true, evidence: [...new Set(evidence)], warnings };
  }

  if (sawFalse && !sawTrue && !sawTrialMeta && !sawScrambledString) {
    return {
      scrambled: false,
      evidence: [...new Set(evidence)],
      warnings,
    };
  }

  warnings.push("SCRAMBLED_STATUS_UNKNOWN");
  return { scrambled: null, evidence: [...new Set(evidence)], warnings };
}

export function matchSportsDataGame(
  baseline: MlbBaselineMatchGame,
  candidates: SportsDataMatchGame[],
): {
  status: MlbEnrichmentMatchStatus;
  item: SportsDataMatchGame | null;
  confidence: number;
  candidateCount: number;
} {
  const matches: Array<{ item: SportsDataMatchGame; confidence: number }> = [];

  for (const item of candidates) {
    const home = teamScore(baseline.homeTeam, item.homeTeam);
    const away = teamScore(baseline.awayTeam, item.awayTeam);
    // 홈/원정 반전 금지: home·away 각각 일치해야 함
    if (home === 0 || away === 0) continue;

    const diff = timeDiffMinutes(
      baseline.commenceTimeUtc,
      item.commenceTimeUtc,
    );
    if (diff != null && diff > MATCH_TOLERANCE_MS / 60000) continue;

    const directId =
      (baseline.externalId != null &&
        (item.gameId === baseline.externalId ||
          baseline.externalId === item.gameId)) ||
      item.gameId === baseline.gameId.replace(/^mlb-/, "");

    matches.push({
      item,
      confidence: directId ? 1 : Math.min(home, away) * 0.9,
    });
  }

  matches.sort((a, b) => b.confidence - a.confidence);

  if (matches.length === 0) {
    return {
      status: "UNMATCHED",
      item: null,
      confidence: 0,
      candidateCount: 0,
    };
  }
  if (matches.length > 1 || matches[0].confidence < MIN_CONFIDENCE) {
    return {
      status: "AMBIGUOUS",
      item: null,
      confidence: matches[0].confidence,
      candidateCount: matches.length,
    };
  }
  return {
    status: "MATCHED",
    item: matches[0].item,
    confidence: matches[0].confidence,
    candidateCount: 1,
  };
}

function isScrambledPlaceholder(value: string | null): boolean {
  return Boolean(value && value.trim().toLowerCase() === "scrambled");
}

function isRealPitcherName(name: string | null): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (isScrambledPlaceholder(trimmed)) return false;
  return true;
}

function pitcherSideAvailable(
  playerId: number | null,
  name: string | null,
): boolean {
  // Trial Scrambled 플레이스홀더는 ID가 있어도 실제값으로 보지 않는다.
  if (isScrambledPlaceholder(name)) return false;
  return playerId != null || isRealPitcherName(name);
}

function buildStartingPitchers(
  game: SportsDataMatchGame | null,
): MlbEnrichmentStartingPitchers | null {
  if (!game) return null;
  const homeAvailable = pitcherSideAvailable(
    game.homePitcherId,
    game.homePitcherName,
  );
  const awayAvailable = pitcherSideAvailable(
    game.awayPitcherId,
    game.awayPitcherName,
  );
  return {
    home: {
      playerId: game.homePitcherId,
      name: game.homePitcherName,
      available: homeAvailable,
    },
    away: {
      playerId: game.awayPitcherId,
      name: game.awayPitcherName,
      available: awayAvailable,
    },
    available: homeAvailable && awayAvailable,
  };
}

function summarizeLineups(
  lineups: SportsDataLineup[],
): MlbEnrichmentLineupSummary {
  const playerCount = lineups.reduce(
    (sum, lineup) => sum + lineup.players.length,
    0,
  );
  return {
    available: lineups.length > 0 && playerCount > 0,
    teamCount: lineups.length,
    playerCount,
  };
}

function summarizeInjuries(
  home: SportsDataInjury[],
  away: SportsDataInjury[],
): MlbEnrichmentInjuriesSummary {
  return {
    available: home.length + away.length > 0,
    count: home.length + away.length,
    homeCount: home.length,
    awayCount: away.length,
  };
}

function computeDataAvailability(input: {
  matched: boolean;
  startingPitchers: MlbEnrichmentStartingPitchers | null;
  projectedLineup: MlbEnrichmentLineupSummary | null;
  confirmedLineup: MlbEnrichmentLineupSummary | null;
  injuries: MlbEnrichmentInjuriesSummary | null;
  standingsAvailable: boolean;
}): number {
  const flags = [
    input.matched,
    Boolean(input.startingPitchers?.available),
    Boolean(input.projectedLineup?.available),
    Boolean(input.confirmedLineup?.available),
    Boolean(input.injuries?.available),
    input.standingsAvailable,
  ];
  const on = flags.filter(Boolean).length;
  return Math.round((on / flags.length) * 1000) / 1000;
}

export function toSportsDataMatchGame(input: {
  gameId: string;
  homeTeam: string | null;
  awayTeam: string | null;
  dateTimeUtc: string | null;
  dateTime: string | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homePitcherId: number | null;
  awayPitcherId: number | null;
  homePitcherName: string | null;
  awayPitcherName: string | null;
  raw: Record<string, unknown>;
}): SportsDataMatchGame | null {
  if (!input.homeTeam || !input.awayTeam) return null;
  return {
    gameId: input.gameId,
    homeTeam: expandTeamLabel(input.homeTeam),
    awayTeam: expandTeamLabel(input.awayTeam),
    commenceTimeUtc:
      toCommenceUtc(input.dateTimeUtc) ?? toCommenceUtc(input.dateTime),
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
    homePitcherId: input.homePitcherId,
    awayPitcherId: input.awayPitcherId,
    homePitcherName: input.homePitcherName,
    awayPitcherName: input.awayPitcherName,
    raw: input.raw,
  };
}

export type BuildMlbEnrichmentCandidateInput = {
  baseline: MlbBaselineMatchGame;
  sportsDataCandidates: SportsDataMatchGame[];
  projectedLineups: SportsDataLineup[];
  confirmedLineups: SportsDataLineup[];
  homeInjuries: SportsDataInjury[];
  awayInjuries: SportsDataInjury[];
  scrambledDetection: ScrambledDetection;
};

/**
 * 단일 경기 보강 후보 생성. Engine에 전달하지 않는다.
 */
export function buildMlbEnrichmentCandidate(
  input: BuildMlbEnrichmentCandidateInput,
): MlbEnrichmentCandidate {
  const warnings: MlbEnrichmentWarning[] = [
    "STANDINGS_NOT_IMPLEMENTED",
    ...input.scrambledDetection.warnings,
  ];

  const match = matchSportsDataGame(
    input.baseline,
    input.sportsDataCandidates,
  );

  if (match.status === "UNMATCHED") warnings.push("MATCH_FAILED");
  if (match.status === "AMBIGUOUS") warnings.push("MATCH_AMBIGUOUS");

  const matchedGame = match.item;
  const startingPitchers = buildStartingPitchers(matchedGame);
  const projectedLineup = summarizeLineups(input.projectedLineups);
  const confirmedLineup = summarizeLineups(input.confirmedLineups);
  const injuries = summarizeInjuries(input.homeInjuries, input.awayInjuries);

  if (!startingPitchers?.available) {
    warnings.push("STARTING_PITCHER_MISSING");
  }
  if (!projectedLineup.available) {
    warnings.push("PROJECTED_LINEUP_MISSING");
  }
  if (!confirmedLineup.available) {
    warnings.push("CONFIRMED_LINEUP_MISSING");
  }
  if (!injuries.available) {
    warnings.push("INJURIES_MISSING");
  }

  const identifiersValid =
    Boolean(input.baseline.gameId) &&
    Boolean(input.baseline.homeTeam) &&
    Boolean(input.baseline.awayTeam) &&
    (matchedGame == null || Boolean(matchedGame.gameId));

  if (!identifiersValid) warnings.push("IDENTIFIERS_INVALID");

  const sourceClear = true; // 본 계층 source는 항상 sportsdataio
  if (!sourceClear) warnings.push("SOURCE_UNCLEAR");

  const scrambled = input.scrambledDetection.scrambled;
  const usableForEngine =
    scrambled === false &&
    match.status === "MATCHED" &&
    Boolean(startingPitchers?.available) &&
    sourceClear &&
    identifiersValid;

  const dataAvailability = computeDataAvailability({
    matched: match.status === "MATCHED",
    startingPitchers,
    projectedLineup,
    confirmedLineup,
    injuries,
    standingsAvailable: false,
  });

  return {
    gameId: input.baseline.gameId,
    sportsDataGameId: matchedGame?.gameId ?? null,
    homeTeam: input.baseline.homeTeam,
    awayTeam: input.baseline.awayTeam,
    startTime:
      input.baseline.startTimeKst ??
      input.baseline.commenceTimeUtc ??
      null,
    startingPitchers,
    projectedLineup,
    confirmedLineup,
    injuries,
    standings: null,
    source: "sportsdataio",
    scrambled,
    usableForEngine,
    warnings: [...new Set(warnings)],
    dataAvailability,
    matchStatus: match.status,
    matchConfidence: Math.round(match.confidence * 1000) / 1000,
    scrambledEvidence: input.scrambledDetection.evidence,
  };
}

export function buildMlbEnrichmentCandidates(
  baselines: MlbBaselineMatchGame[],
  sportsDataCandidates: SportsDataMatchGame[],
  enrichmentBySportsGameId: Map<
    string,
    {
      projectedLineups: SportsDataLineup[];
      confirmedLineups: SportsDataLineup[];
      homeInjuries: SportsDataInjury[];
      awayInjuries: SportsDataInjury[];
    }
  >,
  scrambledDetection: ScrambledDetection,
): MlbEnrichmentCandidate[] {
  return baselines.map((baseline) => {
    const match = matchSportsDataGame(baseline, sportsDataCandidates);
    const sid = match.item?.gameId ?? "";
    const extra = enrichmentBySportsGameId.get(sid) ?? {
      projectedLineups: [],
      confirmedLineups: [],
      homeInjuries: [],
      awayInjuries: [],
    };
    return buildMlbEnrichmentCandidate({
      baseline,
      sportsDataCandidates,
      projectedLineups: extra.projectedLineups,
      confirmedLineups: extra.confirmedLineups,
      homeInjuries: extra.homeInjuries,
      awayInjuries: extra.awayInjuries,
      scrambledDetection,
    });
  });
}
