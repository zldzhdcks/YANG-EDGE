/**
 * Build MLB Lineup Dataset v1 for a KST date.
 *
 * - Post-game actual starting lineups from boxscore research cache
 * - No pre-game backfill, no battingSide/people calls, Engine PROHIBITED
 *
 *   npx tsx --env-file=.env.local scripts/build-mlb-lineup-dataset-v1.ts [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertLineupDatasetIntegrity,
  buildLineupDatasetV1,
} from "../src/lib/mlb/build-lineup-dataset";

const DATE =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  "2026-07-27";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

type SlateReadiness = {
  totalPredictions: number;
  gradedCount: number;
  pendingCount: number;
};

function assessSlateReadiness(predRaw: string): SlateReadiness {
  const pred = JSON.parse(predRaw) as { predictions?: unknown[] };
  const predictions = Array.isArray(pred.predictions) ? pred.predictions : [];
  let gradedCount = 0;
  for (const raw of predictions) {
    const p = asRecord(raw);
    if (!p) continue;
    if (asString(p.resultStatus) === "graded") gradedCount += 1;
  }
  return {
    totalPredictions: predictions.length,
    gradedCount,
    pendingCount: predictions.length - gradedCount,
  };
}

async function main() {
  console.log(`=== Build MLB Lineup Dataset v1 (${DATE}) ===`);

  const predPath = path.join(
    process.cwd(),
    "data/predictions/mlb",
    `${DATE}.json`,
  );
  const predRawBefore = await readFile(predPath, "utf8");
  const predHashBefore = sha256(predRawBefore);

  const slate = assessSlateReadiness(predRawBefore);
  console.log(
    `slate: total=${slate.totalPredictions} graded=${slate.gradedCount} pending=${slate.pendingCount}`,
  );

  if (slate.gradedCount === 0) {
    console.log("AWAITING_FINISHED_GAMES");
    console.log(
      "No graded/final games on slate — lineup artifact not created.",
    );
    return;
  }

  if (slate.pendingCount > 0) {
    console.error(
      `AWAITING_FULL_SLATE: ${slate.pendingCount} game(s) still pending (${slate.gradedCount}/${slate.totalPredictions} graded).`,
    );
    console.error(
      "Partial lineup artifacts are not created — wait for entire slate to finish.",
    );
    process.exitCode = 2;
    return;
  }

  const first = await buildLineupDatasetV1({
    dateKst: DATE,
    predictionRaw: predRawBefore,
  });
  const integrity = assertLineupDatasetIntegrity(first.document);
  if (integrity.length > 0) {
    throw new Error(`integrity failed:\n- ${integrity.join("\n- ")}`);
  }

  const second = await buildLineupDatasetV1({
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
  if (second.document.summary.peopleApiCalls !== 0) {
    throw new Error("peopleApiCalls must be 0");
  }

  const outDataset = path.join(
    process.cwd(),
    "data/research/mlb",
    `${DATE}-lineup-dataset-v1.json`,
  );
  const outAudit = path.join(
    process.cwd(),
    "data/audits",
    `${DATE}-lineup-dataset-v1-audit.json`,
  );

  // Persist first run document (hashes exclude generatedAt via hashable body)
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
      predictionHashSha256: predHashBefore,
      predictionUnchanged: predHashAfter === predHashBefore,
      inputHashSha256: first.document.meta.inputHashSha256,
      resultHashSha256: first.document.meta.resultHashSha256,
      firstResultHash: first.document.meta.resultHashSha256,
      secondResultHash: second.document.meta.resultHashSha256,
      hashMatched,
    },
    totals: {
      ...first.document.summary,
    },
    cache: {
      firstRun: first.document.cacheUsage,
      secondRunWarm: second.document.cacheUsage,
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
        id: "pregame-not-backfilled",
        passed: first.document.summary.preGameStatus === "NOT_COLLECTED",
        detail: "NOT_COLLECTED",
      },
      {
        id: "batting-side-not-collected",
        passed: first.document.summary.battingSideCollected === 0,
        detail: "0",
      },
      {
        id: "people-api-calls-zero",
        passed: first.document.summary.peopleApiCalls === 0,
        detail: "0",
      },
      {
        id: "complete-lineups-nine-starters",
        passed: first.document.rows
          .filter((r) => r.lineupStatus === "COMPLETE")
          .every((r) => r.battingOrder.length === 9),
        detail: `complete=${first.document.summary.completeLineups}`,
      },
      {
        id: "substitute-not-in-starters",
        passed: first.document.summary.startersMarkedSubstitute === 0,
        detail: String(first.document.summary.startersMarkedSubstitute),
      },
      {
        id: "slot-dup-missing-zero-when-complete",
        passed:
          first.document.summary.incompleteLineups === 0
            ? first.document.summary.battingSlotDuplicates === 0 &&
              first.document.summary.battingSlotMissing === 0
            : true,
        detail: `dup=${first.document.summary.battingSlotDuplicates} miss=${first.document.summary.battingSlotMissing}`,
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
    `games=${first.document.summary.totalGames} teams=${first.document.summary.teamLineups} complete=${first.document.summary.completeLineups}`,
  );
  console.log(
    `rawHit/miss=${first.document.cacheUsage.rawHit}/${first.document.cacheUsage.rawMiss} warmNet=${second.usage.networkCalls}`,
  );
  console.log(`resultHash=${first.document.meta.resultHashSha256}`);
  console.log(`저장: ${outDataset}`);
  console.log(`감사: ${outAudit}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
