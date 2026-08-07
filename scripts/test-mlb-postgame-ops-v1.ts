/**
 * MLB Postgame Ops One-Command v1 tests.
 * Run: npm run test:mlb-postgame-ops-v1
 *
 * Does not mutate repo Prediction / Recommendation Record.
 * FINAL / partial fixtures run in isolated temp cwd.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  gradeEngineRecommendationRecord,
  preflightMlbPostgameOps,
  runMlbPostgameOpsV1,
} from "../src/lib/mlb/postgame-ops-v1";
import { gradeMlbPredictionsV1 } from "../src/lib/mlb/grade-mlb-predictions-v1";
import { buildMlbPredictionReviewsV1 } from "../src/lib/mlb/build-mlb-prediction-reviews-v1";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function copyRel(root: string, cwd: string, rel: string) {
  const src = path.join(root, rel);
  const dest = path.join(cwd, rel);
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest);
}

async function main() {
  const root = process.cwd();
  const pred08 = "data/predictions/mlb/2026-08-08.json";
  const rec08 =
    "data/recommendations/mlb/2026-08-08-engine-recommendations-v1.json";
  const beforePred = sha256File(pred08);
  const beforeRec = sha256File(rec08);
  const mtimePred = statSync(pred08).mtimeMs;
  const mtimeRec = statSync(rec08).mtimeMs;
  const hash08 = JSON.parse(readFileSync(pred08, "utf8")).meta
    .predictionHashSha256 as string;
  assert.ok(hash08.startsWith("809b3973"));

  // --- 08-07 NO_PREGAME_SNAPSHOT ---
  const r07 = await runMlbPostgameOpsV1({
    dateKst: "2026-08-07",
    assessOnly: true,
  });
  assert.equal(r07.opsSuccess, false);
  assert.equal(r07.lifecycle, "NO_PREGAME_SNAPSHOT");
  assert.equal(r07.failure?.reason, "NO_PREGAME_SNAPSHOT");
  assert.equal(r07.allResearch, null);
  assert.equal(r07.engineGoodPicks.total, 0);
  assert.match(r07.operatorSummaryText, /NO_PREGAME_SNAPSHOT/);
  assert.match(r07.operatorSummaryText, /사후 Prediction 생성 금지/);

  // --- 08-08 assess: sealed record, awaiting results ---
  const r08 = await runMlbPostgameOpsV1({
    dateKst: "2026-08-08",
    assessOnly: true,
  });
  assert.equal(r08.opsSuccess, true);
  assert.ok(
    r08.lifecycle === "AWAITING_RESULT" || r08.lifecycle === "PREGAME_READY",
  );
  assert.equal(r08.provenance?.status, "PRE_GAME_SNAPSHOT_VERIFIED");
  assert.equal(r08.engineGoodPicks.recordStatus, "SEALED");
  assert.equal(r08.engineGoodPicks.total, 3);
  assert.ok(r08.immutableAudit.predictionUnchanged);
  assert.ok(r08.immutableAudit.recommendationUnchanged);
  assert.equal(sha256File(pred08), beforePred);
  assert.equal(sha256File(rec08), beforeRec);
  assert.equal(statSync(pred08).mtimeMs, mtimePred);
  assert.equal(statSync(rec08).mtimeMs, mtimeRec);

  // --- Fixture: FINAL slate in temp cwd ---
  const finalCwd = mkdtempSync(path.join(tmpdir(), "mlb-postgame-final-"));
  const dateKst = "2026-08-08";
  const sealed = JSON.parse(readFileSync(rec08, "utf8")) as {
    picks: Array<{
      gameId: string;
      gamePk: number | null;
      pick: string | null;
      pickSide: string | null;
    }>;
    predictionHash: string;
  };
  const scheduleRel = `data/research/mlb/${dateKst}-schedule-v1.json`;
  const summaryRel = `data/research/mlb/${dateKst}-daily-research-summary-v1.json`;
  copyRel(root, finalCwd, pred08);
  copyRel(root, finalCwd, rec08);
  copyRel(root, finalCwd, scheduleRel);
  if (existsSync(path.join(root, summaryRel))) {
    copyRel(root, finalCwd, summaryRel);
  }
  // Copy starter/odds/lineup if present (review may reference)
  for (const rel of [
    `data/research/mlb/${dateKst}-starter-dataset-v1.json`,
    `data/research/mlb/${dateKst}-odds-history-dataset-v1.json`,
    `data/research/mlb/${dateKst}-lineup-dataset-v1.json`,
  ]) {
    if (existsSync(path.join(root, rel))) copyRel(root, finalCwd, rel);
  }

  const schedule = JSON.parse(
    readFileSync(path.join(finalCwd, scheduleRel), "utf8"),
  ) as {
    games: Array<{
      gamePk: number;
      internalGameId: string;
      homeTeam: string;
      awayTeam: string;
    }>;
  };

  const pickByGameId = new Map(
    sealed.picks.map((p) => [p.gameId, p] as const),
  );

  // All FINAL — winners: first sealed pick CORRECT, second INCORRECT, third CORRECT
  const resultsGames = schedule.games.map((g, idx) => {
    const sealedPick = pickByGameId.get(g.internalGameId);
    let homeScore = 3;
    let awayScore = 2;
    let winner: "HOME" | "AWAY" = "HOME";
    if (sealedPick) {
      const sealedIdx = sealed.picks.findIndex(
        (p) => p.gameId === g.internalGameId,
      );
      const wantCorrect = sealedIdx !== 1;
      const pickSide = sealedPick.pickSide;
      if (wantCorrect) {
        if (pickSide === "AWAY") {
          awayScore = 5;
          homeScore = 2;
          winner = "AWAY";
        } else {
          homeScore = 5;
          awayScore = 2;
          winner = "HOME";
        }
      } else {
        if (pickSide === "AWAY") {
          homeScore = 5;
          awayScore = 2;
          winner = "HOME";
        } else {
          awayScore = 5;
          homeScore = 2;
          winner = "AWAY";
        }
      }
    } else {
      // non-picks: alternate
      if (idx % 2 === 0) {
        winner = "HOME";
        homeScore = 4;
        awayScore = 1;
      } else {
        winner = "AWAY";
        homeScore = 1;
        awayScore = 4;
      }
    }
    return {
      gamePk: g.gamePk,
      internalGameId: g.internalGameId,
      status: "FINAL",
      awayTeam: g.awayTeam,
      homeTeam: g.homeTeam,
      awayScore,
      homeScore,
      winner,
      resultTimestamp: "2026-08-09T12:00:00.000Z",
    };
  });

  const resultsDoc = {
    schemaVersion: "mlb-official-results-v1",
    dateKst,
    provider: "MLB_STATSAPI",
    scheduleArtifact: `${dateKst}-schedule-v1.json`,
    collectedAt: "2026-08-09T12:00:00.000Z",
    games: resultsGames,
    resultHash: "",
  };
  // resultHash computed by grade if present — leave empty to skip mismatch check
  const resultsRel = `data/research/mlb/${dateKst}-official-results-v1.json`;
  mkdirSync(path.dirname(path.join(finalCwd, resultsRel)), { recursive: true });
  writeFileSync(
    path.join(finalCwd, resultsRel),
    `${JSON.stringify(resultsDoc, null, 2)}\n`,
  );

  const predBeforeFinal = sha256File(path.join(finalCwd, pred08));
  const recBeforeFinal = sha256File(path.join(finalCwd, rec08));

  const graded = await gradeMlbPredictionsV1({
    dateKst,
    cwd: finalCwd,
    results: resultsDoc as never,
  });
  await buildMlbPredictionReviewsV1({
    dateKst,
    cwd: finalCwd,
    graded: graded.document,
  });

  const engine = await gradeEngineRecommendationRecord({
    dateKst,
    cwd: finalCwd,
    generatedBeforeGame: true,
  });
  assert.equal(engine.recordStatus, "SEALED");
  assert.equal(engine.total, 3);
  assert.equal(engine.correct + engine.incorrect, 3);
  assert.equal(engine.correct, 2);
  assert.equal(engine.incorrect, 1);
  assert.equal(engine.accuracyPercent, 66.7);
  for (const row of engine.rows) {
    assert.ok(row.eligibleForRecord);
    assert.ok(row.pick);
    assert.equal(typeof row.researchOnly, "boolean");
  }

  const finalReport = await runMlbPostgameOpsV1({
    dateKst,
    cwd: finalCwd,
    assessOnly: true,
  });
  assert.equal(finalReport.opsSuccess, true);
  assert.equal(finalReport.lifecycle, "COMPLETED");
  assert.equal(finalReport.engineGoodPicks.correct, 2);
  assert.equal(finalReport.engineGoodPicks.incorrect, 1);
  assert.ok(finalReport.allResearch);
  assert.ok((finalReport.allResearch?.graded ?? 0) >= 1);
  assert.ok(finalReport.immutableAudit.predictionUnchanged);
  assert.ok(finalReport.immutableAudit.recommendationUnchanged);
  assert.equal(sha256File(path.join(finalCwd, pred08)), predBeforeFinal);
  assert.equal(sha256File(path.join(finalCwd, rec08)), recBeforeFinal);
  assert.match(finalReport.operatorSummaryText, /ALL RESEARCH PREDICTIONS/);
  assert.match(finalReport.operatorSummaryText, /ENGINE GOOD PICKS/);
  assert.match(finalReport.operatorSummaryText, /COMPLETED/);

  // Tracker line for sealed+graded day
  assert.ok(finalReport.trackerLine);
  assert.match(finalReport.trackerLine!, /2\/3|66\.7/);

  // --- Partial FINAL fixture ---
  const partialCwd = mkdtempSync(path.join(tmpdir(), "mlb-postgame-partial-"));
  copyRel(root, partialCwd, pred08);
  copyRel(root, partialCwd, rec08);
  copyRel(root, partialCwd, scheduleRel);
  const partialResults = {
    ...resultsDoc,
    games: resultsGames.map((g, i) =>
      i < 13
        ? g
        : {
            ...g,
            status: "LIVE",
            homeScore: null,
            awayScore: null,
            winner: null,
            resultTimestamp: null,
          },
    ),
  };
  mkdirSync(path.dirname(path.join(partialCwd, resultsRel)), {
    recursive: true,
  });
  writeFileSync(
    path.join(partialCwd, resultsRel),
    `${JSON.stringify(partialResults, null, 2)}\n`,
  );
  const gradedPartial = await gradeMlbPredictionsV1({
    dateKst,
    cwd: partialCwd,
    results: partialResults as never,
  });
  await buildMlbPredictionReviewsV1({
    dateKst,
    cwd: partialCwd,
    graded: gradedPartial.document,
  });
  const partialReport = await runMlbPostgameOpsV1({
    dateKst,
    cwd: partialCwd,
    assessOnly: true,
  });
  assert.equal(partialReport.resultsStatus?.final, 13);
  assert.equal(partialReport.resultsStatus?.notFinal, 2);
  assert.equal(partialReport.lifecycle, "AWAITING_RESULT");
  assert.ok(partialReport.immutableAudit.predictionUnchanged);
  assert.ok(partialReport.immutableAudit.recommendationUnchanged);

  // Preflight helper
  const pf07 = await preflightMlbPostgameOps({ dateKst: "2026-08-07" });
  assert.equal(pf07.ok, false);
  assert.equal(pf07.lifecycle, "NO_PREGAME_SNAPSHOT");
  const pf08 = await preflightMlbPostgameOps({ dateKst: "2026-08-08" });
  assert.equal(pf08.ok, true);
  assert.equal(pf08.recommendationRecord, "SEALED");

  // Repo mutation audit
  assert.equal(sha256File(pred08), beforePred);
  assert.equal(sha256File(rec08), beforeRec);
  assert.equal(statSync(pred08).mtimeMs, mtimePred);
  assert.equal(statSync(rec08).mtimeMs, mtimeRec);

  console.log("=== MLB POSTGAME OPS READY ===\n");
  console.log("Pregame command:");
  console.log("npm run ops:mlb-daily -- YYYY-MM-DD\n");
  console.log("Postgame command:");
  console.log("npm run ops:mlb-postgame -- YYYY-MM-DD\n");
  console.log("08-07:");
  console.log("NO_PREGAME_SNAPSHOT\n");
  console.log("08-08:");
  console.log(`Prediction: PRE_GAME_SNAPSHOT_VERIFIED · ${hash08.slice(0, 8)}…`);
  console.log("Recommendation Record: SEALED");
  console.log(`Postgame Status: ${r08.lifecycle}`);
  console.log("");
  console.log("Fixture FINAL Engine Good Picks:");
  console.log(
    `  ${engine.correct}/${engine.correct + engine.incorrect} · ${engine.accuracyPercent}%`,
  );
  console.log("test:mlb-postgame-ops-v1 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
