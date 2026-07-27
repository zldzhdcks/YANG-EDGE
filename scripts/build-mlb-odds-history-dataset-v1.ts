/**
 * Build MLB Odds History Dataset v1 for a KST date.
 *
 * - PRE_GAME_MARKET only (frozen prediction odds + timeline enrichment)
 * - No closing / post-game odds
 * - Engine PROHIBITED
 *
 *   npx tsx --env-file=.env.local scripts/build-mlb-odds-history-dataset-v1.ts [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertOddsHistoryDatasetIntegrity,
  buildOddsHistoryDatasetV1,
} from "../src/lib/mlb/build-odds-history-dataset";

const DATE =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  "2026-07-27";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function readHashIfExists(rel: string): Promise<string | null> {
  try {
    return sha256(await readFile(path.join(process.cwd(), rel), "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  console.log(`=== Build MLB Odds History Dataset v1 (${DATE}) ===`);

  const predPath = path.join(
    process.cwd(),
    "data/predictions/mlb",
    `${DATE}.json`,
  );
  const predRawBefore = await readFile(predPath, "utf8");
  const predHashBefore = sha256(predRawBefore);

  const regressionBefore = {
    prediction: predHashBefore,
    starter: await readHashIfExists(
      `data/research/mlb/${DATE}-starter-dataset-v1.json`,
    ),
    bullpen: await readHashIfExists(
      `data/research/mlb/${DATE}-bullpen-role-dataset-v1_1.json`,
    ),
    lineup: await readHashIfExists(
      `data/research/mlb/${DATE}-lineup-dataset-v1.json`,
    ),
    weather: await readHashIfExists(
      `data/research/mlb/${DATE}-weather-dataset-v1.json`,
    ),
    travel: await readHashIfExists(
      `data/research/mlb/${DATE}-travel-rest-dataset-v1.json`,
    ),
  };

  const first = await buildOddsHistoryDatasetV1({
    dateKst: DATE,
    predictionRaw: predRawBefore,
  });
  const integrity = assertOddsHistoryDatasetIntegrity(first.document);
  if (integrity.length > 0) {
    throw new Error(`integrity failed:\n- ${integrity.join("\n- ")}`);
  }

  const second = await buildOddsHistoryDatasetV1({
    dateKst: DATE,
    predictionRaw: predRawBefore,
  });
  const hashMatched =
    first.document.meta.resultHashSha256 ===
    second.document.meta.resultHashSha256;

  if (!hashMatched) {
    throw new Error(
      `resultHash mismatch: ${first.document.meta.resultHashSha256} != ${second.document.meta.resultHashSha256}`,
    );
  }

  if (second.usage.networkCalls !== 0) {
    throw new Error(
      `warm networkCalls must be 0, got ${second.usage.networkCalls}`,
    );
  }

  const outDataset = path.join(
    process.cwd(),
    "data/research/mlb",
    `${DATE}-odds-history-dataset-v1.json`,
  );
  const outAudit = path.join(
    process.cwd(),
    "data/audits",
    `${DATE}-odds-history-dataset-v1-audit.json`,
  );

  await mkdir(path.dirname(outDataset), { recursive: true });
  await writeFile(
    outDataset,
    `${JSON.stringify(first.document, null, 2)}\n`,
    "utf8",
  );

  const predHashAfter = sha256(await readFile(predPath, "utf8"));
  if (predHashAfter !== predHashBefore) {
    throw new Error("prediction snapshot mutated");
  }

  const regressionAfter = {
    prediction: predHashAfter,
    starter: await readHashIfExists(
      `data/research/mlb/${DATE}-starter-dataset-v1.json`,
    ),
    bullpen: await readHashIfExists(
      `data/research/mlb/${DATE}-bullpen-role-dataset-v1_1.json`,
    ),
    lineup: await readHashIfExists(
      `data/research/mlb/${DATE}-lineup-dataset-v1.json`,
    ),
    weather: await readHashIfExists(
      `data/research/mlb/${DATE}-weather-dataset-v1.json`,
    ),
    travel: await readHashIfExists(
      `data/research/mlb/${DATE}-travel-rest-dataset-v1.json`,
    ),
  };

  const regressionUnchanged =
    regressionBefore.prediction === regressionAfter.prediction &&
    regressionBefore.starter === regressionAfter.starter &&
    regressionBefore.bullpen === regressionAfter.bullpen &&
    regressionBefore.lineup === regressionAfter.lineup &&
    regressionBefore.weather === regressionAfter.weather &&
    regressionBefore.travel === regressionAfter.travel;

  const audit = {
    meta: {
      version: "mlb-odds-history-dataset-v1-audit",
      kind: "odds-history-dataset-v1-build-audit",
      datasetId: "mlb-odds-history",
      schemaVersion: first.document.meta.schemaVersion,
      builderVersion: first.document.meta.builderVersion,
      dateKst: DATE,
      generatedAt: new Date().toISOString(),
      datasetStatus: "COLLECTING",
      engineAdmission: "PROHIBITED",
      engineConnected: false,
      researchOnly: true,
      predictionHashSha256: predHashBefore,
      predictionUnchanged: predHashAfter === predHashBefore,
      inputHashSha256: first.document.meta.inputHashSha256,
      resultHashSha256: first.document.meta.resultHashSha256,
      firstResultHash: first.document.meta.resultHashSha256,
      secondResultHash: second.document.meta.resultHashSha256,
      hashMatched,
    },
    games: first.document.summary.totalGames,
    openingCollected: first.document.summary.openingCollected,
    latestCollected: first.document.summary.latestCollected,
    marketProbabilityCollected:
      first.document.summary.marketProbabilityCollected,
    movement: first.document.summary.movement,
    joinQuality: first.document.summary.joinQuality,
    provider: first.document.rows[0]?.provider ?? null,
    cacheUsage: {
      firstRun: first.document.cacheUsage,
      secondRunWarm: second.document.cacheUsage,
    },
    networkCalls: {
      firstRun: first.document.cacheUsage.networkCalls,
      secondRunWarm: second.usage.networkCalls,
    },
    regressionHashes: {
      before: regressionBefore,
      after: regressionAfter,
      unchanged: regressionUnchanged,
    },
    checks: [
      {
        id: "prediction-hash-unchanged",
        passed: predHashAfter === predHashBefore,
        detail: predHashBefore,
      },
      {
        id: "result-hash-matched",
        passed: hashMatched,
        detail: `${first.document.meta.resultHashSha256} == ${second.document.meta.resultHashSha256}`,
      },
      {
        id: "warm-network-zero",
        passed: second.usage.networkCalls === 0,
        detail: String(second.usage.networkCalls),
      },
      {
        id: "pre-game-market-only",
        passed: first.document.rows.every(
          (r) => r.collectionPhase === "PRE_GAME_MARKET",
        ),
        detail: "PRE_GAME_MARKET",
      },
      {
        id: "no-closing-odds",
        passed: first.document.meta.legal.closingOddsCollected === false,
        detail: "false",
      },
      {
        id: "movement-values-valid",
        passed: first.document.rows.every((r) =>
          ["UP", "DOWN", "UNCHANGED", "NOT_COLLECTED"].includes(r.movement),
        ),
        detail: "UP/DOWN/UNCHANGED/NOT_COLLECTED",
      },
      {
        id: "regression-hashes-unchanged",
        passed: regressionUnchanged,
        detail:
          "prediction/starter/bullpen/lineup/weather/travel",
      },
      {
        id: "engine-prohibited",
        passed: first.document.meta.engineAdmission === "PROHIBITED",
        detail: "PROHIBITED",
      },
    ],
    legal: first.document.meta.legal,
    notes: first.document.meta.notes,
  };

  await mkdir(path.dirname(outAudit), { recursive: true });
  await writeFile(outAudit, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  const failed = audit.checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    throw new Error(
      `audit checks failed: ${failed.map((f) => f.id).join(", ")}`,
    );
  }

  console.log(
    `games=${first.document.summary.totalGames} opening=${first.document.summary.openingCollected} latest=${first.document.summary.latestCollected} marketProb=${first.document.summary.marketProbabilityCollected}`,
  );
  console.log(`movement=${JSON.stringify(first.document.summary.movement)}`);
  console.log(
    `rawHit/miss=${first.document.cacheUsage.rawHit}/${first.document.cacheUsage.rawMiss} warmNet=${second.usage.networkCalls}`,
  );
  console.log(`resultHash=${first.document.meta.resultHashSha256}`);
  console.log(`저장: ${outDataset}`);
  console.log(`감사: ${outAudit}`);
  console.log("ODDS_HISTORY_DATASET_V1_CREATED_DATA_COLLECTION");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
