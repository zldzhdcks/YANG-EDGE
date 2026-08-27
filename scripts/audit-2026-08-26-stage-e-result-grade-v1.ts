/**
 * Collect 2026-08-26 Stage E Result + Grade.
 * Does not mutate C / Snapshot / B1 / Pregame research files.
 *
 *   npx tsx --env-file=.env.local scripts/audit-2026-08-26-stage-e-result-grade-v1.ts --apply-v2-offline
 *   npx tsx --env-file=.env.local scripts/audit-2026-08-26-stage-e-result-grade-v1.ts --recheck-fixture 1630226
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  STAGE_E_CLOSE_REL,
  applyTerminalCoverageGapV2ToClose,
  assertDailyStageEInvariants,
  buildDailyStageEResultGradeV1,
  recheckExactFootballFixtureInClose,
  type DailyStageEResultGradeCloseV1,
} from "../src/lib/daily-ops/stage-e-result-grade-v1";

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

function logDoc(doc: DailyStageEResultGradeCloseV1): void {
  console.log(
    `E_STATUS=${doc.eStatus} stageResult=${doc.stageResult} lockedScope=${doc.lockedScope} accountedFor=${doc.accountedFor}`,
  );
  console.log(
    `scopeTotal=${doc.scopeTotal} operationallyClosed=${doc.operationallyClosedCount} final=${doc.finalResultCount} activePending=${doc.activePendingCount}`,
  );
  console.log(
    `terminalGaps=${doc.terminalCoverageGapCount} identityGaps=${doc.identityCoverageGapCount} unsupportedGaps=${doc.unsupportedCoverageGapCount}`,
  );
  console.log(
    `resultCoverage.finalOfScope=${doc.resultCoverage.finalOfScope} fullFinalClaim=${doc.resultCoverage.fullFinalClaim}`,
  );
  console.log(
    `predictionCount=${doc.predictionCount} passCount=${doc.passCount} gradedPredictionCount=${doc.gradedPredictionCount}`,
  );
  console.log(`providerLiveCallCount=${doc.providerLiveCallCount} credit=${doc.credit}`);
}

async function main() {
  const recheckFixtureId = argValue("--recheck-fixture");
  const applyV2 = process.argv.includes("--apply-v2-offline");
  const abs = path.join(process.cwd(), STAGE_E_CLOSE_REL);

  if (applyV2) {
    const existing = JSON.parse(
      await readFile(abs, "utf8"),
    ) as DailyStageEResultGradeCloseV1;
    const upgraded = await applyTerminalCoverageGapV2ToClose({ existing });
    assertDailyStageEInvariants(upgraded);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, `${JSON.stringify(upgraded, null, 2)}\n`, "utf8");
    console.log(`Wrote ${STAGE_E_CLOSE_REL} (v2 offline, network=0)`);
    logDoc(upgraded);
    return;
  }

  if (recheckFixtureId) {
    const existing = JSON.parse(
      await readFile(abs, "utf8"),
    ) as DailyStageEResultGradeCloseV1;
    const resultRunAt = new Date().toISOString();
    const recheck = await recheckExactFootballFixtureInClose({
      fixtureId: recheckFixtureId,
      existing,
      resultRunAt,
    });
    assertDailyStageEInvariants(recheck.document);
    const semanticChange =
      recheck.resultStateChanged ||
      recheck.scoreChanged ||
      recheck.document.eStatus !== existing.eStatus ||
      recheck.document.stageResult !== existing.stageResult ||
      recheck.document.closeContractVersion !== existing.closeContractVersion;
    console.log(
      `Recheck fixture=${recheckFixtureId} status=${recheck.providerStatusRaw} liveCall=${recheck.liveCall} cached=${recheck.cached} resultStateChanged=${recheck.resultStateChanged} scoreChanged=${recheck.scoreChanged}`,
    );
    if (!semanticChange) {
      console.log("No semantic Result/Grade change; artifact not rewritten.");
      logDoc(existing);
      return;
    }
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, `${JSON.stringify(recheck.document, null, 2)}\n`, "utf8");
    console.log(`Wrote ${STAGE_E_CLOSE_REL}`);
    logDoc(recheck.document);
    return;
  }

  const resultRunAt = new Date().toISOString();
  const doc = await buildDailyStageEResultGradeV1({
    resultRunAt,
    fetchLive: true,
  });
  assertDailyStageEInvariants(doc);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(`Wrote ${STAGE_E_CLOSE_REL}`);
  logDoc(doc);
  for (const call of doc.providerCalls) {
    console.log(
      `  ${call.provider} ${call.endpoint} live=${call.liveCall} sport=${call.sport} fixture=${call.fixtureId ?? "-"}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
