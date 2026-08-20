/**
 * Build provider capability audit JSON. Read-only. No paid API calls.
 *
 *   npx tsx scripts/build-yang-edge-provider-capability-audit-v1.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildProviderCapabilityAuditDocument } from "../src/lib/research/provider-capability-audit-v1";

const REL = "data/audits/yang-edge-provider-capability-audit-v1.json";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const document = buildProviderCapabilityAuditDocument({
    generatedAt: "2026-08-20T13:20:00.000Z",
    gitBefore: {
      branch: "main",
      head: "639694c4fddbcb8e352a792c9f736959a13dbe09",
      originMain: "639694c4fddbcb8e352a792c9f736959a13dbe09",
      ahead: 0,
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
          availabilityCounts: document.availabilityCounts,
          buildVsBuyCounts: document.buildVsBuyCounts,
          independentModelSample: document.independentModelSample,
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
    `Wrote ${REL} rows=${document.rows.length} independentSample=${document.independentModelSample} paidCalls=${document.mutation.paidProviderCalls}\n`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
