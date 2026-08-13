/**
 * CLI: Football Market Baseline Prediction v0
 *
 *   npm run research:football-market-baseline -- --date 2026-08-14
 *   npm run research:football-market-baseline -- --date 2026-08-14 --dry-run
 *
 * Reads Prediction Snapshot v0 only.
 * No Provider. No Odds/Schedule builder. predictionAt = now.
 */
import { buildFootballMarketBaselinePredictionV0 } from "../src/lib/football/market-baseline-prediction-v0";

function usage(): string {
  return `Usage:
  npm run research:football-market-baseline -- --date YYYY-MM-DD [--dry-run] [--json]
`;
}

function parseArgs(argv: string[]) {
  let dateKst = "";
  let dryRun = false;
  let json = false;
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
    if (a === "--date") {
      const v = argv[++i];
      if (!v) throw new Error("--date requires YYYY-MM-DD");
      dateKst = v;
      continue;
    }
    if (!a.startsWith("-") && /^\d{4}-\d{2}-\d{2}$/.test(a)) {
      dateKst = a;
      continue;
    }
    throw new Error(`Unknown argument: ${a}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) throw new Error("HELP");
  return { dateKst, dryRun, json };
}

async function main() {
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "HELP") {
      console.log(usage());
      process.exit(0);
    }
    console.error(msg);
    console.log(usage());
    process.exit(1);
  }

  const now = new Date().toISOString();
  const predictionAt = now;
  const generatedAt = now;
  console.log(`predictionAt=${predictionAt}`);
  console.log(`generatedAt=${generatedAt}`);
  console.log(`dryRun=${args.dryRun}`);

  const result = await buildFootballMarketBaselinePredictionV0({
    dateKst: args.dateKst,
    predictionAt,
    generatedAt,
    dryRun: args.dryRun,
  });

  const m = result.document.meta;
  const predicted = result.document.matches.filter(
    (row) => row.baselineStatus === "MARKET_BASELINE_PREDICTED",
  );
  const summary = {
    dateKst: m.dateKst,
    rel: result.rel,
    wrote: result.wrote,
    dryRun: args.dryRun,
    predictionAt: m.predictionAt,
    predictionClass: m.predictionClass,
    model: m.model,
    engine: m.engine,
    recommendation: m.recommendation,
    officialPickCount: m.officialPickCount,
    frozenInputGames: m.frozenInputGames,
    baselinePredictedGames: m.baselinePredictedGames,
    ambiguousMarketGames: m.ambiguousMarketGames,
    missedPredictionWindowGames: m.missedPredictionWindowGames,
    nonFrozenInputGames: m.nonFrozenInputGames,
    sourceSnapshotHash: m.sourceSnapshotHash,
    predictionHash: m.predictionHash,
    predicted: predicted.map((row) => ({
      matchId: row.matchId,
      baselineStatus: row.baselineStatus,
      baselineOutcome: row.baselineOutcome,
      baselineProbability: row.baselineProbability,
      sourceSelectedOddsObservationId: row.sourceSelectedOddsObservationId,
    })),
  };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(
      [
        `rel=${result.rel}`,
        `wrote=${result.wrote}`,
        `baselinePredictedGames=${m.baselinePredictedGames}`,
        `predictionHash=${m.predictionHash}`,
      ].join("\n"),
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
