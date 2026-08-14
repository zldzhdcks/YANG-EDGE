export {
  FOOTBALL_OFFICIAL_RESULT_MARKET_SETTLEMENT,
  FOOTBALL_OFFICIAL_RESULT_PROVIDER,
  FOOTBALL_OFFICIAL_RESULT_V0_BUILDER,
  FOOTBALL_OFFICIAL_RESULT_V0_SCHEMA,
  type FootballOfficialResultArtifactV0,
  type FootballOfficialResultFixtureFetch,
  type FootballOfficialResultFixtureFetcher,
  type FootballOfficialResultMatchV0,
  type FootballOfficialResultRunOutcome,
  type FootballOfficialResultRunV0,
} from "./types";

export {
  buildFootballOfficialResultV0,
  buildFootballResultInputFromProvider,
  identityFromScheduleRow,
  resolveOfficialResultMatch,
  selectOfficialResultTargetRows,
} from "./build";
export {
  computeFootballOfficialResultArtifactHash,
  omitVolatileOfficialResultMeta,
} from "./hash";
export { footballOfficialResultV0Rel } from "./paths";
export {
  isApiFootballTerminalFinalShort,
  isNonFinalTerminalStatus,
  isWaitingFinalStatus,
  mapApiFootballShortStatusToResultStatus,
} from "./map-provider-status";
export {
  extractApiFootballProviderAdvancementWinner,
  extractApiFootballResultScores,
  scorePairOrNull,
} from "./extract-scores";
export { joinProviderFixtureToScheduleRow } from "./join-schedule";
export { loadFootballScheduleArtifactForOfficialResult } from "./load-schedule";
