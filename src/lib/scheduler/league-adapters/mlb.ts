import type { PregameSchedulerStage, RunnerAction } from "../types";

export function mlbAction(input: {
  stage: PregameSchedulerStage;
  dateKst: string;
  gameId: string;
  includePostgame: boolean;
  noProvider: boolean;
}): RunnerAction {
  const { stage, dateKst, includePostgame, noProvider } = input;
  const providerNote = noProvider
    ? " (--no-provider: spawn skipped at orchestrator)"
    : "";

  switch (stage) {
    case "SCHEDULE_DISCOVERY":
      return {
        kind: "SPAWN_TSX",
        actionId: "RUN_MLB_SCHEDULE",
        description: `Build MLB schedule artifact${providerNote}`,
        scriptRel: "scripts/build-mlb-schedule-artifact-v1.ts",
        args: [dateKst],
        mayCallProvider: !noProvider,
      };
    case "T90_COLLECTION":
      return {
        kind: "SPAWN_TSX",
        actionId: "RUN_MLB_STARTER_ACCUMULATION",
        description: `MLB starter + early pregame inputs${providerNote}`,
        scriptRel: "scripts/run-mlb-starter-accumulation-with-summary-v1.ts",
        args: [dateKst],
        mayCallProvider: !noProvider,
      };
    case "T60_REFRESH":
      return {
        kind: "SPAWN_TSX",
        actionId: "RUN_MLB_ODDS_REFRESH",
        description: `MLB odds history refresh${providerNote}`,
        scriptRel: "scripts/build-mlb-odds-history-dataset-v1.ts",
        args: [dateKst],
        mayCallProvider: !noProvider,
      };
    case "T45_LINEUP_CHECK":
      return {
        kind: "SPAWN_TSX",
        actionId: "RUN_MLB_LINEUP",
        description: `MLB lineup dataset${providerNote}`,
        scriptRel: "scripts/build-mlb-lineup-dataset-v1.ts",
        args: [dateKst],
        mayCallProvider: !noProvider,
      };
    case "T30_FINAL_CHECK":
      return {
        kind: "SPAWN_TSX",
        actionId: "RUN_MLB_REMAINING_PREGAME",
        description: `MLB remaining pregame accumulation${providerNote}`,
        scriptRel: "scripts/run-mlb-remaining-pregame-accumulation-v1.ts",
        args: [dateKst],
        mayCallProvider: !noProvider,
      };
    case "PREGAME_LOCK":
      return {
        kind: "SPAWN_TSX",
        actionId: "RUN_MLB_PREDICTION_SNAPSHOT",
        description: "MLB prediction snapshot (consumer; no Engine change)",
        scriptRel: "scripts/build-mlb-prediction-snapshot-v1.ts",
        args: [dateKst],
        mayCallProvider: false,
      };
    case "WAITING_FOR_FINAL":
      return {
        kind: "NOOP_CHECK",
        actionId: "WAIT_FINAL",
        description: "Waiting for FINAL; no runner",
        mayCallProvider: false,
      };
    case "POSTGAME_COLLECTION":
    case "POSTGAME_REVIEW":
      if (!includePostgame) {
        return {
          kind: "NOOP_CHECK",
          actionId: "READY_FOR_POSTGAME",
          description:
            "Postgame ready; pass --include-postgame to run review:mlb-daily",
          mayCallProvider: false,
        };
      }
      return {
        kind: "SPAWN_TSX",
        actionId: "RUN_MLB_DAILY_REVIEW",
        description: "MLB daily review (result/grade/success/failure)",
        scriptRel: "scripts/run-mlb-review-daily-v1.ts",
        args: [dateKst],
        mayCallProvider: !noProvider,
      };
    case "COMPLETE":
      return {
        kind: "NOOP_CHECK",
        actionId: "COMPLETE",
        description: "Game scheduler complete",
        mayCallProvider: false,
      };
    default:
      return {
        kind: "NOT_IMPLEMENTED",
        actionId: "MLB_STAGE_UNKNOWN",
        description: `MLB stage not mapped: ${stage}`,
        mayCallProvider: false,
      };
  }
}
