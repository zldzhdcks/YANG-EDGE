import { joinStructuredOddsRow } from "../domestic-odds-promotion-v1/join";
import type { FootballScheduleArtifactV1 } from "../football/core/types";
import type { MlbScheduleArtifactDocument } from "../mlb/mlb-schedule-artifact-types";
import type { AssembledBoardRowV2 } from "./extract";

export function joinAssembledRowV2(
  row: AssembledBoardRowV2,
  schedules: {
    footballSchedule: FootballScheduleArtifactV1 | null;
    mlbSchedule: MlbScheduleArtifactDocument | null;
  },
): AssembledBoardRowV2 {
  if (row.homeStatus === "TEAM_TEXT_PARTIAL" || row.awayStatus === "TEAM_TEXT_PARTIAL") {
    return {
      ...row,
      canonicalFixtureId: null,
      joinStatus:
        row.targetDateKst && row.targetDateKst !== row.operatingDateKst
          ? "EXCLUDED_NON_TARGET_DATE"
          : "IDENTITY_REVIEW_REQUIRED",
      predictionInputAllowed: false,
    };
  }
  const joined = joinStructuredOddsRow(row, schedules);
  return {
    ...row,
    ...joined,
    oddsFields: row.oddsFields,
    homeStatus: row.homeStatus,
    awayStatus: row.awayStatus,
    clockAmbiguous: row.clockAmbiguous,
    sourceRoundClaim: row.sourceRoundClaim,
    roundVerified: false,
    predictionInputAllowed: false,
    canonicalFixtureId:
      row.homeStatus === "TEAM_TEXT_VERIFIED" && row.awayStatus === "TEAM_TEXT_VERIFIED"
        ? joined.canonicalFixtureId
        : null,
  };
}
