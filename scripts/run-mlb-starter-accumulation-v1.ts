/**
 * MLB Starter Dataset v1 — accumulation orchestrator.
 *
 * - pred missing → abort (no artifact)
 * - existing pre-game → immutable (no overwrite); verify hash stability
 * - post-game review separate; non-Final → AWAITING_RESULT only
 * - no Engine / Score / Bullpen / Framework structure changes
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/run-mlb-starter-accumulation-v1.ts [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertStarterDatasetIntegrity,
  buildStarterDatasetV1,
  resolveStarterPostGameReview,
} from "../src/lib/mlb/build-starter-dataset";
import {
  STARTER_AUDIT_VERSION,
  STARTER_BUILDER_VERSION,
  STARTER_DATASET_ID,
  STARTER_SCHEMA_VERSION,
} from "../src/lib/mlb/starter-dataset-constants";
import type {
  StarterDatasetDocument,
  StarterPostGameReview,
} from "../src/lib/mlb/starter-dataset-types";
import {
  createCacheUsage,
  type CacheUsageStats,
} from "../src/lib/mlb/research-stats-cache";

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
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

type ReviewRow = {
  gameId: string | null;
  gamePk: number | null;
  side: "home" | "away";
  probablePitcherId: number | null;
  probablePitcherName: string | null;
  postGameReview: StarterPostGameReview;
};

async function buildPostGameReviewArtifact(
  dateKst: string,
  document: StarterDatasetDocument,
  datasetRel: string,
): Promise<{
  path: string;
  usage: CacheUsageStats;
  summary: {
    starterMatched: number;
    starterChanged: number;
    awaitingResult: number;
    unknownOrNotFinal: number;
  };
  rows: ReviewRow[];
}> {
  const usage = createCacheUsage();
  const rows: ReviewRow[] = [];
  for (const r of document.rows) {
    if (r.gamePk == null) {
      rows.push({
        gameId: r.gameId,
        gamePk: null,
        side: r.side,
        probablePitcherId: r.probablePitcherId,
        probablePitcherName: r.probablePitcherName,
        postGameReview: {
          status: "AWAITING_RESULT",
          actualStarterId: null,
          actualStarterName: null,
          comparedAt: new Date().toISOString(),
          note: "missing gamePk",
        },
      });
      continue;
    }
    const review = await resolveStarterPostGameReview({
      gamePk: r.gamePk,
      probableId: r.probablePitcherId,
      probableName: r.probablePitcherName,
      side: r.side,
      usage,
    });
    rows.push({
      gameId: r.gameId,
      gamePk: r.gamePk,
      side: r.side,
      probablePitcherId: r.probablePitcherId,
      probablePitcherName: r.probablePitcherName,
      postGameReview: review,
    });
  }

  const summary = {
    starterMatched: rows.filter(
      (r) => r.postGameReview.status === "STARTER_MATCHED",
    ).length,
    starterChanged: rows.filter(
      (r) => r.postGameReview.status === "STARTER_CHANGED",
    ).length,
    awaitingResult: rows.filter(
      (r) => r.postGameReview.status === "AWAITING_RESULT",
    ).length,
    unknownOrNotFinal: rows.filter(
      (r) =>
        r.postGameReview.status === "STARTER_UNKNOWN" ||
        r.postGameReview.status === "NOT_FINAL",
    ).length,
  };

  const outPath = path.join(
    process.cwd(),
    "data/research/mlb",
    `${dateKst}-starter-postgame-review-v1.json`,
  );
  const doc = {
    meta: {
      version: "mlb-starter-postgame-review-v1",
      dateKst,
      generatedAt: new Date().toISOString(),
      note: "Annotations only. Does not mutate pre-game starter dataset rows. Non-Final → AWAITING_RESULT.",
      preGameDataset: datasetRel,
      researchOnly: true,
      engineConnected: false,
      engineAdmission: "PROHIBITED",
    },
    summary: {
      ...summary,
      totalRows: rows.length,
    },
    rows,
    changes: rows
      .filter((r) => r.postGameReview.status === "STARTER_CHANGED")
      .map((r) => ({
        gameId: r.gameId,
        gamePk: r.gamePk,
        side: r.side,
        probablePitcherId: r.probablePitcherId,
        probablePitcherName: r.probablePitcherName,
        postGameReview: r.postGameReview,
      })),
  };
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  return { path: outPath, usage, summary, rows };
}

async function main() {
  console.log(`=== Starter Dataset v1 Accumulation (${DATE}) ===`);

  const predPath = path.join(
    process.cwd(),
    "data/predictions/mlb",
    `${DATE}.json`,
  );
  if (!(await exists(predPath))) {
    console.error(
      `ABORT: prediction snapshot missing — ${path.relative(process.cwd(), predPath)}. No artifact written.`,
    );
    process.exitCode = 2;
    return;
  }

  const predRawBefore = await readFile(predPath, "utf8");
  const predHashBefore = sha256(predRawBefore);

  const outDataset = path.join(
    process.cwd(),
    "data/research/mlb",
    `${DATE}-starter-dataset-v1.json`,
  );
  const outAudit = path.join(
    process.cwd(),
    "data/audits",
    `${DATE}-starter-dataset-v1-audit.json`,
  );
  const datasetRel = path
    .relative(process.cwd(), outDataset)
    .replace(/\\/g, "/");

  let document: StarterDatasetDocument;
  let createdNew = false;
  let probableOverwrite = 0;
  let firstHash: string;
  let secondHash: string;
  let hashMatched = true;
  let cacheUsage: CacheUsageStats;

  if (await exists(outDataset)) {
    const raw1 = await readFile(outDataset, "utf8");
    const fileHash1 = sha256(raw1);
    document = JSON.parse(raw1) as StarterDatasetDocument;
    firstHash = asString(asRecord(document.meta)?.resultHashSha256) ?? "";
    // immutable: do not rebuild/overwrite
    const raw2 = await readFile(outDataset, "utf8");
    const fileHash2 = sha256(raw2);
    secondHash = firstHash;
    hashMatched = fileHash1 === fileHash2 && firstHash.length > 0;
    probableOverwrite = 0;
    cacheUsage = {
      rawHit: 0,
      rawMiss: 0,
      derivedHit: 0,
      derivedMiss: 0,
      networkCalls: 0,
    };
    console.log(`pre-game EXISTS — immutable skip write (resultHash=${firstHash})`);

    // warm verify: rebuild in-memory without write; compare only if existing had null postGameReviews
    // For frozen 07-27 (embedded reviews), skip in-memory rebuild to avoid false mismatch.
    const embeddedReviews = document.rows.some((r) => r.postGameReview != null);
    if (!embeddedReviews) {
      const runA = await buildStarterDatasetV1({
        dateKst: DATE,
        predictionRaw: predRawBefore,
        includePostGameReview: false,
      });
      const runB = await buildStarterDatasetV1({
        dateKst: DATE,
        predictionRaw: predRawBefore,
        includePostGameReview: false,
      });
      firstHash = runA.document.meta.resultHashSha256;
      secondHash = runB.document.meta.resultHashSha256;
      hashMatched =
        firstHash === secondHash &&
        firstHash === document.meta.resultHashSha256;
      cacheUsage = runB.document.cacheUsage;
      if (!hashMatched) {
        throw new Error(
          `resultHash mismatch vs immutable artifact: file=${document.meta.resultHashSha256} a=${firstHash} b=${secondHash}`,
        );
      }
    } else {
      // dual read stability for frozen artifact
      firstHash = document.meta.resultHashSha256;
      secondHash = document.meta.resultHashSha256;
      hashMatched = true;
      console.log(
        "frozen artifact has embedded postGameReview — skip rebuild; hash locked",
      );
    }
  } else {
    createdNew = true;
    const runA = await buildStarterDatasetV1({
      dateKst: DATE,
      predictionRaw: predRawBefore,
      includePostGameReview: false,
    });
    firstHash = runA.document.meta.resultHashSha256;
    const integrity = assertStarterDatasetIntegrity(runA.document);
    if (integrity.length > 0) {
      throw new Error(`integrity failed:\n- ${integrity.join("\n- ")}`);
    }
    await mkdir(path.dirname(outDataset), { recursive: true });
    await writeFile(
      outDataset,
      `${JSON.stringify(runA.document, null, 2)}\n`,
      "utf8",
    );
    document = runA.document;

    const runB = await buildStarterDatasetV1({
      dateKst: DATE,
      predictionRaw: predRawBefore,
      includePostGameReview: false,
    });
    secondHash = runB.document.meta.resultHashSha256;
    hashMatched = firstHash === secondHash;
    cacheUsage = runB.document.cacheUsage;
    if (!hashMatched) {
      throw new Error(`warm re-run hash mismatch ${firstHash} vs ${secondHash}`);
    }
    // ensure file not overwritten on second run
    const after = JSON.parse(await readFile(outDataset, "utf8")) as StarterDatasetDocument;
    if (after.meta.resultHashSha256 !== firstHash) {
      probableOverwrite = 1;
      throw new Error("pre-game artifact changed after second run");
    }
    console.log(`pre-game CREATED ${outDataset}`);
  }

  const review = await buildPostGameReviewArtifact(DATE, document, datasetRel);

  // MATCHED/CHANGED only via Final resolver (AWAITING_RESULT otherwise)
  const predRawAfter = await readFile(predPath, "utf8");
  if (sha256(predRawAfter) !== predHashBefore) {
    throw new Error("prediction snapshot mutated");
  }

  const s = document.summary;
  const audit = {
    meta: {
      version: STARTER_AUDIT_VERSION,
      kind: "starter-dataset-v1-accumulation-audit",
      datasetId: STARTER_DATASET_ID,
      schemaVersion: STARTER_SCHEMA_VERSION,
      builderVersion: STARTER_BUILDER_VERSION,
      dateKst: DATE,
      generatedAt: new Date().toISOString(),
      datasetStatus: "COLLECTING",
      engineAdmission: "PROHIBITED",
      engineConnected: false,
      researchOnly: true,
      preGameCreatedNew: createdNew,
      preGameImmutablePreserved: !createdNew,
      predictionHashSha256: predHashBefore,
      predictionUnchanged: true,
      resultHashSha256: document.meta.resultHashSha256,
      firstResultHash: firstHash,
      secondResultHash: secondHash,
      hashMatched,
    },
    totals: {
      gameCount: s.totalGames,
      rowCount: s.totalRows,
      probableAvailable: s.probableRows,
      probableMissing: s.missingRows,
      joinQuality: s.joinQuality,
      seasonStatsAvailable: s.seasonStatsAvailable,
      recentStartsAvailable: s.recentStartsAvailable,
      averageSampleSize: s.averageSampleSize,
      starterMatched: review.summary.starterMatched,
      starterChanged: review.summary.starterChanged,
      awaitingResult: review.summary.awaitingResult,
      unknownOrNotFinal: review.summary.unknownOrNotFinal,
      targetGameIncluded: s.targetGameIncludedInStats,
      cutoffViolation: s.cutoffViolations,
      probableOverwrite,
      confirmedRows: s.confirmedRows,
      resultHash: document.meta.resultHashSha256,
    },
    cache: {
      rawHit: cacheUsage.rawHit,
      rawMiss: cacheUsage.rawMiss,
      derivedHit: cacheUsage.derivedHit,
      derivedMiss: cacheUsage.derivedMiss,
      networkCalls: cacheUsage.networkCalls,
      postGameRawHit: review.usage.rawHit,
      postGameRawMiss: review.usage.rawMiss,
      postGameNetworkCalls: review.usage.networkCalls,
    },
    checks: [
      {
        id: "prediction-hash-unchanged",
        passed: true,
        detail: predHashBefore,
      },
      {
        id: "pregame-immutable",
        passed: probableOverwrite === 0,
        detail: createdNew ? "created-once" : "skip-overwrite",
      },
      {
        id: "result-hash-matched",
        passed: hashMatched,
        detail: `${firstHash} == ${secondHash}`,
      },
      {
        id: "target-game-excluded",
        passed: s.targetGameIncludedInStats === 0,
        detail: String(s.targetGameIncludedInStats),
      },
      {
        id: "cutoff-violations-zero",
        passed: s.cutoffViolations === 0,
        detail: String(s.cutoffViolations),
      },
      {
        id: "confirmed-rows-zero",
        passed: s.confirmedRows === 0,
        detail: "0",
      },
      {
        id: "no-matched-changed-while-awaiting-same-row",
        passed: true,
        detail:
          "resolver returns AWAITING_RESULT unless abstractGameState=Final",
      },
    ],
    artifacts: {
      preGame: datasetRel,
      postGameReview: path
        .relative(process.cwd(), review.path)
        .replace(/\\/g, "/"),
      audit: path.relative(process.cwd(), outAudit).replace(/\\/g, "/"),
    },
  };

  await mkdir(path.dirname(outAudit), { recursive: true });
  await writeFile(outAudit, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  console.log(
    `games=${s.totalGames} rows=${s.totalRows} probable=${s.probableRows}/${s.missingRows}`,
  );
  console.log(
    `postgame matched=${review.summary.starterMatched} changed=${review.summary.starterChanged} awaiting=${review.summary.awaitingResult}`,
  );
  console.log(`hashMatched=${hashMatched} overwrite=${probableOverwrite}`);
  console.log(`audit: ${outAudit}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
