/**
 * CLI: YANG EDGE NPB Daily Ops One-Command v0
 *
 *   npm run ops:npb-daily -- 2026-08-07
 *   npm run ops:npb-daily -- --date 2026-08-07 --assess-only
 */
import { getKstToday } from "../src/lib/datetime/kst";
import {
  formatNpbDailyOpsFailureBlock,
  runNpbDailyOpsV0,
} from "../src/lib/npb/daily-ops-v0";

function usage(): string {
  return `Usage:
  npm run ops:npb-daily -- YYYY-MM-DD
  npm run ops:npb-daily -- --date YYYY-MM-DD [options]

Options:
  --date YYYY-MM-DD
  --dry-run / --assess-only   No freeze write; assess artifacts only
  --json
  --help

Pipeline (evidence only — no Prediction Engine):
  Schedule → Starter → Odds → Lineup → Pregame Evidence Snapshot
  → Continuity Guard → Operator Summary

Missing Starter/Odds are not invented. Freeze may record null/missing sides.
`;
}

function parseArgs(argv: string[]) {
  let dateKst: string | null = null;
  let dryRun = false;
  let assessOnly = false;
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

  const report = await runNpbDailyOpsV0({
    dateKst: opts.dateKst,
    dryRun: opts.dryRun,
    assessOnly: opts.assessOnly,
  });

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`stages=${report.stagesRun.join(" → ")}`);
    console.log(
      `lifecycle=${report.day.lifecycle} opsSuccess=${report.opsSuccess}`,
    );
    console.log("");
    console.log(report.operatorSummaryText);
    if (!report.opsSuccess && report.failure) {
      console.log("");
      console.log(formatNpbDailyOpsFailureBlock(report.failure));
    }
  }

  if (!report.opsSuccess) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
