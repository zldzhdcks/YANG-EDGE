import type {
  PregameSchedulerStage,
  RunnerAction,
  SchedulerLeague,
} from "../types";
import { kboAction } from "./kbo";
import { mlbAction } from "./mlb";
import { npbAction } from "./npb";

export function resolveLeagueAction(input: {
  league: SchedulerLeague;
  stage: PregameSchedulerStage;
  dateKst: string;
  gameId: string;
  includePostgame: boolean;
  noProvider: boolean;
}): RunnerAction {
  switch (input.league) {
    case "MLB":
      return mlbAction(input);
    case "KBO":
      return kboAction(input);
    case "NPB":
      return npbAction(input);
  }
}

export { mlbAction, kboAction, npbAction };
