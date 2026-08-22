/**
 * CLI: MLB lineup auto refresh v1
 *
 * Normal pregame path. Does not run Prediction.
 * Does not overwrite frozen daily batter-dataset-v0.json.
 * Per-game cutoff. Immutable append-only raw snapshots.
 *
 *   npm run ops:mlb-lineup-refresh -- YYYY-MM-DD
 *   npm run ops:mlb-lineup-refresh -- YYYY-MM-DD --dry-run
 *   npm run ops:mlb-lineup-refresh -- YYYY-MM-DD --no-provider
 *   npm run ops:mlb-lineup-refresh -- YYYY-MM-DD --cache-only
 *   npm run ops:mlb-lineup-refresh -- YYYY-MM-DD --game-id 776123
 */
import { getKstToday } from "../src/lib/datetime/kst";
import {
  formatMlbLineupRefreshSummary,
  runMlbLineupRefresh,
} from "../src/lib/mlb/lineup-refresh-v1";

function usage(): string {
  return `Usage:
  npm run ops:mlb-lineup-refresh -- YYYY-MM-DD
  npm run ops:mlb-lineup-refresh -- YYYY-MM-DD --dry-run
  npm run ops:mlb-lineup-refresh -- YYYY-MM-DD --no-provider
  npm run ops:mlb-lineup-refresh -- YYYY-MM-DD --cache-only
  npm run ops:mlb-lineup-refresh -- YYYY-MM-DD --game-id <gamePk|internalGameId>

Contracts:
  --dry-run      Zero writes. Zero provider calls. Resolves from existing snapshots only in memory after schedule load.
  --no-provider  No new boxscore provider calls. Resolves existing immutable snapshots. May write manifests.
  --cache-only   Same boxscore behavior as --no-provider. Batter stats stay cache-only (no network).
  --game-id      Limit refresh/capture to one schedule game.

Per-game cutoff. Immutable append-only raw snapshots under
data/research/mlb/lineup-refresh/{date}/raw/{gamePk}/{payloadHash}.json
Prediction is not executed. Frozen batter-dataset-v0 is never overwritten.
`;
}

function parseArgs(argv: string[]) {
  let dateKst: string | null = null;
  let dryRun = false;
  let noProvider = false;
  let cacheOnly = false;
  let gameId: string | undefined;
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
    if (a === "--cache-only") {
      cacheOnly = true;
      continue;
    }
    if (a === "--game-id") {
      gameId = argv[++i];
      if (!gameId) throw new Error("--game-id requires a value");
      continue;
    }
    if (a === "--force" || a === "--forceRefresh") {
      throw new Error(
        `${a} is not allowed. Refresh uses IMMUTABLE_APPEND_ONLY snapshots.`,
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
    noProvider,
    cacheOnly,
    gameId,
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

  const result = await runMlbLineupRefresh({
    dateKst: args.dateKst,
    dryRun: args.dryRun,
    noProvider: args.noProvider,
    cacheOnly: args.cacheOnly,
    gameId: args.gameId,
  });
  process.stdout.write(formatMlbLineupRefreshSummary(result.manifest));
  process.stdout.write(
    `Provider calls this run: ${result.providerCalls}\nWrites: ${result.writtenManifest ? "YES (manifests/new snapshots/captures)" : "NO (dry-run)"}\n`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
