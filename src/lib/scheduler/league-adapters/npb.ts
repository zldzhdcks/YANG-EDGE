import type { PregameSchedulerStage, RunnerAction } from "../types";

export function npbAction(input: {
  stage: PregameSchedulerStage;
  dateKst: string;
  gameId: string;
  includePostgame: boolean;
  noProvider: boolean;
}): RunnerAction {
  const { stage, dateKst, includePostgame, noProvider } = input;
  const immediate = {
    kind: "SPAWN_TSX" as const,
    scriptRel: "scripts/run-npb-kbo-immediate-pregame-accumulation-v1.ts",
    args: ["--league", "NPB", "--date", dateKst],
    mayCallProvider: !noProvider,
  };

  switch (stage) {
    case "SCHEDULE_DISCOVERY":
    case "T90_COLLECTION":
      return {
        ...immediate,
        actionId: "RUN_NPB_IMMEDIATE_PREGAME",
        description: "NPB immediate pregame (schedule freeze / odds path)",
      };
    case "T60_REFRESH":
      return {
        ...immediate,
        actionId: "RUN_NPB_ODDS_REFRESH",
        description: "NPB odds refresh via immediate runner",
      };
    case "T45_LINEUP_CHECK":
      return {
        kind: "NOT_IMPLEMENTED",
        actionId: "NPB_LINEUP_NOT_SUPPORTED",
        description:
          "NPB lineup SOURCE_NOT_SUPPORTED — Scheduler records NOT_IMPLEMENTED",
        mayCallProvider: false,
      };
    case "T30_FINAL_CHECK":
      return {
        ...immediate,
        actionId: "RUN_NPB_T30_PREGAME",
        description:
          "NPB final pregame attempt via immediate runner (PASS path)",
      };
    case "PREGAME_LOCK":
      return {
        kind: "NOOP_CHECK",
        actionId: "NPB_PREGAME_LOCK_CHECK",
        description: "Verify NPB prediction PASS artifact if present",
        mayCallProvider: false,
      };
    case "WAITING_FOR_FINAL":
      return {
        kind: "NOOP_CHECK",
        actionId: "WAIT_FINAL",
        description: "Waiting for FINAL",
        mayCallProvider: false,
      };
    case "POSTGAME_COLLECTION":
    case "POSTGAME_REVIEW":
      if (!includePostgame) {
        return {
          kind: "NOOP_CHECK",
          actionId: "READY_FOR_POSTGAME",
          description: "NPB postgame identity not implemented in v1",
          mayCallProvider: false,
        };
      }
      return {
        kind: "NOT_IMPLEMENTED",
        actionId: "NPB_POSTGAME_NOT_IMPLEMENTED",
        description: "NPB postgame runner missing — NOT_IMPLEMENTED",
        mayCallProvider: false,
      };
    case "COMPLETE":
      return {
        kind: "NOOP_CHECK",
        actionId: "COMPLETE",
        description: "Complete",
        mayCallProvider: false,
      };
    default:
      return {
        kind: "NOT_IMPLEMENTED",
        actionId: "NPB_STAGE_UNKNOWN",
        description: `NPB stage not mapped: ${stage}`,
        mayCallProvider: false,
      };
  }
}
