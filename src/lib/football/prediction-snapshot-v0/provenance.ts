/**
 * Cross-artifact provenance for a selected Odds observation vs Schedule row.
 * Exact equality only. No display-name / fuzzy / timestamp tolerance.
 */
import type { FootballScheduleRowV1 } from "../core/types";
import type { Football1x2OddsObservationV1 } from "../odds-1x2-v1/types";

export function assertFrozenOddsObservationProvenance(input: {
  row: FootballScheduleRowV1;
  observation: Football1x2OddsObservationV1;
  scheduleArtifactHash: string;
}): void {
  const { row, observation: obs, scheduleArtifactHash } = input;

  if (obs.matchId !== row.matchId) {
    throw new Error(
      `FOOTBALL_SNAPSHOT_ODDS_MATCH_ID_MISMATCH: schedule=${row.matchId} observation=${obs.matchId}`,
    );
  }
  if (obs.apiFootballProviderMatchId !== row.providerMatchId) {
    throw new Error(
      `FOOTBALL_SNAPSHOT_ODDS_PROVIDER_MATCH_ID_MISMATCH: schedule=${row.providerMatchId} observation=${obs.apiFootballProviderMatchId}`,
    );
  }
  if (obs.competitionId !== row.competitionId) {
    throw new Error(
      `FOOTBALL_SNAPSHOT_ODDS_COMPETITION_MISMATCH: schedule=${row.competitionId} observation=${obs.competitionId}`,
    );
  }
  if (obs.homeTeamId !== row.homeTeamId) {
    throw new Error(
      `FOOTBALL_SNAPSHOT_ODDS_HOME_TEAM_MISMATCH: schedule=${row.homeTeamId} observation=${obs.homeTeamId}`,
    );
  }
  if (obs.awayTeamId !== row.awayTeamId) {
    throw new Error(
      `FOOTBALL_SNAPSHOT_ODDS_AWAY_TEAM_MISMATCH: schedule=${row.awayTeamId} observation=${obs.awayTeamId}`,
    );
  }
  if (obs.scheduleKickoffTimeUtc !== row.kickoffTimeUtc) {
    throw new Error(
      `FOOTBALL_SNAPSHOT_ODDS_KICKOFF_MISMATCH: schedule=${row.kickoffTimeUtc} observation=${obs.scheduleKickoffTimeUtc}`,
    );
  }
  if (obs.sourceScheduleArtifactHash !== scheduleArtifactHash) {
    throw new Error(
      `FOOTBALL_SNAPSHOT_ODDS_SCHEDULE_HASH_MISMATCH: schedule=${scheduleArtifactHash} observation=${obs.sourceScheduleArtifactHash}`,
    );
  }
}
