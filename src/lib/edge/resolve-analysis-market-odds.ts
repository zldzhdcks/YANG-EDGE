import type { AnalysisData as EngineAnalysisData } from "@/types/engine-analysis";
import type { GameData } from "@/types/game";
import type { DecimalOddsInput } from "@/lib/market";
import {
  getOddsProvider,
  matchOddsToGame,
  resolveSportKeysForLeagues,
  type OddsData,
} from "@/lib/odds";
import { TEAM_ALIASES, normalizeTeamName } from "@/lib/teams";

/**
 * 분석 상세용 배당 조회.
 * OddsProvider / 매칭 유틸은 수정하지 않고 호출만 한다.
 * 실패·미매칭 시 null → Value Edge 미표시.
 */

/** 한글/별칭 → Odds API 영문 원문명 (매칭용, UI 표시와 무관) */
function toOddsFacingName(name: string): string {
  const key = normalizeTeamName(name);
  for (const entry of TEAM_ALIASES) {
    const hit =
      normalizeTeamName(entry.displayName) === key ||
      entry.originalNames.some((n) => normalizeTeamName(n) === key);
    if (!hit) continue;
    const english = entry.originalNames.find((n) => /[A-Za-z]/.test(n));
    if (english) return english;
  }
  return name;
}

function toMatchGame(engineInput: EngineAnalysisData): GameData {
  return {
    id: engineInput.gameId,
    sport: "baseball",
    league: engineInput.league,
    homeTeam: toOddsFacingName(engineInput.homeTeam),
    awayTeam: toOddsFacingName(engineInput.awayTeam),
    startTime: engineInput.startTime,
    date: engineInput.date,
    aiAnalysisAvailable: true,
  };
}

function toDecimalOdds(odds: OddsData): DecimalOddsInput | null {
  if (odds.bestHomeOdds == null || odds.bestAwayOdds == null) return null;
  return {
    homeOdds: odds.bestHomeOdds,
    awayOdds: odds.bestAwayOdds,
  };
}

/**
 * 야구 분석 경기의 2-way 최고 배당.
 * 축구·조회 실패·매칭 실패 → null
 */
export async function resolveAnalysisMarketOdds(
  engineInput: EngineAnalysisData,
): Promise<DecimalOddsInput | null> {
  if (engineInput.sport !== "baseball") return null;

  try {
    const provider = getOddsProvider();
    const resolved = await resolveSportKeysForLeagues(provider, {
      baseball: [engineInput.league],
      football: [],
    });
    const target = resolved[0];
    if (!target) return null;

    const { events } = await provider.getOdds({
      sportKey: target.sportKey,
      regions: "eu",
      markets: "h2h",
    });

    const match = matchOddsToGame(toMatchGame(engineInput), events, {
      // 분석 더미 날짜와 Odds commence 가 어긋나도 동일 카드만 매칭
      commenceToleranceMs: 7 * 24 * 60 * 60 * 1000,
    });
    if (!match) return null;
    return toDecimalOdds(match.odds);
  } catch {
    // Odds 실패는 분석 화면을 막지 않는다
    return null;
  }
}
