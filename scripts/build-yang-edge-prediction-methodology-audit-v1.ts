/**
 * Build YANG EDGE Prediction Methodology Audit v1 JSON.
 * Read-only: does not mutate prediction snapshots, engine weights, or providers.
 *
 *   npx tsx scripts/build-yang-edge-prediction-methodology-audit-v1.ts
 */
import { execSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildAuditDocument,
  classifyHistoricalPredictions,
} from "../src/lib/research/prediction-methodology-audit-v1";

const REL = "data/audits/yang-edge-prediction-methodology-audit-v1.json";

function gitCapture(root: string) {
  const run = (cmd: string) =>
    execSync(cmd, { cwd: root, encoding: "utf8" }).trim();
  const branch = run("git rev-parse --abbrev-ref HEAD");
  const head = run("git rev-parse HEAD");
  let originMain = head;
  try {
    originMain = run("git rev-parse origin/main");
  } catch {
    originMain = "UNKNOWN";
  }
  let ahead = 0;
  let behind = 0;
  try {
    const counts = run("git rev-list --left-right --count origin/main...HEAD");
    const [b, a] = counts.split(/\s+/).map((n) => Number(n));
    behind = Number.isFinite(b) ? b : 0;
    ahead = Number.isFinite(a) ? a : 0;
  } catch {
    ahead = 0;
    behind = 0;
  }
  const porcelain = run("git status --porcelain")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return { branch, head, originMain, ahead, behind, statusPorcelain: porcelain };
}

async function main() {
  const root = process.cwd();
  const dryRun = process.argv.includes("--dry-run");
  const generatedAt =
    process.argv.find((a, i, arr) => arr[i - 1] === "--generated-at") ??
    "2026-08-20T12:00:00.000Z";

  const historical = await classifyHistoricalPredictions(root);
  const liveGit = gitCapture(root);
  const document = buildAuditDocument({
    generatedAt,
    gitBefore: {
      branch: "main",
      head: "877fdc0e419da3dc1a60385608ce97133cec9daa",
      originMain: "877fdc0e419da3dc1a60385608ce97133cec9daa",
      ahead: 0,
      behind: 0,
      statusPorcelain: ['?? "리포트/"'],
    },
    historical,
  });
  process.stdout.write(`liveGit ${JSON.stringify(liveGit)}\n`);

  if (dryRun) {
    process.stdout.write(
      JSON.stringify(
        {
          dryRun: true,
          wrote: false,
          independentModelSample: document.independentModelSample,
          classificationCounts: document.classificationCounts,
          historicalRows: document.historical.length,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  const abs = path.join(root, REL);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  process.stdout.write(`Wrote ${REL}\n`);
  process.stdout.write(
    `historical=${document.historical.length} independentSample=${document.independentModelSample}\n`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
