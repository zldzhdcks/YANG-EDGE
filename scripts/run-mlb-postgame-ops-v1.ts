/**
 * CLI: YANG EDGE MLB Postgame Ops One-Command v1
 *
 *   npm run ops:mlb-postgame -- 2026-08-08
 *   npm run ops:mlb-postgame -- --date 2026-08-08 --dry-run
 */
import { getKstToday } from "../src/lib/datetime/kst";
import {
  formatMlbPostgameOpsFailureBlock,
  runMlbPostgameOpsV1,
} from "../src/lib/mlb/postgame-ops-v1";

function usage(): string {
  return `Usage:
  npm run ops:mlb-postgame -- YYYY-MM-DD
  npm run ops:mlb-postgame -- --date YYYY-MM-DD [options]

Options:
  --date YYYY-MM-DD
  --dry-run / --assess-only   Read existing artifacts; no provider; no grade writes
  --read-only                 Same as dry-run for writes
  --json
  --help

Pipeline:
  Preflight (NO_PREGAME_SNAPSHOT → stop, 사후 Prediction 금지)
  → Official Results
  → Final Status Verify
  → Grade All Research Predictions
  → Grade Engine Recommendation Record
  → Daily Review
  → Good Pick Feedback
  → Learning Tracker
  → Operator Summary

Immutable: Prediction Snapshot + Recommendation Record must not change.
`;
}

function parseArgs(argv: string[]) {
  let dateKst: string | null = null;
  let dryRun = false;
  let assessOnly = false;
  let readOnly = false;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--help" || a === "-h") throw new Error("HELP");
    if (a === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (a === "--assess-only") {
      assessOnly = true;
      continue;
    }
    if (a === "--read-only") {
      readOnly = true;
      continue;
    }
    if (a === "--json") {
      json = true;
      continue;
    }
    if (a === "--date") {
      dateKst = argv[++i] ?? null;
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
    assessOnly,
    readOnly,
    json,
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

  const report = await runMlbPostgameOpsV1({
    dateKst: opts.dateKst,
    dryRun: opts.dryRun,
    assessOnly: opts.assessOnly,
    readOnly: opts.readOnly,
  });

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`stages=${report.stagesRun.join(" → ")}`);
    console.log(`lifecycle=${report.lifecycle} opsSuccess=${report.opsSuccess}`);
    console.log("");
    console.log(report.operatorSummaryText);
    if (report.trackerLine) {
      console.log("");
      console.log(`Learning Tracker: ${report.trackerLine}`);
    }
    console.log("");
    console.log("Immutable Audit");
    console.log(
      `  Prediction unchanged: ${report.immutableAudit.predictionUnchanged}`,
    );
    console.log(
      `  Recommendation Record unchanged: ${report.immutableAudit.recommendationUnchanged}`,
    );
    if (!report.opsSuccess && report.failure) {
      console.log("");
      console.log(formatMlbPostgameOpsFailureBlock(report.failure));
    }
  }

  if (!report.opsSuccess) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
