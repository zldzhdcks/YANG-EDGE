/**
 * CLI: MLB Daily Pregame Prediction Line v0
 *
 *   npm run daily:mlb-pregame-v0 -- --date YYYY-MM-DD --dry-run --no-provider --json
 */
import { getKstToday } from "../src/lib/datetime/kst";
import {
  runMlbDailyPregameV0,
  type DailyStageName,
} from "../src/lib/mlb/daily-pregame-v0";

function usage(): string {
  return `Usage:
  npm run daily:mlb-pregame-v0 -- --date YYYY-MM-DD [options]

Options:
  --date YYYY-MM-DD
  --dry-run              No writes, no provider
  --no-provider          Skip provider collection stages
  --json
  --game-id <id>         Repeatable
  --skip-lineup
  --observation-only
  --no-market-prior
  --stop-after <STAGE>
  --resume-from <STAGE>
  --no-write             Compute prediction but do not persist snapshot
  --help

Stages: SCHEDULE STARTER ODDS LINEUP INPUT_AUDIT PREDICTION_V0 SNAPSHOT_VERIFY

Real write (approved ops only):
  npm run daily:mlb-pregame-v0 -- --date YYYY-MM-DD --json

Dry-run readiness:
  npm run daily:mlb-pregame-v0 -- --date YYYY-MM-DD --dry-run --no-provider --json
`;
}

function parseArgs(argv: string[]) {
  let dateKst: string | null = null;
  let dryRun = false;
  let noProvider = false;
  let json = false;
  let skipLineup = false;
  let observationOnly = false;
  let useMarketPrior = true;
  let noWrite = false;
  let stopAfter: DailyStageName | undefined;
  let resumeFrom: DailyStageName | undefined;
  const gameIds: string[] = [];

  const stages = new Set([
    "SCHEDULE",
    "STARTER",
    "ODDS",
    "LINEUP",
    "INPUT_AUDIT",
    "PREDICTION_V0",
    "SNAPSHOT_VERIFY",
  ]);

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--help" || a === "-h") throw new Error("HELP");
    if (a === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (a === "--no-provider") {
      noProvider = true;
      continue;
    }
    if (a === "--json") {
      json = true;
      continue;
    }
    if (a === "--skip-lineup") {
      skipLineup = true;
      continue;
    }
    if (a === "--observation-only") {
      observationOnly = true;
      continue;
    }
    if (a === "--no-market-prior") {
      useMarketPrior = false;
      continue;
    }
    if (a === "--no-write") {
      noWrite = true;
      continue;
    }
    if (a === "--date") {
      dateKst = argv[++i] ?? null;
      continue;
    }
    if (a === "--game-id") {
      const id = argv[++i];
      if (id) gameIds.push(id);
      continue;
    }
    if (a === "--stop-after") {
      const s = argv[++i];
      if (!s || !stages.has(s)) throw new Error(`Invalid stop-after: ${s}`);
      stopAfter = s as DailyStageName;
      continue;
    }
    if (a === "--resume-from") {
      const s = argv[++i];
      if (!s || !stages.has(s)) throw new Error(`Invalid resume-from: ${s}`);
      resumeFrom = s as DailyStageName;
      continue;
    }
    if (!a.startsWith("-") && /^\d{4}-\d{2}-\d{2}$/.test(a) && !dateKst) {
      dateKst = a;
      continue;
    }
    throw new Error(`Unknown argument: ${a}`);
  }

  return {
    dateKst: dateKst || getKstToday(),
    dryRun,
    noProvider: noProvider || dryRun,
    json,
    skipLineup,
    observationOnly,
    useMarketPrior,
    writePrediction: !dryRun && !noWrite,
    stopAfter,
    resumeFrom,
    gameIds,
  };
}

async function main() {
  let opts: ReturnType<typeof parseArgs>;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    if (e instanceof Error && e.message === "HELP") {
      console.log(usage());
      process.exit(0);
    }
    console.error(e instanceof Error ? e.message : e);
    console.error(usage());
    process.exit(1);
  }

  const report = await runMlbDailyPregameV0({
    dateKst: opts.dateKst,
    dryRun: opts.dryRun,
    noProvider: opts.noProvider,
    gameIds: opts.gameIds.length ? opts.gameIds : undefined,
    skipLineup: opts.skipLineup,
    observationOnly: opts.observationOnly,
    useMarketPrior: opts.useMarketPrior,
    stopAfter: opts.stopAfter,
    resumeFrom: opts.resumeFrom,
    writePrediction: opts.writePrediction,
  });

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`date=${report.dateKst} overall=${report.overall}`);
    console.log(
      `providerCalls=${report.providerCalls} writes=${report.writesPerformed} dryRun=${report.dryRun}`,
    );
    for (const s of report.stages) {
      console.log(
        `  ${s.stage}: ${s.status}${s.blockers.length ? ` blockers=${s.blockers.join(",")}` : ""}`,
      );
    }
    if (report.nextAction) console.log(`nextAction=${report.nextAction}`);
  }

  if (
    report.overall === "FAILED" ||
    report.overall === "BLOCKED_MISSING_SCHEDULE"
  ) {
    process.exitCode = report.overall === "FAILED" ? 1 : 2;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
