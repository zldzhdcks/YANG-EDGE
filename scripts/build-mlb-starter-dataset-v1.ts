/**
 * MLB Starter Dataset v1 builder (date arg).
 *
 * Prefer accumulation orchestrator for daily runs:
 *   npx tsx --env-file=.env.local scripts/run-mlb-starter-accumulation-v1.ts [YYYY-MM-DD]
 *
 * This script:
 * - aborts if prediction snapshot missing
 * - does not overwrite existing pre-game artifact (immutable)
 * - builds pre-game only (postGameReview left to accumulation/postgame step)
 */
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertStarterDatasetIntegrity,
  buildStarterDatasetV1,
} from "../src/lib/mlb/build-starter-dataset";

const DATE =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  "2026-07-27";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`=== Build MLB Starter Dataset v1 (${DATE}) ===`);
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

  const outDataset = path.join(
    process.cwd(),
    "data/research/mlb",
    `${DATE}-starter-dataset-v1.json`,
  );

  if (await exists(outDataset)) {
    const raw = await readFile(outDataset, "utf8");
    const doc = JSON.parse(raw) as {
      meta?: { resultHashSha256?: string };
    };
    console.log(
      `IMMUTABLE: pre-game exists — skip overwrite. resultHash=${doc.meta?.resultHashSha256 ?? "?"}`,
    );
    console.log(
      `Use: npx tsx --env-file=.env.local scripts/run-mlb-starter-accumulation-v1.ts ${DATE}`,
    );
    return;
  }

  const predRawBefore = await readFile(predPath, "utf8");
  const predHashBefore = sha256(predRawBefore);

  const { document, predictionHash } = await buildStarterDatasetV1({
    dateKst: DATE,
    predictionRaw: predRawBefore,
    includePostGameReview: false,
  });

  const integrity = assertStarterDatasetIntegrity(document);
  if (integrity.length > 0) {
    throw new Error(`integrity failed:\n- ${integrity.join("\n- ")}`);
  }

  await mkdir(path.dirname(outDataset), { recursive: true });
  await writeFile(outDataset, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  if (sha256(await readFile(predPath, "utf8")) !== predHashBefore) {
    throw new Error("prediction snapshot mutated");
  }
  if (predictionHash !== predHashBefore) {
    throw new Error("prediction hash mismatch");
  }

  console.log(
    `games=${document.summary.totalGames} rows=${document.summary.totalRows}`,
  );
  console.log(`resultHash=${document.meta.resultHashSha256}`);
  console.log(`저장: ${outDataset}`);
  console.log(
    `Next: npx tsx --env-file=.env.local scripts/run-mlb-starter-accumulation-v1.ts ${DATE}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
