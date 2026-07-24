export type {
  GetGamesParams,
  SportsProvider,
  SportsProviderKind,
  TotoData,
} from "./types";
export { DummyProvider } from "./dummy-provider";
export {
  TheSportsDbProvider,
  SportsApiError,
} from "./thesportsdb-provider";
export { ApiSportsProvider } from "./apisports-provider";
export {
  getSportsProvider,
  resolveSportsProviderKind,
} from "./get-provider";
