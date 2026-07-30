/**
 * MLB Independent Odds Intake v1 — Schedule artifact + authorized Odds Provider.
 *
 * Prediction Snapshot is optional and never required.
 * No closing / post-game odds. Engine PROHIBITED.
 *
 *   npm run research:mlb-odds -- YYYY-MM-DD
 *   npx tsx --env-file=.env.local scripts/build-mlb-odds-history-dataset-v1.ts [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomic } from "../src/lib/mlb/build-mlb-schedule-artifact";
import {
  assertOddsHistoryDatasetIntegrity,
  buildOddsHistoryDatasetV1,
} from "../src/lib/mlb/build-odds-history-dataset";
import {
  EMPTY_PREDICTION_HASH,
  readOptionalPredictionSnapshot,
} from "../src/lib/mlb/load-mlb-schedule-targets";

const DATE =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  "";

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE)) {
    console.error("Usage: npm run research:mlb-odds -- YYYY-MM-DD");
    process.exitCode = 1;
    return;
  }

  console.log(`=== MLB Independent Odds Intake v1 (${DATE}) ===`);

  const optionalPrediction = await readOptionalPredictionSnapshot(DATE);
  const predictionRaw = optionalPrediction?.raw ?? null;
  const predHashBefore = optionalPrediction?.hash ?? EMPTY_PREDICTION_HASH;

  if (!optionalPrediction) {
    console.log(
      "NOTE: prediction snapshot absent — schedule+provider intake continues.",
    );
  } else {
    console.log(
      "NOTE: prediction snapshot present — used as supplemental metadata only.",
    );
  }

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
    predictionRaw,
  });
  const integrity = assertOddsHistoryDatasetIntegrity(first.document);
  if (integrity.length > 0) {
    throw new Error(`integrity failed:\n- ${integrity.join("\n- ")}`);
  }

  const second = await buildOddsHistoryDatasetV1({
    dateKst: DATE,
    predictionRaw,
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

  const outDatasetRel = `data/research/mlb/${DATE}-odds-history-dataset-v1.json`;
  const outAuditRel = `data/audits/${DATE}-odds-history-dataset-v1-audit.json`;
  const outDataset = path.join(process.cwd(), outDatasetRel);
  const outAudit = path.join(process.cwd(), outAuditRel);

  await writeJsonAtomic(outDataset, first.document);

  let predHashAfter = predHashBefore;
  if (optionalPrediction) {
    const predPath = path.join(
      process.cwd(),
      "data/predictions/mlb",
      `${DATE}.json`,
    );
    predHashAfter = sha256(await readFile(predPath, "utf8"));
    if (predHashAfter !== predHashBefore) {
      throw new Error("prediction snapshot mutated");
    }
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

  const status = first.document.summary.collectionStatus ?? {
    COLLECTED: 0,
    PARTIAL: 0,
    NOT_COLLECTED: 0,
    PROVIDER_ERROR: 0,
    MATCH_NOT_FOUND: 0,
    INVALID_RESPONSE: 0,
  };

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
      predictionOptional: optionalPrediction == null,
      intakeVersion: "mlb-independent-odds-v1",
      scheduleSource: first.document.meta.scheduleSource ?? null,
      inputHashSha256: first.document.meta.inputHashSha256,
      resultHashSha256: first.document.meta.resultHashSha256,
      firstResultHash: first.document.meta.resultHashSha256,
      secondResultHash: second.document.meta.resultHashSha256,
      hashMatched,
    },
    independentIntake: {
      provider: first.document.meta.provider ?? null,
      scheduleGames: first.document.summary.totalGames,
      providerEvents: null as number | null,
      gamesMatched: first.document.summary.joinQuality.MATCHED,
      collected: status.COLLECTED,
      partial: status.PARTIAL,
      notCollected:
        status.NOT_COLLECTED +
        status.MATCH_NOT_FOUND +
        status.PROVIDER_ERROR +
        status.INVALID_RESPONSE,
      collectionStatus: status,
      missingReasons: [
        ...new Set(
          first.document.rows
            .map((r) => r.reason)
            .filter((r): r is string => typeof r === "string" && r.length > 0),
        ),
      ].sort(),
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
        passed: optionalPrediction == null || predHashAfter === predHashBefore,
        detail:
          optionalPrediction == null ? "OPTIONAL_ABSENT" : predHashBefore,
      },
      {
        id: "schedule-source-present",
        passed: Boolean(first.document.meta.scheduleSource),
        detail: first.document.meta.scheduleSource ?? "missing",
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
        detail: "prediction/starter/bullpen/lineup/weather/travel",
      },
      {
        id: "engine-prohibited",
        passed: first.document.meta.engineAdmission === "PROHIBITED",
        detail: "PROHIBITED",
      },
      {
        id: "no-invented-odds",
        passed: first.document.rows.every(
          (r) =>
            r.collectionStatus !== "COLLECTED" ||
            (r.openingOdds != null && r.latestOdds != null),
        ),
        detail: "COLLECTED rows must have opening+latest",
      },
    ],
    legal: first.document.meta.legal,
    notes: first.document.meta.notes,
    artifacts: {
      dataset: outDatasetRel,
      audit: outAuditRel,
    },
  };

  // Fill provider event count from cache usage / row oddsEventIds
  audit.independentIntake.providerEvents = [
    ...new Set(
      first.document.rows
        .map((r) => r.oddsEventId)
        .filter((id): id is string => typeof id === "string"),
    ),
  ].length;

  await writeJsonAtomic(outAudit, audit);

  const failed = audit.checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    throw new Error(
      `audit checks failed: ${failed.map((f) => f.id).join(", ")}`,
    );
  }

  console.log(`date=${DATE}`);
  console.log(`schedule games count=${first.document.summary.totalGames}`);
  console.log(
    `provider events count=${audit.independentIntake.providerEvents}`,
  );
  console.log(`matched games count=${first.document.summary.joinQuality.MATCHED}`);
  console.log(`collected count=${status.COLLECTED}`);
  console.log(`partial count=${status.PARTIAL}`);
  console.log(
    `not collected count=${audit.independentIntake.notCollected}`,
  );
  console.log(`movement=${JSON.stringify(first.document.summary.movement)}`);
  console.log(
    `rawHit/miss=${first.document.cacheUsage.rawHit}/${first.document.cacheUsage.rawMiss} warmNet=${second.usage.networkCalls}`,
  );
  console.log(`artifact path=${outDatasetRel}`);
  console.log(`audit path=${outAuditRel}`);
  console.log("MLB_INDEPENDENT_ODDS_V1_COMPLETE");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
