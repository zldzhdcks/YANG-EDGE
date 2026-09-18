import type { PregameSchedulerStage, RunnerAction } from "../types";

export const MLB_DAILY_OPS_SCRIPT_REL = "scripts/run-mlb-daily-ops-v1.ts";

export const MLB_SCHEDULER_STAGE_TO_DAILY_OPS_WINDOW = {
  T90_COLLECTION: "T90",
  T60_REFRESH: "T60",
  T45_LINEUP_CHECK: "T45",
  T30_FINAL_CHECK: "T30",
  PREGAME_LOCK: "LOCK",
} as const;

export type MlbDailyOpsDelegatedWindow =
  (typeof MLB_SCHEDULER_STAGE_TO_DAILY_OPS_WINDOW)[keyof typeof MLB_SCHEDULER_STAGE_TO_DAILY_OPS_WINDOW];

export function mlbDailyOpsWindowForStage(
  stage: PregameSchedulerStage,
): MlbDailyOpsDelegatedWindow | null {
  if (stage in MLB_SCHEDULER_STAGE_TO_DAILY_OPS_WINDOW) {
    return MLB_SCHEDULER_STAGE_TO_DAILY_OPS_WINDOW[
      stage as keyof typeof MLB_SCHEDULER_STAGE_TO_DAILY_OPS_WINDOW
    ];
  }
  return null;
}

export function isMlbDelegatedPregameStage(stage: PregameSchedulerStage): boolean {
  return mlbDailyOpsWindowForStage(stage) != null;
}

export function buildMlbDailyOpsRunnerAction(input: {
  dateKst: string;
  window: MlbDailyOpsDelegatedWindow;
  gameIds: string[];
  noProvider: boolean;
  quotaRemaining?: number | null;
  quotaSource?: "CLI" | "RECEIPT" | "NONE";
  rehearsal?: boolean;
  rehearsalAsOf?: string;
  unattended?: boolean;
}): RunnerAction {
  const args = ["--date", input.dateKst, "--window", input.window];
  for (const id of input.gameIds) {
    args.push("--game-id", id);
  }
  const forwardCliQuota =
    input.quotaSource !== "RECEIPT" &&
    input.quotaSource !== "NONE" &&
    input.quotaRemaining != null;
  if (forwardCliQuota) {
    args.push("--quota-remaining", String(input.quotaRemaining));
  }
  if (input.noProvider || input.rehearsal) {
    args.push("--no-provider");
  }
  if (input.rehearsal) {
    args.push("--no-write", "--no-seal");
    if (input.rehearsalAsOf) {
      args.push("--rehearsal-as-of", input.rehearsalAsOf);
    }
  } else if (input.unattended) {
    args.push("--unattended");
  }
  return {
    kind: "SPAWN_TSX",
    actionId: "RUN_MLB_DAILY_OPS",
    description: `MLB Daily Ops --window ${input.window}`,
    scriptRel: MLB_DAILY_OPS_SCRIPT_REL,
    args,
    mayCallProvider: input.window !== "LOCK",
    providerGuard: "DELEGATED",
    safeWhenNoProvider: true,
  };
}

export function mlbAction(input: {
  stage: PregameSchedulerStage;
  dateKst: string;
  gameId: string;
  includePostgame: boolean;
  noProvider: boolean;
  quotaRemaining?: number | null;
  quotaSource?: "CLI" | "RECEIPT" | "NONE";
  rehearsal?: boolean;
  rehearsalAsOf?: string;
  unattended?: boolean;
}): RunnerAction {
  const { stage, dateKst, includePostgame, noProvider } = input;
  const providerNote = noProvider
    ? " (--no-provider: child still runs; Daily Ops skips providers)"
    : "";

  const delegatedWindow = mlbDailyOpsWindowForStage(stage);
  if (delegatedWindow) {
    return buildMlbDailyOpsRunnerAction({
      dateKst,
      window: delegatedWindow,
      gameIds: [input.gameId],
      noProvider,
      quotaRemaining: input.quotaRemaining,
      quotaSource: input.quotaSource,
      rehearsal: input.rehearsal,
      rehearsalAsOf: input.rehearsalAsOf,
      unattended: input.unattended,
    });
  }

  switch (stage) {
    case "SCHEDULE_DISCOVERY":
      if (input.unattended) {
        return {
          kind: "MANUAL_REQUIRED",
          actionId: "LEGAL_PROVIDER_AUTOMATION_BLOCKED",
          description:
            "Unattended MLB Stats API schedule bootstrap is legally blocked",
          mayCallProvider: false,
        };
      }
      return {
        kind: "SPAWN_TSX",
        actionId: "RUN_MLB_SCHEDULE",
        description: `Build MLB schedule artifact${providerNote}`,
        scriptRel: "scripts/build-mlb-schedule-artifact-v1.ts",
        args: [dateKst],
        mayCallProvider: !noProvider,
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
