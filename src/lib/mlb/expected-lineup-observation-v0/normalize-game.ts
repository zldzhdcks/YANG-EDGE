/**
 * Normalize legacy expected-lineup game rows missing observationStatus.
 */
import type {
  MlbExpectedLineupGameObservationStatus,
  MlbExpectedLineupGameV0,
  MlbExpectedLineupObservationV0,
} from "./types";

export function inferExpectedLineupGameObservationStatus(
  game: Pick<MlbExpectedLineupGameV0, "observationStatus" | "awayLineup" | "homeLineup">,
): MlbExpectedLineupGameObservationStatus {
  if (game.observationStatus === "OBSERVED") return "OBSERVED";
  if (game.observationStatus === "NOT_OBSERVED") return "NOT_OBSERVED";
  return game.awayLineup.length === 9 && game.homeLineup.length === 9
    ? "OBSERVED"
    : "NOT_OBSERVED";
}

export function normalizeExpectedLineupGame(
  game: MlbExpectedLineupGameV0,
): MlbExpectedLineupGameV0 {
  return {
    ...game,
    observationStatus: inferExpectedLineupGameObservationStatus(game),
  };
}

export function normalizeExpectedLineupObservation(
  doc: MlbExpectedLineupObservationV0,
): MlbExpectedLineupObservationV0 {
  return {
    ...doc,
    games: doc.games.map(normalizeExpectedLineupGame),
  };
}
