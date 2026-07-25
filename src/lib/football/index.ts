export type {
  FootballAccountStatus,
  FootballProvider,
  FootballProviderKind,
  FootballSource,
  FootballUsageMeta,
  FixtureRaw,
  GetFixturesParams,
  GetFixturesResult,
  GetInjuriesParams,
  GetStandingsParams,
  GetTeamStatisticsParams,
} from "./types";

export {
  FootballApiError,
  emptyFootballUsage,
  parseFootballUsageHeaders,
} from "./football-provider";

export {
  mapFixtureToGame,
  mapFixturesToGames,
  fixtureDateToKst,
} from "./map-fixture-to-game";

export { DummyFootballProvider } from "./dummy-football-provider";
export { ApiFootballProvider } from "./api-football-provider";
export {
  getFootballProvider,
  resolveFootballProviderKind,
} from "./get-football-provider";

export {
  FIXTURES_CACHE_TTL_MS,
  STANDINGS_CACHE_TTL_MS,
  TEAM_STATS_CACHE_TTL_MS,
  SHORT_CACHE_TTL_MS,
} from "./cache";
