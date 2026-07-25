export type {
  GetOddsParams,
  GetOddsResult,
  OddsBookmaker,
  OddsData,
  OddsMarket,
  OddsOutcome,
  OddsProvider,
  OddsProviderKind,
  OddsSource,
  OddsSportInfo,
  OddsUsageMeta,
} from "./types";

export {
  buildOddsData,
  computeBestH2hOdds,
  emptyUsage,
  impliedProbabilityFromDecimal,
  oddsCacheKey,
  parseUsageHeaders,
} from "./odds-provider";

export { DummyOddsProvider } from "./dummy-odds-provider";
export {
  TheOddsApiProvider,
  OddsApiError,
} from "./the-odds-api-provider";
export {
  getOddsProvider,
  resolveOddsProviderKind,
} from "./get-odds-provider";
export {
  matchOddsToGame,
  matchOddsToGames,
  normalizeTeamNameForOdds,
  type MatchOddsOptions,
  type OddsGameMatch,
} from "./match-odds-to-game";
export { ODDS_CACHE_TTL_MS } from "./cache";
