/**
 * Pregame Scheduler v1 CLI
 *
 * npm run scheduler:pregame -- --date 2026-08-01 --league MLB --dry-run
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
`);
  process.exit(2);
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
    } else if (a === "--help" || a === "-h") usage();
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) {
    console.error("Missing or invalid --date YYYY-MM-DD");
    usage();
  }

  return {
    dateKst,
    league,
    dryRun,
    forceStage,
    gameId,
    noProvider,
    includePostgame,
    json,
    quotaRemaining,
    persist: !dryRun,
    executeRunner: async (action: RunnerAction) => {
      if (action.kind !== "SPAWN_TSX" || !action.scriptRel) return 1;
      return spawnLocalTsxScript(action.scriptRel, action.args ?? []);
    },
  };
}

async function main(): Promise<void> {
  const opts = parsePregameSchedulerCliArgs(process.argv.slice(2));
  const result = await runPregameScheduler(opts);

  if (result.globalBlocker) {
    console.error(`GLOBAL_BLOCKER: ${result.globalBlocker}`);
  }

  if (opts.json) {
    console.log(JSON.stringify(result.audit, null, 2));
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
