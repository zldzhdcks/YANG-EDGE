import type { GameData } from "@/types/game";
import { buildGameId } from "@/lib/game-id";
import { getKstDateString } from "@/lib/datetime/kst";
import type { FixtureRaw } from "./types";

const KST_TIME_ZONE = "Asia/Seoul";

const KST_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: KST_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * API-Football fixture.date (ISO) → KST 날짜·시각.
 * timezone=Asia/Seoul 로 요청해도 date 문자열은 ISO 오프셋을 포함할 수 있다.
 */
export function fixtureDateToKst(isoDate: string): {
  date: string;
  startTime: string;
} {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) {
    const datePart = isoDate.slice(0, 10);
    return {
      date: /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : getKstDateString(),
      startTime: "TBD",
    };
  }

  return {
    date: getKstDateString(d),
    startTime: KST_TIME_FORMATTER.format(d),
  };
}

/**
 * API-Football fixture → YANG EDGE GameData
 *
 * - fixture.id → externalId
 * - league.name → league
 * - teams.*.name → home/away
 * - sport → football
 * - externalProvider → api-football
 * - 분석 데이터 없음 → aiAnalysisAvailable=false
 * - id → buildGameId(league, home, away)
 */
export function mapFixtureToGame(fixture: FixtureRaw): GameData | null {
  const fixtureId = fixture.fixture?.id;
  const home = fixture.teams?.home?.name?.trim();
  const away = fixture.teams?.away?.name?.trim();
  const league = fixture.league?.name?.trim();

  if (!fixtureId || !home || !away || !league) return null;

  const { date, startTime } = fixtureDateToKst(fixture.fixture.date || "");

  return {
    id: buildGameId(league, home, away),
    sport: "football",
    league,
    homeTeam: home,
    awayTeam: away,
    startTime,
    date,
    aiAnalysisAvailable: false,
    externalId: String(fixtureId),
    externalProvider: "api-football",
  };
}

export function mapFixturesToGames(fixtures: FixtureRaw[]): GameData[] {
  return fixtures
    .map(mapFixtureToGame)
    .filter((g): g is GameData => g !== null);
}
