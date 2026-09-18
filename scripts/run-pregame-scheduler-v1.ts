/**
 * Pregame Scheduler v1 CLI
 *
 * npm run scheduler:pregame -- --date 2026-08-01 --league MLB --dry-run
 *
 * Rehearsal (MLB only, control-plane, not research evidence):
 * npm run scheduler:pregame -- --date 2026-08-20 --league MLB --gameId mlb-game-824801 --rehearsal --rehearsal-as-of 2026-08-19T21:00:00Z --json
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnLocalTsxScript } from "./lib/spawn-local-tsx";
import {
  formatDryRunText,
  runPregameScheduler,
} from "../src/lib/scheduler";
import { parseMlbDailyOpsQuotaRemaining } from "../src/lib/mlb/daily-pregame-v0";
import type {
  OrchestratorOptions,
  PregameSchedulerStage,
  SchedulerLeague,
  RunnerAction,
} from "../src/lib/scheduler/types";

export const REHEARSAL_NOT_RESEARCH_EVIDENCE =
  "REHEARSAL_NOT_RESEARCH_EVIDENCE";

function usage(): never {
  console.error(`Usage:
  npm run scheduler:pregame -- --date YYYY-MM-DD --league MLB|KBO|NPB|ALL [options]

Options:
  --dry-run
  --force-stage <STAGE>
  --gameId <id>
  --no-provider
  --include-postgame
  --json
  --quota-remaining <non-negative integer>
  --rehearsal
  --rehearsal-as-of <ISO>
  --unattended
`);
  process.exit(2);
}

export function parseRehearsalAsOfIso(raw: string): string {
  const s = raw.trim();
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(s)
  ) {
    throw new Error(`REHEARSAL_AS_OF_INVALID_ISO:${raw}`);
  }
  const t = Date.parse(s);
  if (!Number.isFinite(t)) {
    throw new Error(`REHEARSAL_AS_OF_INVALID_ISO:${raw}`);
  }
  return s;
}

export function parsePregameSchedulerCliArgs(argv: string[]): OrchestratorOptions {
  let dateKst = "";
  let league: SchedulerLeague | "ALL" = "MLB";
  let dryRun = false;
  let forceStage: PregameSchedulerStage | undefined;
  let gameId: string | undefined;
  let noProvider = false;
  let includePostgame = false;
  let json = false;
  let quotaRemaining: number | null = null;
  let rehearsal = false;
  let rehearsalAsOfRaw: string | undefined;
  let unattended = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--date") dateKst = argv[++i] ?? "";
    else if (a === "--league") {
      const v = (argv[++i] ?? "").toUpperCase();
      if (v !== "MLB" && v !== "KBO" && v !== "NPB" && v !== "ALL") usage();
      league = v;
    } else if (a === "--dry-run") dryRun = true;
    else if (a === "--force-stage") {
      forceStage = argv[++i] as PregameSchedulerStage;
    } else if (a === "--gameId") gameId = argv[++i];
    else if (a === "--no-provider") noProvider = true;
    else if (a === "--include-postgame") includePostgame = true;
    else if (a === "--json") json = true;
    else if (a === "--quota-remaining") {
      const s = argv[++i];
      if (!s) {
        console.error("Missing --quota-remaining value");
        usage();
      }
      quotaRemaining = parseMlbDailyOpsQuotaRemaining(s);
    } else if (a === "--rehearsal") rehearsal = true;
    else if (a === "--unattended") unattended = true;
    else if (a === "--rehearsal-as-of") {
      rehearsalAsOfRaw = argv[++i];
      if (!rehearsalAsOfRaw) {
        throw new Error("REHEARSAL_AS_OF_MISSING_VALUE");
      }
    } else if (a === "--help" || a === "-h") usage();
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) {
    console.error("Missing or invalid --date YYYY-MM-DD");
    usage();
  }

  if (rehearsalAsOfRaw && !rehearsal) {
    throw new Error("REHEARSAL_AS_OF_REQUIRES_REHEARSAL");
  }
  if (rehearsal && dryRun) {
    throw new Error("REHEARSAL_CONFLICT: --rehearsal cannot be combined with --dry-run");
  }
  if (rehearsal && includePostgame) {
    throw new Error(
      "REHEARSAL_CONFLICT: --rehearsal cannot be combined with --include-postgame",
    );
  }
  if (rehearsal && league !== "MLB") {
    throw new Error("REHEARSAL_MLB_ONLY");
  }
  if (rehearsal && unattended) {
    throw new Error(
      "UNATTENDED_CONFLICT: --unattended cannot be combined with --rehearsal",
    );
  }

  const rehearsalAsOf = rehearsalAsOfRaw
    ? parseRehearsalAsOfIso(rehearsalAsOfRaw)
    : undefined;

  return {
    dateKst,
    league,
    dryRun: rehearsal ? false : dryRun,
    forceStage,
    gameId,
    noProvider: rehearsal ? true : noProvider,
    includePostgame: rehearsal ? false : includePostgame,
    json,
    quotaRemaining,
    persist: rehearsal ? false : !dryRun,
    rehearsal,
    rehearsalAsOf,
    unattended: rehearsal ? false : unattended,
    now: rehearsalAsOf ? new Date(rehearsalAsOf) : undefined,
    executeRunner: async (action: RunnerAction) => {
      if (action.kind !== "SPAWN_TSX" || !action.scriptRel) return 1;
      return spawnLocalTsxScript(action.scriptRel, action.args ?? []);
    },
  };
}

function dailyOpsSpawnCount(
  plans: Array<{
    action?: { actionId?: string; args?: string[] } | null;
    executionStatus: string;
  }>,
): number {
  const seen = new Set<string>();
  for (const p of plans) {
    if (p.action?.actionId !== "RUN_MLB_DAILY_OPS") continue;
    if (
      p.executionStatus !== "SUCCESS" &&
      p.executionStatus !== "FAILED" &&
      p.executionStatus !== "PASS"
    ) {
      continue;
    }
    seen.add(JSON.stringify(p.action.args ?? []));
  }
  return seen.size;
}

async function main(): Promise<void> {
  let opts: OrchestratorOptions;
  try {
    opts = parsePregameSchedulerCliArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    usage();
  }
  const result = await runPregameScheduler(opts);

  if (result.globalBlocker) {
    console.error(`GLOBAL_BLOCKER: ${result.globalBlocker}`);
  }

  const spawnCount = dailyOpsSpawnCount(result.plans);
  const controlPath =
    Boolean(opts.rehearsal) &&
    spawnCount >= 1 &&
    result.providerCalls === 0 &&
    opts.persist === false
      ? "PASS"
      : opts.rehearsal
        ? "FAIL"
        : null;

  if (opts.rehearsal) {
    console.error("MODE=REHEARSAL");
    console.error(`WARNING=${REHEARSAL_NOT_RESEARCH_EVIDENCE}`);
    console.error("HISTORICAL_AS_OF_IS_CONTROL_PLANE_ONLY=true");
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          ...result.audit,
          rehearsal: Boolean(opts.rehearsal),
          rehearsalAsOf: opts.rehearsalAsOf ?? null,
          persist: opts.persist === true,
          providerCalls: result.providerCalls,
          plans: result.plans,
          controlPath,
          warning: opts.rehearsal ? REHEARSAL_NOT_RESEARCH_EVIDENCE : undefined,
          historicalAsOfIsControlPlaneOnly: Boolean(opts.rehearsal),
        },
        null,
        2,
      ),
    );
  } else if (opts.rehearsal) {
    console.log("MODE=REHEARSAL");
    console.log(`WARNING=${REHEARSAL_NOT_RESEARCH_EVIDENCE}`);
    console.log("HISTORICAL_AS_OF_IS_CONTROL_PLANE_ONLY=true");
    console.log(`date=${opts.dateKst}`);
    console.log(`asOf=${opts.rehearsalAsOf ?? "wall-clock"}`);
    console.log(`league=${opts.league}`);
    console.log(`eventCount=${result.audit.totalGames}`);
    console.log(
      `resolvedStages=${result.plans.map((p) => `${p.gameId}:${p.stage}`).join(",")}`,
    );
    console.log(`dailyOpsSpawnCount=${spawnCount}`);
    console.log(`providerCalls=${result.providerCalls}`);
    console.log(`persist=${opts.persist === true}`);
    console.log(`controlPath=${controlPath}`);
    console.log(
      `businessResult=${result.audit.overallStatus}${result.globalBlocker ? `:${result.globalBlocker}` : ""}`,
    );
  } else if (opts.dryRun) {
    console.log(formatDryRunText(result.plans));
    console.log(
      `\n[dry-run] games=${result.audit.totalGames} providerCalls=${result.providerCalls} durationMs=${result.audit.durationMs}`,
    );
  } else {
    console.log(
      JSON.stringify(
        {
          schedulerRunId: result.schedulerRunId,
          overallStatus: result.audit.overallStatus,
          totalGames: result.audit.totalGames,
          success: result.audit.success,
          failed: result.audit.failed,
          blocked: result.audit.blocked,
          skipped: result.audit.skipped,
          providerCalls: result.providerCalls,
          durationMs: result.audit.durationMs,
        },
        null,
        2,
      ),
    );
  }

  if (opts.rehearsal) {
    if (controlPath !== "PASS" || result.globalBlocker) process.exit(1);
    return;
  }
  if (result.globalBlocker) process.exit(1);
  if (result.audit.overallStatus === "FAILED") process.exit(1);
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
