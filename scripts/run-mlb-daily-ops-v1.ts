/**
 * CLI: YANG EDGE MLB Daily Ops One-Command v1
 *
 *   npm run ops:mlb-daily -- 2026-08-09
 *   npm run ops:mlb-daily -- --date 2026-08-09 --dry-run --no-provider
 *
 * Date omitted → current KST (same rule as daily:mlb-pregame-v0).
 */
import { getKstToday } from "../src/lib/datetime/kst";
import {
  formatMlbDailyOpsFailureBlock,
  runMlbDailyOpsV1,
} from "../src/lib/mlb/daily-ops-v1";
import type { DailyStageName } from "../src/lib/mlb/daily-pregame-v0";

function usage(): string {
  return `Usage:
  npm run ops:mlb-daily -- YYYY-MM-DD
  npm run ops:mlb-daily -- --date YYYY-MM-DD [options]

Options:
  --date YYYY-MM-DD
  --dry-run              No writes, no provider (read-only verify)
  --no-provider          Skip provider collection stages
  --assess-only          Skip collectors; assess artifacts + provenance only
  --json
  --skip-lineup
  --observation-only
  --no-market-prior
  --no-write             Compute path but do not persist new snapshot
  --no-seal              Do not seal recommendation delivery record
  --stop-after <STAGE>
  --resume-from <STAGE>
  --help

Stages (reused): SCHEDULE → STARTER → ODDS → LINEUP → DAILY_RESEARCH_SUMMARY
  → INPUT_AUDIT → PREDICTION_V0 → SNAPSHOT_VERIFY
  → PROVENANCE_VERIFY → RECOMMENDATION_RECORD → OPERATOR_SUMMARY

Ops success requires pre-game Snapshot Verify PASS.
`;
}

function parseArgs(argv: string[]) {
  let dateKst: string | null = null;
  let dryRun = false;
  let noProvider = false;
  let assessOnly = false;
  let json = false;
  let skipLineup = false;
  let observationOnly = false;
  let useMarketPrior = true;
  let noWrite = false;
  let noSeal = false;
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
    if (a === "--assess-only") {
      assessOnly = true;
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
    if (a === "--no-seal") {
      noSeal = true;
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
    assessOnly,
    json,
    skipLineup,
    observationOnly,
    useMarketPrior,
    writePrediction: !dryRun && !noWrite && !assessOnly,
    sealDeliveryRecord: !noSeal && !dryRun && !assessOnly,
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
    return;
  }

  const report = await runMlbDailyOpsV1({
    dateKst: opts.dateKst,
    dryRun: opts.dryRun,
    noProvider: opts.noProvider,
    assessOnly: opts.assessOnly,
    sealDeliveryRecord: opts.sealDeliveryRecord,
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
    if (report.pregame) {
      console.log(
        `pregame overall=${report.pregame.overall} providerCalls=${report.providerCalls} writes=${report.writesPerformed}`,
      );
      for (const s of report.pregame.stages) {
        console.log(
          `  ${s.stage}: ${s.status}${s.blockers.length ? ` blockers=${s.blockers.join(",")}` : ""}`,
        );
      }
      console.log("");
    }
    console.log(report.operatorSummaryText);
    if (!report.opsSuccess && report.failure) {
      console.log("");
      console.log(formatMlbDailyOpsFailureBlock(report.failure));
    }
    console.log("");
    console.log("--- Recent MLB Ops Dates ---");
    for (const d of report.recentDays) {
      console.log(
        `${d.dateKst}  ${d.lifecycle}${d.snapshotVerified ? " · SNAPSHOT_OK" : ""}${d.recommendationRecord === "SEALED" ? " · RECORD_SEALED" : ""}`,
      );
    }
  }

  if (!report.opsSuccess) {
    process.exitCode =
      report.failure?.reason === "BLOCKED_MISSING_SCHEDULE" ? 2 : 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
