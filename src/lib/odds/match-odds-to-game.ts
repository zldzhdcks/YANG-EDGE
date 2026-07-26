import type { GameData } from "@/types/game";
import { instantToKst } from "@/lib/datetime/kst";
import type { OddsData } from "./types";

export type MatchOddsOptions = {
  /** 시작 시간 허용 오차(ms). 기본 3시간 */
  commenceToleranceMs?: number;
  /** 최소 신뢰도 (기본 0.7). 미만이면 매칭하지 않는다. */
  minConfidence?: number;
};

export type OddsMatchMethod = "external-id" | "teams-time" | "none";

export type OddsMatchInfo = {
  matched: boolean;
  /** 0~1. external-id=1.0, 정확 팀명=0.9, 부분 포함=0.7 */
  confidence: number;
  method: OddsMatchMethod;
};

export type OddsGameMatch = {
  game: GameData;
  odds: OddsData;
  confidence: number;
  method: Exclude<OddsMatchMethod, "none">;
};

export const NO_MATCH: OddsMatchInfo = {
  matched: false,
  confidence: 0,
  method: "none",
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

/**
 * 팀명 유사도: 1.0 정확 일치, 0.8 완전 포함(길이 4+), 0 불일치.
 * (포함 예: "Jeonbuk Motors" ⊂ "Jeonbuk Hyundai Motors")
 */
function teamNameScore(a: string, b: string): number {
  const na = normalizeTeamNameForOdds(a);
  const nb = normalizeTeamNameForOdds(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) {
    return 0.8;
  }
  return 0;
}

function parseCommenceMs(iso: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function isSameKstDate(game: GameData, odds: OddsData): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(game.date)) return false;
  const oddsKst = instantToKst(odds.commenceTime);
  return oddsKst?.date === game.date;
}

/**
 * GameData.date + startTime(KST HH:mm) 을 UTC ms 로 환산.
 * 허용 오차가 크므로(기본 3h) 실용적으로 충분하다.
 */
function estimateGameCommenceMs(game: GameData): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(game.date)) return null;
  const time =
    /^\d{2}:\d{2}/.test(game.startTime) && game.startTime !== "TBD"
      ? game.startTime.slice(0, 5)
      : "12:00";
  const utc = Date.parse(`${game.date}T${time}:00+09:00`);
  return Number.isFinite(utc) ? utc : null;
}

/**
 * 단일 GameData ↔ OddsData 매칭.
 *
 * 우선순위:
 * 1. 동일 provider externalId === externalEventId → confidence 1.0
 * 2. 홈↔홈, 원정↔원정 팀명 정규화 일치 + 시작 시간 허용 오차
 *
 * 규칙:
 * - 홈/원정 방향이 반대인 경우 매칭하지 않는다 (억지 매칭 금지).
 * - 두 팀 모두 매칭돼야 하며, confidence = min(홈, 원정) 유사도.
 * - minConfidence(기본 0.7) 미만이면 버린다.
 * - KST 경기 날짜가 다르면 동일 매치업이어도 제외.
 * - 시간 정보가 있으면 기존 ±3시간 허용 오차를 벗어난 후보는 제외.
 * - 리그/종목 확인은 호출자가 같은 리그·sportKey 묶음으로 제한해 보장한다.
 */
export function matchOddsToGame(
  game: GameData,
  oddsList: OddsData[],
  options: MatchOddsOptions = {},
): OddsGameMatch | null {
  const tolerance = options.commenceToleranceMs ?? 3 * 60 * 60 * 1000;
  const minConfidence = options.minConfidence ?? 0.7;

  if (game.externalId) {
    const byId = oddsList.find(
      (o) =>
        o.externalEventId === game.externalId && isSameKstDate(game, o),
    );
    if (byId) {
      return { game, odds: byId, confidence: 1, method: "external-id" };
    }
  }

  const gameMs = estimateGameCommenceMs(game);
  let best: OddsGameMatch | null = null;

  for (const odds of oddsList) {
    if (!isSameKstDate(game, odds)) continue;

    // 홈↔홈 / 원정↔원정 방향만 인정. 반대 방향은 매칭하지 않는다.
    const homeScore = teamNameScore(game.homeTeam, odds.homeTeam);
    const awayScore = teamNameScore(game.awayTeam, odds.awayTeam);
    if (homeScore === 0 || awayScore === 0) continue;

    // teams-time 상한 0.9 (정확 0.9 / 포함 0.72)
    const confidence = Math.min(homeScore, awayScore) * 0.9;
    if (confidence < minConfidence) continue;

    if (gameMs != null) {
      const oddsMs = parseCommenceMs(odds.commenceTime);
      if (oddsMs == null) continue;
      if (Math.abs(gameMs - oddsMs) > tolerance) continue;
    }

    if (!best || confidence > best.confidence) {
      best = { game, odds, confidence, method: "teams-time" };
    }
  }

  return best;
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
