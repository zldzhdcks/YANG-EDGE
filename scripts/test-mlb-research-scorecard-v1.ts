/**
 * Tests: MLB Research Scorecard v1 (read-only).
 * Run: npm run test:mlb-research-scorecard-v1
 *
 * Does not mutate Prediction / Recommendation / operator / results artifacts.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildMlbResearchScorecardV1,
  buildMlbResearchScorecardV1Cumulative,
  isGradedResearchRow,
  MLB_RESEARCH_SCORECARD_V1_SCHEMA,
} from "../src/lib/mlb/research-scorecard-v1";

const ROOT = process.cwd();

const HISTORICAL_HASHES: Record<string, string> = {
  "data/predictions/mlb/2026-08-12.json":
    "9dc637ba8bb19c32ab1208e3c31a2a977b017408e5c13594b027a0aa2ee7b92b",
  "data/predictions/mlb/2026-08-13.json":
    "ada3b649f8346331f23026e7b6ff0782b2ce9bbbf99399d4924d2efc08ae4386",
  "data/predictions/mlb/2026-08-14.json":
    "f6d399614c02e1e4d143e565bd3b57feaf406f1f78f53beb3b7d83ea42098e68",
  "data/recommendations/mlb/2026-08-12-engine-recommendations-v1.json":
    "d01e3e1af7c0e466855ee79d6bb7c9076623b69531d80d2ce359f4a4bc1ad70c",
  "data/recommendations/mlb/2026-08-13-engine-recommendations-v1.json":
    "7fffff24d37856063c978f943ce5efb8563915f5fe1ead4f2440707e2c84784c",
  "data/recommendations/mlb/2026-08-14-engine-recommendations-v1.json":
    "f0152b9d70f8b1a9911391ebbb2b94fa8cd4ebbdbc654384187614a98ed26812",
  "data/operator-input/mlb/2026-08-12-korean-market-odds-observation-v0.json":
    "43243edf48fd049c50ae97533182592ef1c0b1a332d57ce5ed27451d40e64a0b",
  "data/operator-input/mlb/2026-08-13-korean-market-odds-observation-v0.json":
    "9b234225e6894a9ccf97df255c1266f55fa4688916e04941788423202f7e86f1",
  "data/operator-input/mlb/2026-08-14-korean-market-odds-observation-v0.json":
    "46138abb813de724853a362d566bf4458bb38f87c560edca31af230977e2970a",
  "data/operator-input/mlb/2026-08-12-expected-lineup-observation-v0.json":
    "dddaad9bf294089e3a7a4a45bb5c48f0f0c4c2b09728dfe78ca996d14392c5a6",
  "data/operator-input/mlb/2026-08-13-expected-lineup-observation-v0.json":
    "2c4f714780551f4a9224c64e93ce5e176679d7e42b254bae33b2130e926a29cc",
  "data/operator-input/mlb/2026-08-14-expected-lineup-observation-v0.json":
    "efa5d1490e897c74c3f4320687be7ac299616f3b5dbee7920eac86bcafddad39",
  "data/research/mlb/2026-08-12-official-results-v1.json":
    "51e422ae1df5a6b8c520309abfb6c9cee6c39e19fab127305ddb5168adc17677",
  "data/research/mlb/2026-08-13-official-results-v1.json":
    "e159c2fc6590c8320b77abd96be95b2ba623b05fbf89d6f68619f08baec1cb8d",
  "data/research/mlb/2026-08-12-graded-predictions-v1.json":
    "9c7156c1b27bf23ad4ae1608f77bd2d5674e5b19ef139feae3cff716199eda9a",
  "data/research/mlb/2026-08-13-graded-predictions-v1.json":
    "f6724ea776a6dd60b7e58657d7a96508d4baf0d596bb2380bccc7435f915af8e",
  "data/research/mlb/2026-08-12-success-review-v1.json":
    "5a5fccddd3b919afb442e621fb3745a4993b1eae7d45c4283e60d0b5ec223b56",
  "data/research/mlb/2026-08-13-success-review-v1.json":
    "801af3a91a71774634729bbd593b3d9218bd7fef9565cafc1bcf0f7968395b21",
  "data/research/mlb/2026-08-12-failure-review-v1.json":
    "143d79175356fe337deb24c5630e19a1724a5ee09739130e1f7737bd43e6dcb2",
  "data/research/mlb/2026-08-13-failure-review-v1.json":
    "b74928433a4566f768ad6f0861a7d5897d200e8ee784d87eee7593b339696696",
};

function sha256File(rel: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(ROOT, rel)))
    .digest("hex");
}

function snapshotHistorical(): Record<string, { hash: string; mtimeMs: number }> {
  const out: Record<string, { hash: string; mtimeMs: number }> = {};
  for (const rel of Object.keys(HISTORICAL_HASHES)) {
    const abs = path.join(ROOT, rel);
    out[rel] = {
      hash: sha256File(rel),
      mtimeMs: statSync(abs).mtimeMs,
    };
  }
  return out;
}

function assertHistoricalUnchanged(
  label: string,
  before?: Record<string, { hash: string; mtimeMs: number }>,
) {
  for (const [rel, expected] of Object.entries(HISTORICAL_HASHES)) {
    assert.equal(sha256File(rel), expected, `${label} hash: ${rel}`);
  }
  if (before) {
    const after = snapshotHistorical();
    for (const rel of Object.keys(HISTORICAL_HASHES)) {
      assert.equal(after[rel]!.hash, before[rel]!.hash, `${label} hash snap: ${rel}`);
      assert.equal(
        after[rel]!.mtimeMs,
        before[rel]!.mtimeMs,
        `${label} mtime: ${rel}`,
      );
    }
  }
}

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...collectTsFiles(p));
    else if (name.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

const PREGAME_08_14 = [
  "data/research/mlb/2026-08-14-schedule-v1.json",
  "data/predictions/mlb/2026-08-14.json",
  "data/recommendations/mlb/2026-08-14-engine-recommendations-v1.json",
  "data/research/mlb/2026-08-14-starter-dataset-v1.json",
  "data/research/mlb/2026-08-14-odds-history-dataset-v1.json",
  "data/research/mlb/2026-08-14-lineup-dataset-v1.json",
  "data/operator-input/mlb/2026-08-14-korean-market-odds-observation-v0.json",
  "data/operator-input/mlb/2026-08-14-expected-lineup-observation-v0.json",
];

function copyRel(fromRoot: string, toRoot: string, rel: string) {
  const dest = path.join(toRoot, rel);
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(path.join(fromRoot, rel), dest);
}

function listRelFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${name.name}` : name.name;
      if (name.isDirectory()) walk(path.join(dir, name.name), rel);
      else out.push(rel.replace(/\\/g, "/"));
    }
  };
  walk(root, "");
  return out.sort();
}

function stage08_14(tmp: string) {
  for (const rel of PREGAME_08_14) copyRel(ROOT, tmp, rel);
}

async function rejectsWith(
  fn: () => Promise<unknown>,
  needle: string,
  label: string,
) {
  try {
    await fn();
    assert.fail(`${label}: expected throw containing ${needle}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    assert.equal(msg.includes(needle), true, `${label}: ${msg}`);
  }
}

async function main() {
  const historicalBefore = snapshotHistorical();
  assertHistoricalUnchanged("before", historicalBefore);

  const libDir = path.join(ROOT, "src/lib/mlb/research-scorecard-v1");
  for (const file of collectTsFiles(libDir)) {
    const text = readFileSync(file, "utf8");
    assert.equal(
      /prediction-v0\/(load-and-predict|compute-moneyline)/.test(text),
      false,
      `Engine prediction import in ${file}`,
    );
    assert.equal(
      /from ["']@\/lib\/mlb\/prediction-v0["']/.test(text),
      false,
      `prediction-v0 barrel import in ${file}`,
    );
  }

  const d12 = await buildMlbResearchScorecardV1({
    dateKst: "2026-08-12",
    dryRun: true,
    generatedAt: "2026-08-13T00:00:00.000Z",
  });
  const d13 = await buildMlbResearchScorecardV1({
    dateKst: "2026-08-13",
    dryRun: true,
    generatedAt: "2026-08-13T00:00:00.000Z",
  });
  const d14 = await buildMlbResearchScorecardV1({
    dateKst: "2026-08-14",
    dryRun: true,
    generatedAt: "2026-08-13T00:00:00.000Z",
  });

  assert.equal(d12.document.meta.schemaVersion, MLB_RESEARCH_SCORECARD_V1_SCHEMA);
  assert.equal(d12.document.meta.engineAdmission, "PROHIBITED");
  assert.equal(d12.document.meta.autoApply, false);
  assert.equal(d12.document.rows.length, 15);
  assert.equal(d13.document.rows.length, 15);
  assert.equal(d14.document.rows.length, 9);

  assert.equal(d12.document.calibration.gradedN, 13);
  assert.equal(d12.document.calibration.correct, 6);
  assert.equal(d12.document.calibration.incorrect, 7);
  assert.equal(d13.document.calibration.gradedN, 14);
  assert.equal(d13.document.calibration.correct, 9);
  assert.equal(d13.document.calibration.incorrect, 5);

  assert.equal(d14.document.meta.awaitingResults, 9);
  assert.ok(d14.document.rows.every((r) => r.resultStatus === "AWAITING"));
  assert.ok(d14.document.rows.every((r) => r.predictionCorrect === null));
  assert.ok(d14.document.rows.every((r) => r.actualWinnerSide === null));
  assert.equal(d14.document.calibration.gradedN, 0);
  assert.equal(
    d14.document.rows.some((r) => r.resultStatus === "FINAL"),
    false,
  );

  const minn = d14.document.rows.find((r) => r.gamePk === 823669);
  assert.ok(minn);
  assert.equal(minn.selectedPick, "Minnesota Twins");
  assert.equal(minn.selectedPickSide, "HOME");
  assert.equal(minn.selectedPickProbability, 53.3);
  assert.equal(minn.isGoodPick, true);
  assert.equal(minn.officialPick, null);
  assert.equal(minn.inputConfidence, 73);
  assert.notEqual(minn.selectedPickProbability, minn.inputConfidence);
  assert.equal(minn.recommendationResearchOnly, true);

  const tb = d13.document.rows.find((r) => r.gamePk === 824967);
  assert.ok(tb);
  assert.equal(tb.internalGameId, "mlb-athletics-tampa-bay-rays");
  assert.equal(tb.selectedPickSide, "AWAY");
  assert.equal(tb.selectedPick, "Tampa Bay Rays");
  assert.equal(tb.selectedPickProbability, 54.7);
  assert.notEqual(tb.selectedPickProbability, 45.3);
  assert.equal(tb.isGoodPick, true);
  assert.equal(tb.inputConfidence, 73);
  assert.equal(tb.selectedPickProbabilitySource, "market_research_baseline");

  for (const doc of [d12.document, d13.document, d14.document]) {
    for (const row of doc.rows) {
      if (row.koreanMarketObservationStatus === "OBSERVED") {
        assert.equal(
          row.koreanMarketTimingRelativeToPrediction,
          "AFTER_PREDICTION_BUT_BEFORE_GAME",
        );
      }
      if (row.expectedLineupObservationStatus === "OBSERVED") {
        assert.equal(
          row.expectedLineupTimingRelativeToPrediction,
          "AFTER_PREDICTION_BUT_BEFORE_GAME",
        );
        assert.equal(row.expectedLineupStatus, "EXPECTED");
        assert.equal(row.expectedLineupPostPredictionPregameObservation, true);
      }
      assert.notEqual(row.expectedLineupStatus, "CONFIRMED");
      assert.equal(row.expectedLineupUsedByPrediction, false);
      assert.equal(row.reviewTagDataClass, "POSTGAME_REVIEW_TAG");
      if (row.inputConfidence === 73) {
        assert.notEqual(row.selectedPickProbability, 73);
      }
      assert.equal(row.officialPick, null);
    }
    assert.equal(doc.expectedLineupCoverage.confirmedStatusCount, 0);
    assert.equal(doc.expectedLineupCoverage.usedByPredictionCount, 0);
    assert.equal(doc.marketBenchmark.providerConfirmed, false);
    assert.equal(doc.marketBenchmark.koreanUsedAsEngineInput, false);
    assert.equal(doc.researchStatus.promotion, "PROHIBITED");
    assert.ok(
      !doc.researchStatus.forbiddenConclusions.includes(
        doc.researchStatus.overall as never,
      ),
    );
  }

  const good12 = d12.document.recommendationSelection.goodPick;
  const good13 = d13.document.recommendationSelection.goodPick;
  assert.equal(good12.n, 1);
  assert.equal(good12.incorrect, 1);
  assert.equal(good13.n, 3);
  assert.equal(good13.correct + good13.incorrect, 3);

  const cum = await buildMlbResearchScorecardV1Cumulative({
    dates: ["2026-08-12", "2026-08-13", "2026-08-14"],
    dryRun: true,
    generatedAt: "2026-08-13T00:00:00.000Z",
  });
  assert.equal(cum.document.rowCount, 39);
  assert.equal(cum.document.awaitingExcludedFromOutcomes, 9);
  assert.equal(cum.document.calibration.gradedN, 27);
  assert.equal(cum.document.calibration.correct, 15);
  assert.equal(cum.document.calibration.incorrect, 12);
  assert.equal(cum.document.calibration.sampleStatus, "EARLY_SAMPLE");
  assert.equal(cum.document.recommendationSelection.goodPick.n, 4);
  assert.equal(
    cum.document.recommendationSelection.goodPick.sampleStatus,
    "INSUFFICIENT_SAMPLE",
  );
  assert.equal(
    cum.document.meta.outcomeDenominatorExcludesAwaiting,
    true,
  );
  const awaitingInDenom = cum.document.calibration.gradedN !== 27;
  assert.equal(awaitingInDenom, false);

  const graded14 = d14.document.rows.filter(isGradedResearchRow);
  assert.equal(graded14.length, 0);

  assert.ok(d12.wrote === false && d13.wrote === false && d14.wrote === false);
  assert.equal(
    existsSync(path.join(ROOT, "data/research/mlb/2026-08-14-official-results-v1.json")),
    false,
  );

  const d12b = await buildMlbResearchScorecardV1({
    dateKst: "2026-08-12",
    dryRun: true,
    generatedAt: "2099-01-01T00:00:00.000Z",
  });
  assert.notEqual(d12.document.meta.generatedAt, d12b.document.meta.generatedAt);
  assert.equal(d12.document.meta.scorecardHash, d12b.document.meta.scorecardHash);
  assert.deepEqual(d12.document.rows, d12b.document.rows);
  assert.deepEqual(d12.document.calibration, d12b.document.calibration);
  assert.deepEqual(
    d12.document.recommendationSelection,
    d12b.document.recommendationSelection,
  );

  const cumB = await buildMlbResearchScorecardV1Cumulative({
    dates: ["2026-08-12", "2026-08-13", "2026-08-14"],
    dryRun: true,
    generatedAt: "2099-01-01T00:00:00.000Z",
  });
  assert.notEqual(cum.document.meta.generatedAt, cumB.document.meta.generatedAt);
  assert.equal(cum.document.meta.scorecardHash, cumB.document.meta.scorecardHash);
  assert.deepEqual(cum.document.calibration, cumB.document.calibration);

  const tmp = mkdtempSync(path.join(tmpdir(), "mlb-scorecard-v1-"));
  try {
    stage08_14(tmp);
    const beforeHashes = Object.fromEntries(
      PREGAME_08_14.map((rel) => [
        rel,
        createHash("sha256").update(readFileSync(path.join(tmp, rel))).digest("hex"),
      ]),
    );
    const beforeFiles = listRelFiles(tmp);
    const wroteDaily = await buildMlbResearchScorecardV1({
      dateKst: "2026-08-14",
      cwd: tmp,
      dryRun: false,
      generatedAt: "2026-08-13T00:00:00.000Z",
    });
    assert.equal(wroteDaily.wrote, true);
    assert.equal(
      wroteDaily.outRel,
      "data/research/mlb/2026-08-14-research-scorecard-v1.json",
    );
    assert.equal(existsSync(path.join(tmp, wroteDaily.outRel)), true);
    const wroteCum = await buildMlbResearchScorecardV1Cumulative({
      dates: ["2026-08-14"],
      cwd: tmp,
      dryRun: false,
      generatedAt: "2026-08-13T00:00:00.000Z",
    });
    assert.equal(wroteCum.wrote, true);
    assert.equal(
      wroteCum.outRel,
      "data/research/mlb/research-scorecard-v1-cumulative.json",
    );
    const afterFiles = listRelFiles(tmp);
    const added = afterFiles.filter((f) => !beforeFiles.includes(f));
    assert.deepEqual(added.sort(), [
      "data/research/mlb/2026-08-14-research-scorecard-v1.json",
      "data/research/mlb/research-scorecard-v1-cumulative.json",
    ]);
    for (const rel of PREGAME_08_14) {
      const after = createHash("sha256")
        .update(readFileSync(path.join(tmp, rel)))
        .digest("hex");
      assert.equal(after, beforeHashes[rel], `temp source mutated: ${rel}`);
    }
    assert.equal(
      existsSync(path.join(tmp, "data/predictions/mlb/2026-08-14.json")),
      true,
    );
    const tmpPred = path.join(tmp, "data/predictions/mlb");
    assert.deepEqual(
      readdirSync(tmpPred).sort(),
      ["2026-08-14.json"],
    );

    const malformed = mkdtempSync(path.join(tmpdir(), "mlb-scorecard-malformed-"));
    try {
      stage08_14(malformed);
      const badRel = "data/research/mlb/2026-08-14-official-results-v1.json";
      mkdirSync(path.join(malformed, "data/research/mlb"), { recursive: true });
      writeFileSync(path.join(malformed, badRel), "{not-json", "utf8");
      await rejectsWith(
        () =>
          buildMlbResearchScorecardV1({
            dateKst: "2026-08-14",
            cwd: malformed,
            dryRun: true,
          }),
        "ARTIFACT_JSON_INVALID",
        "malformed official-results",
      );
    } finally {
      rmSync(malformed, { recursive: true, force: true });
    }

    const gradeTmp = mkdtempSync(path.join(tmpdir(), "mlb-scorecard-grade-"));
    try {
      stage08_14(gradeTmp);
      const schedule = JSON.parse(
        readFileSync(
          path.join(gradeTmp, "data/research/mlb/2026-08-14-schedule-v1.json"),
          "utf8",
        ),
      ) as { games: Array<{ gamePk: number; internalGameId: string }> };
      const g0 = schedule.games[0]!;
      writeFileSync(
        path.join(gradeTmp, "data/research/mlb/2026-08-14-graded-predictions-v1.json"),
        JSON.stringify({
          schemaVersion: "mlb-graded-predictions-v1",
          dateKst: "2026-08-14",
          games: [
            {
              gamePk: g0.gamePk,
              gameId: g0.internalGameId,
              grade: "CORRECT",
            },
          ],
        }),
        "utf8",
      );
      await rejectsWith(
        () =>
          buildMlbResearchScorecardV1({
            dateKst: "2026-08-14",
            cwd: gradeTmp,
            dryRun: true,
          }),
        "GRADE_WITHOUT_FINAL_RESULT",
        "grade without FINAL",
      );
    } finally {
      rmSync(gradeTmp, { recursive: true, force: true });
    }

    const winnerTmp = mkdtempSync(path.join(tmpdir(), "mlb-scorecard-winner-"));
    try {
      stage08_14(winnerTmp);
      const schedule = JSON.parse(
        readFileSync(
          path.join(winnerTmp, "data/research/mlb/2026-08-14-schedule-v1.json"),
          "utf8",
        ),
      ) as {
        games: Array<{
          gamePk: number;
          internalGameId: string;
          awayTeam: string;
          homeTeam: string;
        }>;
      };
      const g0 = schedule.games[0]!;
      writeFileSync(
        path.join(winnerTmp, "data/research/mlb/2026-08-14-official-results-v1.json"),
        JSON.stringify({
          schemaVersion: "mlb-official-results-v1",
          dateKst: "2026-08-14",
          games: [
            {
              gamePk: g0.gamePk,
              internalGameId: g0.internalGameId,
              status: "NOT_FINAL",
              awayTeam: g0.awayTeam,
              homeTeam: g0.homeTeam,
              awayScore: 1,
              homeScore: 2,
              winner: "HOME",
            },
          ],
        }),
        "utf8",
      );
      await rejectsWith(
        () =>
          buildMlbResearchScorecardV1({
            dateKst: "2026-08-14",
            cwd: winnerTmp,
            dryRun: true,
          }),
        "NONFINAL_RESULT_HAS_WINNER",
        "non-FINAL winner",
      );
    } finally {
      rmSync(winnerTmp, { recursive: true, force: true });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  assertHistoricalUnchanged("after", historicalBefore);
  console.log("test:mlb-research-scorecard-v1 PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
