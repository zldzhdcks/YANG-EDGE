/**
 * CLI: MLB Batter Pregame live sidecar v0
 *
 * Research only. Does not run Prediction. Does not change Daily Mandatory %.
 *
 *   npm run ops:mlb-batter-pregame -- YYYY-MM-DD
 *   npm run ops:mlb-batter-pregame -- YYYY-MM-DD --dry-run
 */
import { getKstToday } from "../src/lib/datetime/kst";
import {
  formatBatterPregameOpsSummary,
  runBatterPregameOps,
} from "../src/lib/mlb/batter-dataset-v0";

function usage(): string {
  return `Usage:
  npm run ops:mlb-batter-pregame -- YYYY-MM-DD
  npm run ops:mlb-batter-pregame -- YYYY-MM-DD --dry-run

Research sidecar after lineup, before prediction.
Prediction is not executed. Market is not used.
--force is not allowed (write-once).
`;
}

function parseArgs(argv: string[]) {
  let dateKst: string | null = null;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--help" || a === "-h") throw new Error("HELP");
    if (a === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (a === "--force" || a === "--fetch") {
      throw new Error(
        `${a} is not allowed on ops:mlb-batter-pregame. Live fetch is gated by FULL_SLATE_BEFORE_FIRST_PITCH_ONLY; existing artifacts are write-once.`,
      );
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
  };
}

async function main() {
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "HELP") {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    process.stderr.write(`${msg}\n\n${usage()}\n`);
    process.exitCode = 1;
    return;
  }

  const summary = await runBatterPregameOps({
    dateKst: args.dateKst,
    dryRun: args.dryRun,
  });
  process.stdout.write(formatBatterPregameOpsSummary(summary));
  if (
    !args.dryRun &&
    (summary.datasetStatus === "CUTOFF_CLOSED" ||
      summary.datasetStatus === "NOT_READY") &&
    !summary.written
  ) {
    process.exitCode = 0;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
