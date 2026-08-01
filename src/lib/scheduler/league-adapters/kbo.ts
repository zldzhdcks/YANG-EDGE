import { existsSync, readFileSync } from "node:fs";
import type { PregameSchedulerStage, RunnerAction } from "../types";
import { defaultPersonnelInputPath } from "../../kbo/t45-personnel/paths";
import { probePersonnelInputFile } from "../../kbo/t45-personnel/validate-personnel-input";

/**
 * KBO T-30 final lock is parameterized via research:kbo-t30-lock.
 * T45: spawn personnel workflow when validated input file exists;
 * MANUAL_INPUT_REQUIRED when missing; INPUT_VALIDATION_FAILED when invalid.
 * Scheduler never invents admin personnel/proto data.
 */
export function kboAction(input: {
  stage: PregameSchedulerStage;
  dateKst: string;
  gameId: string;
  includePostgame: boolean;
  noProvider: boolean;
  cwd?: string;
}): RunnerAction {
  const { stage, dateKst, gameId, includePostgame, noProvider } = input;
  const cwd = input.cwd ?? process.cwd();
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
    case "T45_LINEUP_CHECK": {
      const inputPath = defaultPersonnelInputPath(dateKst, cwd);
      let raw: string | null = null;
      if (existsSync(inputPath)) {
        try {
          raw = readFileSync(inputPath, "utf8");
        } catch {
          raw = null;
        }
      }
      const probe = probePersonnelInputFile(raw);
      if (probe.status === "MISSING") {
        return {
          kind: "MANUAL_REQUIRED",
          actionId: "MANUAL_INPUT_REQUIRED",
          description:
            "KBO T45 personnel input file missing; admin must supply personnel-input-v1.json",
          mayCallProvider: false,
        };
      }
      if (probe.status === "INVALID") {
        return {
          kind: "INPUT_VALIDATION_FAILED",
          actionId: "INPUT_VALIDATION_FAILED",
          description: `KBO T45 personnel input failed probe: ${probe.reason}`,
          mayCallProvider: false,
        };
      }
      return {
        kind: "SPAWN_TSX",
        actionId: "RUN_KBO_T45_PERSONNEL_WORKFLOW",
        description:
          "KBO T45 admin personnel / domestic proto workflow (no provider)",
        scriptRel: "scripts/run-kbo-t45-personnel-workflow-v1.ts",
        args: ["--date", dateKst, "--input", inputPath],
        mayCallProvider: false,
      };
    }
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
