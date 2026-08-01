import type { PregameSchedulerStage, RunnerAction } from "../types";

/**
 * KBO T-30 final lock is parameterized via research:kbo-t30-lock
 * (date / prior-run-id / dry-run). Prior tip auto-resolves from prediction.runId.
 * T45 admin personnel remains MANUAL_REQUIRED.
 */
export function kboAction(input: {
  stage: PregameSchedulerStage;
  dateKst: string;
  gameId: string;
  includePostgame: boolean;
  noProvider: boolean;
}): RunnerAction {
  const { stage, dateKst, gameId, includePostgame, noProvider } = input;
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
      // Date-level slate lock (same pattern as MLB remaining-pregame).
      // Do not pass --game-id here — filtering would overwrite the full prediction slate.
      void gameId;
      return {
        kind: "SPAWN_TSX",
        actionId: "RUN_KBO_T30_FINAL_LOCK",
        description:
          "KBO T-30 final pregame lock (parameterized; no Odds API; PASS-only)",
        scriptRel: "scripts/run-kbo-t30-final-pregame-lock-v1.ts",
        args: ["--date", dateKst],
        mayCallProvider: false,
      };
    case "PREGAME_LOCK":
      return {
        kind: "NOOP_CHECK",
        actionId: "KBO_PREGAME_LOCK_CHECK",
        description:
          "Verify existing KBO prediction/PASS snapshot after T-30 lock",
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
