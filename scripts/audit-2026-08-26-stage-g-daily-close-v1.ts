/**
 * Build 2026-08-26 Stage G Daily Close + Git Sync candidate.
 * Repository-only. Does not mutate A–F / Engine / Weights.
 *
 *   npx tsx scripts/audit-2026-08-26-stage-g-daily-close-v1.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  STAGE_G_CLOSE_REL,
  assertDailyStageGInvariants,
  buildDailyStageGDailyCloseV1,
} from "../src/lib/daily-ops/stage-g-daily-close-v1";

async function main() {
  const doc = await buildDailyStageGDailyCloseV1({
    closeAuditRunAt: new Date().toISOString(),
  });
  assertDailyStageGInvariants(doc);
  const abs = path.join(process.cwd(), STAGE_G_CLOSE_REL);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(`Wrote ${STAGE_G_CLOSE_REL}`);
  console.log(
    `G_STATUS=${doc.gStatus} leakage=${doc.leakageAudit.status} preG=${doc.credits.officialCompletionBeforeSeal} target=${doc.credits.targetCompletionAfterSeal}`,
  );
  console.log(
    `scope=${doc.scope.scopeTotal} prediction=${doc.predictionPass.predictionCount} pass=${doc.predictionPass.passCount} final=${doc.resultGrade.finalResultCount}`,
  );
  console.log(`network=${doc.providerNetworkCallCount} credit=${doc.credit}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
