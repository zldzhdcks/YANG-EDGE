export {
  FOOTBALL_ODDS_BRIDGE_INTAKE_V1_BUILDER,
  FOOTBALL_ODDS_BRIDGE_INTAKE_V1_SCHEMA,
  FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES,
  type FootballOddsBridgeCandidateEvent,
  type FootballOddsBridgeCandidateMapping,
  type FootballOddsBridgeCandidateRow,
  type FootballOddsBridgeCandidateStatus,
  type FootballOddsBridgeIntakeArtifactV1,
} from "./types";

export {
  assembleFootballOddsBridgeCandidateIntake,
  assertLiveOddsBridgeIntakeProvider,
  buildFootballOddsBridgeCandidateIntakeV1,
  classifyIntakeEligibility,
  matchBridgeIntakeEvents,
  sportKeysForIntakeTargets,
} from "./build";
export { computeFootballOddsBridgeIntakeArtifactHash } from "./hash";
export { footballOddsBridgeCandidateIntakeV1Rel } from "./paths";
