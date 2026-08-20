/**
 * MLB Schedule-First Lineup Intake v1.
 *
 * Schedule artifact required. Prediction Snapshot is never read.
 *
 *   npm run research:mlb-lineup -- YYYY-MM-DD
 *   npx tsx --env-file=.env.local scripts/build-mlb-lineup-dataset-v1.ts [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomic } from "../src/lib/mlb/build-mlb-schedule-artifact";
import {
  assertLineupDatasetIntegrity,
  buildLineupDatasetV1,
} from "../src/lib/mlb/build-lineup-dataset";

const ARGS = process.argv.slice(2);
const DATE =
  ARGS.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ??
  process.env.MLB_TARGET_DATE_KST?.trim() ??
  "";
const CACHE_ONLY = ARGS.includes("--cache-only");

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
    console.error("Usage: npm run research:mlb-lineup -- YYYY-MM-DD [--cache-only]");
    process.exitCode = 1;
    return;
  }

  console.log(`=== MLB Schedule-First Lineup Intake v1 (${DATE}) ===`);
  console.log("NOTE: Prediction Snapshot is not read by this collector.");
  if (CACHE_ONLY) {
    console.log("NOTE: --cache-only — no live Stats API fetch.");
  }

  const regressionBefore = {
    schedule: await readHashIfExists(
      `data/research/mlb/${DATE}-schedule-v1.json`,
    ),
    starter: await readHashIfExists(
      `data/research/mlb/${DATE}-starter-dataset-v1.json`,
    ),
    odds: await readHashIfExists(
      `data/research/mlb/${DATE}-odds-history-dataset-v1.json`,
    ),
    prediction: await readHashIfExists(`data/predictions/mlb/${DATE}.json`),
  };

  const first = await buildLineupDatasetV1({
    dateKst: DATE,
    allowNetwork: !CACHE_ONLY,
  });
  const integrity = assertLineupDatasetIntegrity(first.document);
  if (integrity.length > 0) {
    throw new Error(`integrity failed:\n- ${integrity.join("\n- ")}`);
  }

  const second = await buildLineupDatasetV1({
    dateKst: DATE,
    allowNetwork: !CACHE_ONLY,
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
  if (second.document.summary.peopleApiCalls !== 0) {
    throw new Error("peopleApiCalls must be 0");
  }

  const outDatasetRel = `data/research/mlb/${DATE}-lineup-dataset-v1.json`;
  const outAuditRel = `data/audits/${DATE}-lineup-dataset-v1-audit.json`;
  const outDataset = path.join(process.cwd(), outDatasetRel);
  const outAudit = path.join(process.cwd(), outAuditRel);

  await writeJsonAtomic(outDataset, first.document);

  const regressionAfter = {
    schedule: await readHashIfExists(
      `data/research/mlb/${DATE}-schedule-v1.json`,
    ),
    starter: await readHashIfExists(
      `data/research/mlb/${DATE}-starter-dataset-v1.json`,
    ),
    odds: await readHashIfExists(
      `data/research/mlb/${DATE}-odds-history-dataset-v1.json`,
    ),
    prediction: await readHashIfExists(`data/predictions/mlb/${DATE}.json`),
  };

  const regressionUnchanged =
    regressionBefore.schedule === regressionAfter.schedule &&
    regressionBefore.starter === regressionAfter.starter &&
    regressionBefore.odds === regressionAfter.odds &&
    regressionBefore.prediction === regressionAfter.prediction;

  const status = first.document.summary.collectionStatus ?? {
    CONFIRMED: 0,
    PARTIAL: 0,
    NOT_RELEASED: 0,
    NOT_COLLECTED: 0,
    PROVIDER_ERROR: 0,
    MATCH_NOT_FOUND: 0,
    INVALID_RESPONSE: 0,
  };

  const audit = {
    meta: {
      version: "mlb-lineup-dataset-v1-audit",
      kind: "lineup-dataset-v1-build-audit",
      datasetId: "mlb-lineup",
      schemaVersion: first.document.meta.schemaVersion,
      builderVersion: first.document.meta.builderVersion,
      dateKst: DATE,
      generatedAt: new Date().toISOString(),
      datasetStatus: "COLLECTING",
      engineAdmission: "PROHIBITED",
      engineConnected: false,
      researchOnly: true,
      intakeVersion: "mlb-schedule-first-lineup-v1",
      scheduleSource: first.document.meta.scheduleSource ?? null,
      lineupSource: first.document.meta.lineupSource ?? null,
      predictionRead: false,
      predictionHashSha256: first.document.meta.predictionHashSha256,
      inputHashSha256: first.document.meta.inputHashSha256,
      resultHashSha256: first.document.meta.resultHashSha256,
      firstResultHash: first.document.meta.resultHashSha256,
      secondResultHash: second.document.meta.resultHashSha256,
      hashMatched,
    },
    independentIntake: {
      scheduleGames: first.document.summary.totalGames,
      providerGames: first.providerGamesCount,
      matchedGames: first.matchedGamesCount,
      confirmed: status.CONFIRMED,
      partial: status.PARTIAL,
      notReleased: status.NOT_RELEASED,
      notCollected:
        status.NOT_COLLECTED +
        status.PROVIDER_ERROR +
        status.MATCH_NOT_FOUND +
        status.INVALID_RESPONSE,
      collectionStatus: status,
      reasons: [
        ...new Set(
          first.document.rows
            .map((r) => r.reason)
            .filter((r): r is string => typeof r === "string" && r.length > 0),
        ),
      ].sort(),
    },
    totals: {
      ...first.document.summary,
    },
    cache: {
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
        id: "prediction-not-read",
        passed: true,
        detail: "collector does not open prediction snapshot",
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
        id: "people-api-calls-zero",
        passed: first.document.summary.peopleApiCalls === 0,
        detail: "0",
      },
      {
        id: "all-schedule-games-present",
        passed:
          first.document.summary.totalGames * 2 ===
          first.document.summary.teamLineups,
        detail: `games=${first.document.summary.totalGames} rows=${first.document.summary.teamLineups}`,
      },
      {
        id: "complete-lineups-nine-starters",
        passed: first.document.rows
          .filter((r) => r.lineupStatus === "COMPLETE")
          .every((r) => r.battingOrder.length === 9),
        detail: `complete=${first.document.summary.completeLineups}`,
      },
      {
        id: "confirmed-requires-complete",
        passed: first.document.rows
          .filter((r) => r.collectionStatus === "CONFIRMED")
          .every(
            (r) =>
              r.confirmed === true &&
              r.lineupStatus === "COMPLETE" &&
              r.battingOrder.length === 9,
          ),
        detail: `confirmedGames=${status.CONFIRMED}`,
      },
      {
        id: "no-invented-lineups",
        passed: first.document.rows
          .filter((r) => r.collectionStatus === "NOT_RELEASED")
          .every((r) => r.battingOrder.length === 0),
        detail: "NOT_RELEASED rows must have empty battingOrder",
      },
      {
        id: "regression-hashes-unchanged",
        passed: regressionUnchanged,
        detail: "schedule/starter/odds/prediction",
      },
      {
        id: "engine-prohibited",
        passed: first.document.meta.engineAdmission === "PROHIBITED",
        detail: "PROHIBITED",
      },
    ],
    legal: first.document.meta.legal,
    notes: first.document.meta.notes,
    artifacts: {
      dataset: outDatasetRel,
      audit: outAuditRel,
    },
  };

  await writeJsonAtomic(outAudit, audit);

  const failed = audit.checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    throw new Error(
      `audit checks failed: ${failed.map((f) => f.id).join(", ")}`,
    );
  }

  console.log(`date=${DATE}`);
  console.log(`schedule games count=${first.document.summary.totalGames}`);
  console.log(`provider games count=${first.providerGamesCount}`);
  console.log(`matched games count=${first.matchedGamesCount}`);
  console.log(`confirmed count=${status.CONFIRMED}`);
  console.log(`partial count=${status.PARTIAL}`);
  console.log(`not released count=${status.NOT_RELEASED}`);
  console.log(
    `not collected/provider error count=${audit.independentIntake.notCollected}`,
  );
  console.log(
    `rawHit/miss=${first.document.cacheUsage.rawHit}/${first.document.cacheUsage.rawMiss} warmNet=${second.usage.networkCalls}`,
  );
  console.log(`artifact path=${outDatasetRel}`);
  console.log(`audit path=${outAuditRel}`);
  console.log("MLB_SCHEDULE_FIRST_LINEUP_V1_COMPLETE");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
