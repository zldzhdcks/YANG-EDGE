/**
 * Pure V4 Phase 0 coverage evaluator.
 * Does not produce engine scores or player weights.
 */
import { isFootballPlayerIdentityIncomplete } from "../pregame-player-xi-foundation-v1/player-identity";
import type {
  FootballAvailabilityDatasetV1,
  FootballPlayerIdentityStatus,
  FootballV4TemporalStatus,
  FootballXiDatasetV1,
} from "../pregame-player-xi-foundation-v1/types";
import type { FootballPlayerSeasonDatasetV1, FootballSquadSnapshotV1 } from "../player-context-foundation-v1/types";
import type { FootballV4CoverageReportV1, FootballV4CoverageState } from "./types";

function collectIdentityStatuses(input: {
  lineup: FootballXiDatasetV1 | null;
  injury: FootballAvailabilityDatasetV1 | null;
  playerSeason: FootballPlayerSeasonDatasetV1 | null;
  squad: FootballSquadSnapshotV1 | null;
}): FootballPlayerIdentityStatus[] {
  const out: FootballPlayerIdentityStatus[] = [];
  for (const team of input.lineup?.observation.teams ?? []) {
    for (const row of [...team.startingXI, ...team.substitutes]) {
      out.push(row.player.identityStatus);
    }
  }
  for (const row of input.injury?.rows ?? []) out.push(row.player.identityStatus);
  for (const row of input.playerSeason?.rows ?? []) out.push(row.identity.identityStatus);
  for (const row of input.squad?.players ?? []) out.push(row.identityStatus);
  return out;
}

function lineupCoverage(
  lineup: FootballXiDatasetV1 | null,
  blocked: boolean,
  temporalStatus: FootballV4TemporalStatus,
): FootballV4CoverageState {
  if (temporalStatus === "POST_KICKOFF_OBSERVATION" || blocked) return "BLOCKED";
  if (!lineup || lineup.xiAvailabilityStatus === "NOT_AVAILABLE" || lineup.counts.rawRows === 0) {
    return "MISSING";
  }
  if (lineup.xiAvailabilityStatus === "CONFIRMED_XI" && lineup.quality === "COMPLETE") {
    return "READY";
  }
  return "PARTIAL";
}

function injuryCoverage(
  injury: FootballAvailabilityDatasetV1 | null,
  blocked: boolean,
  temporalStatus: FootballV4TemporalStatus,
): FootballV4CoverageState {
  if (temporalStatus === "POST_KICKOFF_OBSERVATION" || blocked) return "BLOCKED";
  if (!injury || injury.counts.rawRows === 0) return "MISSING";
  if (injury.quality === "COMPLETE") return "READY";
  return "PARTIAL";
}

function identityCoverage(
  statuses: FootballPlayerIdentityStatus[],
  blocked: boolean,
): FootballV4CoverageState {
  if (blocked) return "BLOCKED";
  if (statuses.length === 0) return "MISSING";
  if (statuses.every((s) => s === "MATCHED")) return "READY";
  if (statuses.some((s) => isFootballPlayerIdentityIncomplete(s))) return "PARTIAL";
  return "PARTIAL";
}

function temporalCoverage(status: FootballV4TemporalStatus): FootballV4CoverageState {
  if (status === "TEMPORAL_VERIFIED") return "READY";
  if (status === "TEMPORAL_PARTIAL") return "PARTIAL";
  if (status === "TEMPORAL_EVIDENCE_MISSING") return "MISSING";
  return "BLOCKED";
}

function contextCoverage(input: {
  lineup: FootballXiDatasetV1 | null;
  injury: FootballAvailabilityDatasetV1 | null;
  playerSeason: FootballPlayerSeasonDatasetV1 | null;
  squad: FootballSquadSnapshotV1 | null;
  blocked: boolean;
}): FootballV4CoverageState {
  if (input.blocked) return "BLOCKED";
  const present = [
    Boolean(input.lineup && input.lineup.counts.rawRows > 0),
    Boolean(input.injury && input.injury.counts.rawRows > 0),
    Boolean(input.playerSeason && input.playerSeason.counts.rawPlayerItems > 0),
    Boolean(input.squad && input.squad.players.length > 0),
  ];
  const n = present.filter(Boolean).length;
  if (n === 0) return "MISSING";
  if (n === present.length) return "READY";
  return "PARTIAL";
}

export function evaluateFootballV4Phase0Coverage(input: {
  lineup?: FootballXiDatasetV1 | null;
  injury?: FootballAvailabilityDatasetV1 | null;
  playerSeason?: FootballPlayerSeasonDatasetV1 | null;
  squad?: FootballSquadSnapshotV1 | null;
  temporalStatus: FootballV4TemporalStatus;
  identityGateBlocked?: boolean;
}): FootballV4CoverageReportV1 {
  const lineup = input.lineup ?? null;
  const injury = input.injury ?? null;
  const playerSeason = input.playerSeason ?? null;
  const squad = input.squad ?? null;
  const blocked = input.identityGateBlocked === true;
  const statuses = collectIdentityStatuses({ lineup, injury, playerSeason, squad });

  return {
    lineupCoverage: lineupCoverage(lineup, blocked, input.temporalStatus),
    injuryCoverage: injuryCoverage(injury, blocked, input.temporalStatus),
    identityCoverage: identityCoverage(statuses, blocked),
    temporalCoverage: temporalCoverage(input.temporalStatus),
    contextCoverage: contextCoverage({ lineup, injury, playerSeason, squad, blocked }),
    engineAdmission: false,
    playerImpactScore: null,
    playerStrengthScore: null,
    lineupStrength: null,
    injuryPenalty: null,
    goalkeeperWeight: null,
    starPlayerWeight: null,
    availabilityWeight: null,
  };
}
