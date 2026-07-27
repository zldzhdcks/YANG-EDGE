/**
 * Verify TODAY EDGE PICK v1.2 (read-only).
 *   npx tsx scripts/verify-today-edge-picks-v1_2.ts
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { kstMs } from "../src/lib/betting/purchase-window";
import { loadTodayEdgePickInputs } from "../src/lib/edge/load-today-edge-pick-inputs";
import { resolveUpcomingEdgeSlate } from "../src/lib/edge/resolve-upcoming-edge-slate";
import { selectTodayEdgePicks } from "../src/lib/edge/select-today-edge-picks";

const SIM_NOW = new Date(kstMs("2026-07-27", "22:40"));
const GRADED_DATE = "2026-07-27";
const UPCOMING_DATE = "2026-07-28";

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function assert(condition: boolean, message: string): void {
  if (!condition) fail(message);
}

async function readPredictionHash(dateKst: string): Promise<string | null> {
  const rel = `data/predictions/mlb/${dateKst}.json`;
  try {
    const raw = await readFile(path.join(process.cwd(), rel), "utf8");
    const doc = JSON.parse(raw) as { meta?: { predictionHashSha256?: string } };
    return (
      doc.meta?.predictionHashSha256 ??
      createHash("sha256").update(raw, "utf8").digest("hex")
    );
  } catch {
    return null;
  }
}

async function main() {
  console.log("=== TODAY EDGE PICK v1.2 verification ===");
  console.log(`simNow=${SIM_NOW.toISOString()} (2026-07-27 22:40 KST)`);

  const forcedGraded = await loadTodayEdgePickInputs({
    forceDateKst: GRADED_DATE,
    now: SIM_NOW,
  });
  assert(forcedGraded != null, "forced 2026-07-27 load failed");

  const gradedSelection = selectTodayEdgePicks(
    forcedGraded!.candidates,
    new Date().toISOString(),
    3,
    SIM_NOW.getTime(),
  );
  assert(
    gradedSelection.picks.length === 0,
    "2026-07-27 must expose 0 picks",
  );
  const gradedFinished = gradedSelection.excluded.filter((e) =>
    e.reasons.includes("GAME_FINISHED"),
  );
  assert(
    gradedFinished.length === 15,
    `expected 15 graded exclusions (got ${gradedFinished.length})`,
  );

  const runtimeSlate = await resolveUpcomingEdgeSlate({ now: SIM_NOW });
  assert(
    runtimeSlate.targetDateKst === UPCOMING_DATE,
    `runtime slate should be ${UPCOMING_DATE}`,
  );

  const runtimeLoaded = await loadTodayEdgePickInputs({ now: SIM_NOW });
  assert(runtimeLoaded != null, "runtime load failed");
  assert(runtimeLoaded!.dateKst === UPCOMING_DATE, "runtime date mismatch");

  console.log(
    "strict exclusion counts",
    JSON.stringify(
      selectTodayEdgePicks(
        runtimeLoaded!.candidates,
        new Date().toISOString(),
        3,
        SIM_NOW.getTime(),
      ).strictExclusionCounts,
    ),
  );

  const selection = selectTodayEdgePicks(
    runtimeLoaded!.candidates,
    new Date().toISOString(),
    3,
    SIM_NOW.getTime(),
  );

  assert(selection.strictSelectedCount === 0, "strict EDGE_PICK should be 0");
  assert(
    selection.researchCandidateCount > 0,
    "research candidates should exist for 2026-07-28",
  );
  assert(selection.picks.length <= 3, "max 3 picks");
  assert(
    selection.picks.length === selection.researchCandidateCount,
    "all picks should be research candidates when strict=0",
  );
  assert(
    selection.selectionMode === "RESEARCH_CANDIDATES_ONLY",
    `expected RESEARCH_CANDIDATES_ONLY (got ${selection.selectionMode})`,
  );

  for (const pick of selection.picks) {
    assert(pick.pickTier === "RESEARCH_CANDIDATE", "pick tier mismatch");
    assert(pick.risk !== "HIGH", "RISK_HIGH must not appear in picks");
    assert(
      !pick.missingReasonLabels.some((l) => l.includes("RISK")),
      "no risk codes in missing labels",
    );
  }

  const stable1 = selectTodayEdgePicks(
    runtimeLoaded!.candidates,
    "2026-07-27T13:40:00.000Z",
    3,
    SIM_NOW.getTime(),
  );
  const stable2 = selectTodayEdgePicks(
    runtimeLoaded!.candidates,
    "2026-07-27T13:40:00.000Z",
    3,
    SIM_NOW.getTime(),
  );
  assert(
    stable1.picks.map((p) => p.gameId).join(",") ===
      stable2.picks.map((p) => p.gameId).join(","),
    "ranking must be stable",
  );

  const hash = await readPredictionHash(GRADED_DATE);
  console.log(`prediction hash ${GRADED_DATE}=${hash}`);
  console.log(`strict=${selection.strictSelectedCount} research=${selection.researchCandidateCount}`);
  for (const pick of selection.picks) {
    console.log(
      `#${pick.rank} ${pick.gameId} tier=${pick.pickTier} conf=${pick.confidence} risk=${pick.risk}`,
    );
  }

  console.log("PASS: TODAY EDGE PICK v1.2 verification");
}

main().catch((e) => {
  if (!process.exitCode) process.exitCode = 1;
  console.error(e);
});
