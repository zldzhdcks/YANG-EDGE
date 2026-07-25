import type { GameData } from "@/types/game";
import type { OddsData } from "./types";

export type MatchOddsOptions = {
  /** 시작 시간 허용 오차(ms). 기본 3시간 */
  commenceToleranceMs?: number;
};

export type OddsGameMatch = {
  game: GameData;
  odds: OddsData;
  reason: "externalId" | "teams+time";
};

/**
 * 팀명 정규화 — 대소문자/공백/구두점 제거 후 비교.
 * 한글·영문 별칭이 달라도 억지 매칭하지 않는다 (양쪽을 각각 정규화해 동등만 인정).
 */
export function normalizeTeamNameForOdds(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.\-_/']/g, " ")
    .replace(/\b(fc|sc|cf|afc|club|baseball|team)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamsMatch(a: string, b: string): boolean {
  const na = normalizeTeamNameForOdds(a);
  const nb = normalizeTeamNameForOdds(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // 한쪽이 다른 쪽을 완전히 포함할 때만 (짧은 별칭 오탐 방지: 길이 4 이상)
  if (na.length >= 4 && nb.length >= 4) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  return false;
}

function parseCommenceMs(iso: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/**
 * GameData.date + startTime(KST HH:mm) 을 대략적 UTC ms 로 환산.
 * 매칭 허용 오차가 크므로(기본 3h) 정밀 timezone 변환 없이도 실용적이다.
 * 정확한 KST→UTC 가 필요하면 이후 datetime 유틸로 교체.
 */
function estimateGameCommenceMs(game: GameData): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(game.date)) return null;
  const time =
    /^\d{2}:\d{2}/.test(game.startTime) && game.startTime !== "TBD"
      ? game.startTime.slice(0, 5)
      : "12:00";
  // KST = UTC+9
  const utc = Date.parse(`${game.date}T${time}:00+09:00`);
  return Number.isFinite(utc) ? utc : null;
}

/**
 * 단일 GameData ↔ OddsData 매칭.
 *
 * 우선순위:
 * 1. externalId === externalEventId
 * 2. 홈·원정 팀명 정규화 일치 + 시작 시간 허용 오차
 *
 * 팀명이 맞지 않으면 null (억지 매칭 금지).
 */
export function matchOddsToGame(
  game: GameData,
  oddsList: OddsData[],
  options: MatchOddsOptions = {},
): OddsGameMatch | null {
  const tolerance = options.commenceToleranceMs ?? 3 * 60 * 60 * 1000;

  if (game.externalId) {
    const byId = oddsList.find((o) => o.externalEventId === game.externalId);
    if (byId) {
      return { game, odds: byId, reason: "externalId" };
    }
  }

  const gameMs = estimateGameCommenceMs(game);

  for (const odds of oddsList) {
    const homeOk = teamsMatch(game.homeTeam, odds.homeTeam);
    const awayOk = teamsMatch(game.awayTeam, odds.awayTeam);
    // 홈/원정이 뒤집힌 표기 대비
    const swapped =
      teamsMatch(game.homeTeam, odds.awayTeam) &&
      teamsMatch(game.awayTeam, odds.homeTeam);

    if (!homeOk && !awayOk && !swapped) continue;
    if (!(homeOk && awayOk) && !swapped) continue;

    if (gameMs != null) {
      const oddsMs = parseCommenceMs(odds.commenceTime);
      if (oddsMs == null) continue;
      if (Math.abs(gameMs - oddsMs) > tolerance) continue;
    }

    return { game, odds, reason: "teams+time" };
  }

  return null;
}

/** 여러 경기에 대해 1:1 매칭 (이미 매칭된 odds 는 재사용하지 않음) */
export function matchOddsToGames(
  games: GameData[],
  oddsList: OddsData[],
  options?: MatchOddsOptions,
): OddsGameMatch[] {
  const remaining = [...oddsList];
  const matches: OddsGameMatch[] = [];

  for (const game of games) {
    const hit = matchOddsToGame(game, remaining, options);
    if (!hit) continue;
    matches.push(hit);
    const idx = remaining.findIndex(
      (o) => o.externalEventId === hit.odds.externalEventId,
    );
    if (idx >= 0) remaining.splice(idx, 1);
  }

  return matches;
}
