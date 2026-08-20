/**
 * Build player-condition feature audit JSON. Read-only.
 *
 *   npx tsx scripts/build-yang-edge-player-condition-feature-audit-v1.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildPlayerConditionAuditDocument } from "../src/lib/research/player-condition-framework-v1";

const REL = "data/audits/yang-edge-player-condition-feature-audit-v1.json";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const document = buildPlayerConditionAuditDocument({
    generatedAt: "2026-08-20T12:30:00.000Z",
    previousMethodologyAuditCommit:
      "48c9ac86543cdfc1a069bccee931e8ac06a66820",
    gitBefore: {
      branch: "main",
      head: "48c9ac86543cdfc1a069bccee931e8ac06a66820",
      originMain: "877fdc0e419da3dc1a60385608ce97133cec9daa",
      ahead: 1,
      behind: 0,
      statusPorcelain: ['?? "리포트/"'],
    },
  });

  if (dryRun) {
    process.stdout.write(
      JSON.stringify(
        {
          dryRun: true,
          rows: document.rows.length,
          stageCounts: document.stageCounts,
          marketInPlayerStrength: document.marketInPlayerStrength,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  const abs = path.join(process.cwd(), REL);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Wrote ${REL} rows=${document.rows.length} independentSample=${document.independentModelSample}\n`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
