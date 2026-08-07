/**
 * CLI: YANG EDGE NPB Postgame Ops One-Command v0
 *
 *   npm run ops:npb-postgame -- 2026-08-07
 *   npm run ops:npb-postgame -- --date 2026-08-07 --assess-only
 */
import { getKstToday } from "../src/lib/datetime/kst";
import {
  formatNpbPostgameOpsFailureBlock,
  runNpbPostgameOpsV0,
} from "../src/lib/npb/postgame-ops-v0";

function usage(): string {
  return `Usage:
  npm run ops:npb-postgame -- YYYY-MM-DD
  npm run ops:npb-postgame -- --date YYYY-MM-DD [options]

Options:
  --date YYYY-MM-DD
  --dry-run / --assess-only / --read-only   No result writes; read artifacts
  --json
  --help

Pipeline (no Prediction Grade):
  Preflight → Official Result → Pregame join → Market Baseline
  → Daily Evidence Lifecycle → Operator Summary

Immutable: Pregame Evidence Snapshot must not change.
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

  const report = await runNpbPostgameOpsV0({
    dateKst: opts.dateKst,
    dryRun: opts.dryRun,
    assessOnly: opts.assessOnly,
    readOnly: opts.readOnly,
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
    console.log("Immutable Audit");
    console.log(
      `  Pregame unchanged: ${report.immutableAudit.predictionUnchanged}`,
    );
    console.log(
      `  Hash field: ${report.immutableAudit.predictionHashFieldAfter?.slice(0, 8) ?? "—"}…`,
    );
    if (!report.opsSuccess && report.failure) {
      console.log("");
      console.log(formatNpbPostgameOpsFailureBlock(report.failure));
    }
  }

  if (!report.opsSuccess) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
