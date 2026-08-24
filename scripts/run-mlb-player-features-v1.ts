/**
 * CLI: MLB Pregame Player Feature Dataset v1
 *
 * Research sidecar only. Does not run Prediction.
 * Does not write Recommendation Records.
 * Does not mutate Engine weights.
 *
 *   npm run ops:mlb-player-features -- YYYY-MM-DD
 *   npm run ops:mlb-player-features -- YYYY-MM-DD --dry-run
 *   npm run ops:mlb-player-features -- YYYY-MM-DD --cache-only
 *   npm run ops:mlb-player-features -- YYYY-MM-DD --game-pk 776123
 *   npm run ops:mlb-player-features -- YYYY-MM-DD --json
 */
import { getKstToday } from "../src/lib/datetime/kst";
import {
  formatPlayerFeaturesSummary,
  runPlayerFeatures,
} from "../src/lib/mlb/player-features-v1";

function usage(): string {
  return `Usage:
  npm run ops:mlb-player-features -- YYYY-MM-DD
  npm run ops:mlb-player-features -- YYYY-MM-DD --dry-run
  npm run ops:mlb-player-features -- YYYY-MM-DD --cache-only
  npm run ops:mlb-player-features -- YYYY-MM-DD --game-pk <gamePk>
  npm run ops:mlb-player-features -- YYYY-MM-DD --json

Contracts:
  --dry-run     Zero provider calls. Zero writes.
  --cache-only  Zero network calls. May build from existing cache/identity evidence.
  --game-pk     Limit to one schedule gamePk.
  --json        Print machine-readable summary.

Write-once dataset under data/research/mlb/player-features/{date}/dataset-v1.json
No --force overwrite. Prediction is not executed.
`;
}

function parseArgs(argv: string[]) {
  let dateKst: string | null = null;
  let dryRun = false;
  let cacheOnly = false;
  let json = false;
  let gamePk: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--help" || a === "-h") throw new Error("HELP");
    if (a === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (a === "--cache-only") {
      cacheOnly = true;
      continue;
    }
    if (a === "--json") {
      json = true;
      continue;
    }
    if (a === "--game-pk") {
      const raw = argv[++i];
      if (!raw) throw new Error("--game-pk requires a value");
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error("--game-pk must be a number");
      gamePk = n;
      continue;
    }
    if (a === "--force" || a === "--forceRefresh") {
      throw new Error(`${a} is not allowed. Player-feature datasets are write-once.`);
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
    cacheOnly,
    json,
    gamePk,
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

  const result = await runPlayerFeatures({
    dateKst: args.dateKst,
    dryRun: args.dryRun,
    cacheOnly: args.cacheOnly,
    gamePk: args.gamePk,
  });
  if (args.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          dateKst: args.dateKst,
          written: result.written,
          skippedExisting: result.skippedExisting,
          featureFetchAttempts: result.featureFetchAttempts,
          networkCalls: result.networkCalls,
          datasetHash: result.document?.datasetHash ?? null,
          independentModelSample: 0,
          engineAdmission: "PROHIBITED",
        },
        null,
        2,
      )}\n`,
    );
    return;
  }
  if (result.document) {
    process.stdout.write(
      formatPlayerFeaturesSummary(result.document, {
        written: result.written,
        skippedExisting: result.skippedExisting,
        dryRun: args.dryRun,
      }),
    );
  }
  process.stdout.write(
    `Provider calls this run: ${result.networkCalls}\nWrites: ${result.written ? "YES" : "NO"}\n`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
