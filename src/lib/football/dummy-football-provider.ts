import { emptyFootballUsage } from "./football-provider";
import { mapFixtureToGame, mapFixturesToGames } from "./map-fixture-to-game";
import type {
  FootballAccountStatus,
  FootballProvider,
  GetFixturesParams,
  GetFixturesResult,
  GetInjuriesParams,
  GetStandingsParams,
  GetTeamStatisticsParams,
} from "./types";

/**
 * 개발·단위 테스트용 Dummy Football.
 * FOOTBALL_PROVIDER=dummy 명시 선택 시에만 사용.
 * fixtures 는 빈 배열 — 가짜 경기를 섞지 않는다.
 */
export class DummyFootballProvider implements FootballProvider {
  readonly kind = "dummy" as const;

  async getFixtures(params: GetFixturesParams): Promise<GetFixturesResult> {
    return {
      fixtures: [],
      games: [],
      usage: emptyFootballUsage(),
      cached: false,
      fetchedAt: new Date().toISOString(),
      source: "dummy",
      params,
    };
  }

  async getFixtureById(fixtureId: number) {
    void fixtureId;
    return {
      fixture: null,
      game: null,
      usage: emptyFootballUsage(),
      cached: false,
    };
  }

  async getStandings(params: GetStandingsParams) {
    void params;
    return { raw: [], usage: emptyFootballUsage(), cached: false };
  }

  async getTeamStatistics(params: GetTeamStatisticsParams) {
    void params;
    return { raw: null, usage: emptyFootballUsage(), cached: false };
  }

  async getInjuries(params: GetInjuriesParams) {
    void params;
    return { raw: [], usage: emptyFootballUsage(), cached: false };
  }

  async getLineups(params: { fixtureId: number }) {
    void params;
    return { raw: [], usage: emptyFootballUsage(), cached: false };
  }

  async getStatus(): Promise<{
    status: FootballAccountStatus;
    usage: ReturnType<typeof emptyFootballUsage>;
  }> {
    return {
      status: {
        account: { firstname: "Dummy", lastname: null, email: null },
        subscription: { plan: "dummy", end: null, active: true },
        requests: { current: 0, limitDay: 100 },
        rawErrors: [],
      },
      usage: emptyFootballUsage(),
    };
  }
}

/** 매퍼 단위 테스트용 — Dummy fixtures 경로에는 넣지 않음 */
export function sampleFixtureForMapperTest() {
  const raw = {
    fixture: {
      id: 999001,
      date: "2026-07-25T11:00:00+00:00",
      timezone: "UTC",
      status: { long: "Not Started", short: "NS", elapsed: null },
    },
    league: {
      id: 39,
      name: "Premier League",
      country: "England",
      season: 2025,
      round: "Regular Season - 1",
    },
    teams: {
      home: { id: 42, name: "Arsenal", winner: null },
      away: { id: 40, name: "Liverpool", winner: null },
    },
    goals: { home: null, away: null },
  };
  return { raw, game: mapFixtureToGame(raw), games: mapFixturesToGames([raw]) };
}
