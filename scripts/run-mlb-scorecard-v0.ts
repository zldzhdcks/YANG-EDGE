/**
 * CLI: MLB Prediction Scorecard v0 (postgame).
 *
 *   npm run scorecard:mlb-v0 -- --date YYYY-MM-DD --dry-run --json
 *   npm run scorecard:mlb-v0 -- --date YYYY-MM-DD --json
 *
 * Additive artifact only. Does not mutate prediction snapshots. Provider=0.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getKstToday } from "../src/lib/datetime/kst";
import {
  buildMlbPredictionScorecardV0,
  mlbPredictionSnapshotRel,
  mlbScorecardV0Rel,
} from "../src/lib/mlb/scorecard-v0";

function usage(): string {
  return `Usage:
  npm run scorecard:mlb-v0 -- --date YYYY-MM-DD [options]

Options:
  --date <YYYY-MM-DD>         Target KST date (default: today KST)
  --dry-run                   Compute scorecard; write 0
  --json                      Print full JSON document
  --game-id <gamePk>          Filter to one gamePk
  --allow-partial-results     Allow PARTIAL_SCORECARD when some NOT_FINAL
  --expected-prediction-hash  Fail if snapshot meta hash mismatches
  --help
`;
}

function parseArgs(argv: string[]) {
  let dateKst: string | null = null;
  let dryRun = false;
  let json = false;
  let allowPartialResults = false;
  let gamePk: number | null = null;
  let expectedPredictionHash: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--help" || a === "-h") throw new Error("HELP");
    if (a === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (a === "--json") {
      json = true;
      continue;
    }
    if (a === "--allow-partial-results") {
      allowPartialResults = true;
      continue;
    }
    if (a === "--date") {
      dateKst = argv[++i] ?? null;
      continue;
    }
    if (a === "--game-id") {
      const raw = argv[++i];
      const n = raw != null ? Number(raw) : NaN;
      if (!Number.isFinite(n)) throw new Error("--game-id requires numeric gamePk");
      gamePk = n;
      continue;
    }
    if (a === "--expected-prediction-hash") {
      expectedPredictionHash = argv[++i] ?? null;
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
    json,
    allowPartialResults,
    gamePk,
    expectedPredictionHash,
  };
}

async function main() {
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    if (e instanceof Error && e.message === "HELP") {
      console.log(usage());
      process.exit(0);
    }
    console.error(e instanceof Error ? e.message : e);
    console.error(usage());
    process.exit(1);
  }

  const cwd = process.cwd();
  const predRel = mlbPredictionSnapshotRel(args.dateKst);
  const predAbs = path.join(cwd, predRel);
  let predHashBefore: string | null = null;
  try {
    const buf = await readFile(predAbs);
    predHashBefore = createHash("sha256").update(buf).digest("hex");
  } catch {
    console.error(
      `NO_PREGAME_SNAPSHOT: ${predRel} (DAILY_PREDICTION_SNAPSHOT_MISSING)`,
    );
    process.exit(1);
  }

  console.log(`=== MLB Prediction Scorecard v0 (${args.dateKst}) ===`);
  console.log(`dryRun=${args.dryRun} allowPartial=${args.allowPartialResults}`);

  const { document, pathRel, wrote } = await buildMlbPredictionScorecardV0({
    dateKst: args.dateKst,
    cwd,
    dryRun: args.dryRun,
    allowPartialResults: args.allowPartialResults,
    gamePk: args.gamePk,
    expectedPredictionHash: args.expectedPredictionHash,
  });

  const predAfter = createHash("sha256")
    .update(await readFile(predAbs))
    .digest("hex");
  if (predHashBefore !== predAfter) {
    console.error("FATAL: prediction snapshot mutated during scorecard run");
    process.exit(1);
  }

  const m = document.meta;
  const rb = document.researchBaselinePerformance;

  if (args.json) {
    console.log(JSON.stringify(document, null, 2));
  } else {
    console.log(`predictionHash=${m.predictionHashSha256}`);
    console.log(`resultsHash=${m.officialResultsHash}`);
    console.log(`scorecardHash=${m.scorecardHash}`);
    console.log(
      `games total=${m.totalGames} final=${m.finalGames} pending=${m.pendingGames} void=${m.voidGames} blocked=${m.blockedCount}`,
    );
    console.log(
      `research sample=${m.researchSampleCount} accuracy=${rb.accuracy ?? "null"} brier=${rb.meanBrierScore ?? "null"} logLoss=${rb.meanLogLoss ?? "null"}`,
    );
    console.log(
      `officialPickCount=${document.officialPerformance.officialPickCount} officialAccuracy=${document.officialPerformance.accuracy.status}`,
    );
    console.log(`conclusion=${m.conclusion}`);
    console.log(
      `wrote=${wrote} path=${wrote ? pathRel : mlbScorecardV0Rel(args.dateKst)}`,
    );
    console.log(`snapshotMutation=0 providerCalls=0`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
