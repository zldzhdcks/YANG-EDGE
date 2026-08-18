/**
 * CLI: Football Market Baseline Postgame Review v0
 *
 *   npm run research:football-postgame-review -- --date 2026-08-18
 *   npm run research:football-postgame-review -- --date 2026-08-18 --dry-run
 *
 * Reads sealed Market Baseline + Official Result only.
 * No Provider. No Snapshot/Odds/Schedule/Baseline rebuild.
 */
import { buildFootballMarketBaselinePostgameReviewV0 } from "../src/lib/football/market-baseline-postgame-review-v0";

function usage(): string {
  return `Usage:
  npm run research:football-postgame-review -- --date YYYY-MM-DD [--dry-run] [--json]
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

  const generatedAt = new Date().toISOString();
  console.log(`generatedAt=${generatedAt}`);
  console.log(`dryRun=${args.dryRun}`);
  console.log(`sampleLane=RESEARCH`);
  console.log(`predictionClass=MARKET_BASELINE`);
  console.log(`providerCalls=0`);

  const result = await buildFootballMarketBaselinePostgameReviewV0({
    dateKst: args.dateKst,
    generatedAt,
    dryRun: args.dryRun,
  });

  const grade = result.review.review.grades[0] ?? null;
  const summary = {
    dateKst: args.dateKst,
    wrote: result.wrote,
    dryRun: args.dryRun,
    reviewRel: result.reviewRel,
    scorecardRel: result.scorecardRel,
    sampleLane: result.review.meta.sampleLane,
    reviewLane: result.review.review.reviewLane,
    officialKpi: result.review.review.officialKpi,
    graded: result.review.review.summary.graded,
    correct: result.review.review.summary.correct,
    incorrect: result.review.review.summary.incorrect,
    blocked: result.review.review.summary.blocked,
    predictedSide: grade?.predictedSide ?? null,
    actualSide: grade?.actualSide ?? null,
    verdict: grade?.verdict ?? null,
    exactMatch: grade?.exactMatch ?? null,
    blockReason: grade?.blockReason ?? null,
    accuracy: result.scorecard.scorecard.metrics.accuracy,
    meanBrier: result.scorecard.scorecard.metrics.meanBrier,
    meanLogLoss: result.scorecard.scorecard.metrics.meanLogLoss,
    engineImpact: result.scorecard.scorecard.engineImpact,
    predictionFormulaConnected:
      result.scorecard.scorecard.predictionFormulaConnected,
    insufficientSample: result.scorecard.meta.insufficientSample,
    sourceMarketBaselinePredictionHash:
      result.review.meta.sourceMarketBaselinePredictionHash,
    sourceOfficialResultArtifactHash:
      result.review.meta.sourceOfficialResultArtifactHash,
    sourceMatchResultHash: result.review.meta.sourceMatchResultHash,
    prediction: "NONE",
    engine: "NONE",
    recommendation: "NONE",
    officialPickCount: 0,
    providerCalls: 0,
  };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(
      [
        `wrote=${summary.wrote}`,
        `review=${summary.reviewRel}`,
        `scorecard=${summary.scorecardRel}`,
        `verdict=${summary.verdict}`,
        `exactMatch=${summary.exactMatch}`,
        `graded=${summary.graded} correct=${summary.correct} incorrect=${summary.incorrect} blocked=${summary.blocked}`,
        `officialKpi.eligible=${summary.officialKpi.eligible}`,
        `accuracy=${summary.accuracy}`,
        `brier=${summary.meanBrier}`,
        `logLoss=${summary.meanLogLoss}`,
        `engineImpact=${summary.engineImpact}`,
      ].join("\n"),
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
