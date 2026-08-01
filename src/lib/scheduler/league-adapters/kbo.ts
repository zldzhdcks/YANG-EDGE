import type { PregameSchedulerStage, RunnerAction } from "../types";

/**
 * KBO T-30 uses Option B: MANUAL_REQUIRED.
 * scripts/run-kbo-t30-final-pregame-lock-v1.ts is not scheduler-ready
 * (hardcoded date / PREV_RUN; implicit any). Do not auto-spawn in v1.
 */
export function kboAction(input: {
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
    args: ["--league", "KBO", "--date", dateKst],
    mayCallProvider: !noProvider,
  };

  switch (stage) {
    case "SCHEDULE_DISCOVERY":
    case "T90_COLLECTION":
      return {
        ...immediate,
        actionId: "RUN_KBO_IMMEDIATE_PREGAME",
        description:
          "KBO immediate pregame accumulation (schedule/odds/starter path)",
      };
    case "T60_REFRESH":
      return {
        ...immediate,
        actionId: "RUN_KBO_ODDS_REFRESH",
        description: "KBO overseas/domestic odds refresh via immediate runner",
      };
    case "T45_LINEUP_CHECK":
      return {
        kind: "MANUAL_REQUIRED",
        actionId: "KBO_ADMIN_PERSONNEL_REVISION",
        description:
          "KBO admin personnel revision is operator-driven; Scheduler does not auto-apply",
        mayCallProvider: false,
      };
    case "T30_FINAL_CHECK":
      return {
        kind: "MANUAL_REQUIRED",
        actionId: "KBO_T30_MANUAL_REQUIRED",
        description:
          "KBO T-30 final lock runner is MANUAL_REQUIRED (hardcoded PREV_RUN); not auto-invoked in Scheduler v1",
        mayCallProvider: false,
      };
    case "PREGAME_LOCK":
      return {
        kind: "NOOP_CHECK",
        actionId: "KBO_PREGAME_LOCK_CHECK",
        description:
          "Verify existing KBO prediction/PASS snapshot; no new lock builder in v1",
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
          description:
            "Pass --include-postgame to run research:kbo-postgame-identity",
          mayCallProvider: false,
        };
      }
      return {
        kind: "SPAWN_TSX",
        actionId: "RUN_KBO_POSTGAME_IDENTITY",
        description: "KBO postgame identity runner",
        scriptRel: "scripts/run-kbo-postgame-identity-v1.ts",
        args: [dateKst],
        mayCallProvider: !noProvider,
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
        actionId: "KBO_STAGE_UNKNOWN",
        description: `KBO stage not mapped: ${stage}`,
        mayCallProvider: false,
      };
  }
}
