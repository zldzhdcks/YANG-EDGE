/**
 * 2026-08-30 Stage A intake tests.
 * Run: npm run test:2026-08-30-pregame-current-state-recovery-v1
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import {
  DATE_KST,
  FORMAL_OBSERVED_AT,
  INTAKE_STARTED_AT,
  PNG_GIT_EXCLUDE,
  REQUIRED_BASE_COMMIT,
  SCREENSHOTS,
  SEALED_2026_08_29,
  SLATE_DATE_KST,
  STRUCTURED_REL,
  runIntake,
  sha256File,
} from "./intake-2026-08-30-batch-2118-operator-pregame-observations";

function shaFile(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  const cwd = process.cwd();
  const { document } = await runIntake(cwd);
  assert.equal(DATE_KST, "2026-08-30");
  assert.equal(SLATE_DATE_KST, "2026-08-30");
  assert.equal(INTAKE_STARTED_AT, FORMAL_OBSERVED_AT);
  assert.equal(REQUIRED_BASE_COMMIT, "84cc91a2fcb8ab1485e1ac359b64b4398d034b6a");
  assert.equal(document.predictionCreated, 0);
  assert.equal(document.predictionInput, false);
  assert.equal(document.engineInput, false);
  assert.equal(document.marketBenchmarkOnly, true);
  assert.equal(document.fuzzyMatchingUsed, false);
  assert.equal(document.summary.matchupCount, 64);
  assert.equal(document.summary.officialTargetDateScopeCount, 44);
  assert.equal(document.summary.excludedCrossDateCount, 20);
  assert.equal(document.summary.footballOddsFixtures, 49);
  assert.equal(document.summary.mlbOddsMatchups, 15);
  assert.equal(document.summary.basketballOddsFixtures, 0);
  assert.equal(document.summary.rowsObserved, 291);
  assert.equal(document.summary.inventedOddsFields, 0);
  assert.equal(document.summary.predictionCalls, 0);
  assert.equal(document.summary.resultCalls, 0);
  assert.equal(document.summary.engineCalls, 0);
  assert.equal(SCREENSHOTS.length, 10);

  const ids = [
    ...document.footballOddsFixtures,
    ...document.mlbOddsGames,
  ].flatMap((r: { markets: Array<{ rowIds: number[] }> }) =>
    r.markets.flatMap((m) => m.rowIds),
  );
  assert.equal(new Set(ids).size, 291);
  for (const gap of [7538, 7539, 7540, 7541, 7686, 7687, 7688, 7689]) {
    assert.equal(ids.includes(gap), false, `invented gap ${gap}`);
  }

  const excluded = document.footballOddsFixtures.filter(
    (r: { displayedDateKst: string }) => r.displayedDateKst === "2026-08-29",
  );
  assert.equal(excluded.length, 20);
  assert.ok(
    excluded.every(
      (r: { scopeMembership: string }) =>
        r.scopeMembership === "EXCLUDED_NON_TARGET_DATE",
    ),
  );

  for (const sealed of SEALED_2026_08_29) {
    assert.equal(sha256File(path.join(cwd, sealed.rel)), sealed.sha256, sealed.rel);
  }

  const pngTracked = execSync(
    "git ls-files -- data/operator-observations/raw/2026-08-30",
    { encoding: "utf8" },
  )
    .split(/\r?\n/)
    .filter((l) => l.endsWith(".png"));
  assert.equal(pngTracked.length, 0);
  assert.equal(
    PNG_GIT_EXCLUDE,
    "data/operator-observations/raw/2026-08-30/batch-2118/*.png",
  );
  assert.equal(existsSync(path.join(cwd, STRUCTURED_REL)), true);
  assert.equal(shaFile(path.join(cwd, STRUCTURED_REL)).length, 64);
  console.log("PASS 2026-08-30 Stage A intake");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
