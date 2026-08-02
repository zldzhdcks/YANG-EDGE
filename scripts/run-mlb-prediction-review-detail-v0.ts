/**
 * CLI: MLB prediction review-detail v0 (observational postgame narrative).
 *   npx tsx scripts/run-mlb-prediction-review-detail-v0.ts --date 2026-08-02
 *   npx tsx scripts/run-mlb-prediction-review-detail-v0.ts --date 2026-08-02 --dry-run
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildMlbPredictionReviewDetailV0 } from "../src/lib/mlb/review-detail-v0";

function parseArgs(argv: string[]) {
  let dateKst: string | null = null;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--dry-run") dryRun = true;
    else if (a === "--date") dateKst = argv[++i] ?? null;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(a)) dateKst = a;
  }
  if (!dateKst) throw new Error("Usage: --date YYYY-MM-DD [--dry-run]");
  return { dateKst, dryRun };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const predAbs = path.join(
    process.cwd(),
    "data",
    "predictions",
    "mlb",
    `${args.dateKst}.json`,
  );
  const before = createHash("sha256")
    .update(await readFile(predAbs))
    .digest("hex");

  // dry-run first validation path when requested
  if (args.dryRun) {
    const dry = await buildMlbPredictionReviewDetailV0({
      dateKst: args.dateKst,
      dryRun: true,
    });
    console.log(`dryRun wrote=${dry.wrote}`);
  }

  const { document, pathRel, wrote } = await buildMlbPredictionReviewDetailV0({
    dateKst: args.dateKst,
    dryRun: args.dryRun,
  });

  const after = createHash("sha256")
    .update(await readFile(predAbs))
    .digest("hex");
  if (before !== after) {
    console.error("FATAL: prediction snapshot mutated");
    process.exit(1);
  }

  const dm = document.dailyMetrics as Record<string, unknown>;
  const mc = document.marketComparison as Record<string, unknown>;
  const focus = mc.focusGames as Record<string, Record<string, unknown>>;
  const blocked = document.blockedPolicyReview as {
    judgment: string;
    games: Array<Record<string, unknown>>;
  };
  const patterns = document.repeatedPatterns as Array<Record<string, unknown>>;
  const hyps = document.hypothesisCandidates as Array<Record<string, unknown>>;

  console.log(`=== MLB Review Detail v0 (${args.dateKst}) ===`);
  console.log(
    `Research: correct=${dm.researchCorrect} incorrect=${dm.researchIncorrect} blocked=${dm.blocked}`,
  );
  console.log(`Brier=${dm.meanBrier} LogLoss=${dm.meanLogLoss}`);
  const agree = (mc.scorecardMarketAgreement as Record<string, { correct: number; incorrect: number; sampleCount: number }>).MODEL_AND_MARKET_AGREE;
  const near = (mc.scorecardMarketAgreement as Record<string, { correct: number; incorrect: number; sampleCount: number }>).NEAR_EVEN;
  const side = mc.sideFavoriteDisagreement as {
    sampleCount: number;
    correct: number;
    incorrect: number;
  };
  console.log(
    `Market agree(class): ${agree.correct}/${agree.sampleCount} | NEAR_EVEN: ${near.correct}/${near.sampleCount} | side-disagree: ${side.correct}/${side.sampleCount}`,
  );
  console.log(
    `PIT@CIN: model=${focus.pitAtCin?.modelSelection} marketFav=${focus.pitAtCin?.marketFavorite} actual=${focus.pitAtCin?.actualWinner} grade=${focus.pitAtCin?.grade}`,
  );
  console.log(
    `MIL@LAA: model=${focus.milAtLaa?.modelSelection} marketFav=${focus.milAtLaa?.marketFavorite} actual=${focus.milAtLaa?.actualWinner} grade=${focus.milAtLaa?.grade}`,
  );
  for (const b of blocked.games) {
    console.log(
      `BLOCKED ${b.matchup}: hypo=${b.hypotheticalSelection} cf=${b.counterfactualGrade} judgment=${b.policyJudgment}`,
    );
  }
  console.log(`blockedPolicy=${blocked.judgment}`);
  console.log("Patterns:");
  for (const p of patterns.slice(0, 5)) {
    console.log(`- ${p.patternId} [${p.currentStatus}] n=${p.sampleCount}`);
  }
  console.log("Hypotheses:");
  for (const h of hyps.slice(0, 3)) {
    console.log(`- ${h.hypothesisId}: ${h.status}`);
  }
  console.log(`wrote=${wrote} path=${pathRel}`);
  console.log(`snapshotMutation=0`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
