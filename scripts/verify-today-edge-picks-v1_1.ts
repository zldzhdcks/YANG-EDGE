/**
 * Verify TODAY EDGE PICK v1.1 (read-only).
 *   npx tsx scripts/verify-today-edge-picks-v1_1.ts
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
    const raw = await readFile(
      path.join(process.cwd(), rel),
      "utf8",
    );
    const doc = JSON.parse(raw) as { meta?: { predictionHashSha256?: string } };
    return doc.meta?.predictionHashSha256 ?? createHash("sha256").update(raw, "utf8").digest("hex");
  } catch {
    return null;
  }
}

async function main() {
  console.log("=== TODAY EDGE PICK v1.1 verification ===");
  console.log(`simNow=${SIM_NOW.toISOString()} (2026-07-27 22:40 KST)`);

  const forcedGraded = await loadTodayEdgePickInputs({
    forceDateKst: GRADED_DATE,
    now: SIM_NOW,
  });
  assert(
    forcedGraded != null,
    "forced 2026-07-27 load should return structured result",
  );
  assert(
    forcedGraded!.slateStatus === "NO_UPCOMING_SNAPSHOT",
    `2026-07-27 force should be NO_UPCOMING (got ${forcedGraded!.slateStatus})`,
  );
  assert(
    forcedGraded!.upcomingGameCount === 0,
    `2026-07-27 should have 0 upcoming games (got ${forcedGraded!.upcomingGameCount})`,
  );

  const runtimeSlate = await resolveUpcomingEdgeSlate({ now: SIM_NOW });
  assert(
    runtimeSlate.targetDateKst === UPCOMING_DATE,
    `runtime slate should be ${UPCOMING_DATE} (got ${runtimeSlate.targetDateKst})`,
  );
  assert(
    runtimeSlate.upcomingGameCount > 0,
    "2026-07-28 should have upcoming games",
  );

  const runtimeLoaded = await loadTodayEdgePickInputs({ now: SIM_NOW });
  assert(runtimeLoaded != null, "runtime load failed");
  assert(
    runtimeLoaded!.dateKst === UPCOMING_DATE,
    `runtime date should be ${UPCOMING_DATE}`,
  );

  const selection = selectTodayEdgePicks(
    runtimeLoaded!.candidates,
    new Date().toISOString(),
    3,
    SIM_NOW.getTime(),
  );

  assert(
    selection.picks.length <= 3,
    `max 3 picks (got ${selection.picks.length})`,
  );

  const eligibleCount = runtimeLoaded!.candidates.length - selection.excluded.length;
  assert(
    selection.picks.length <= eligibleCount,
    "must not exceed eligible count",
  );

  for (const pick of selection.picks) {
    assert(
      pick.todayEdgeRank >= 1 && pick.todayEdgeRank <= 3,
      `invalid rank ${pick.todayEdgeRank}`,
    );
  }

  const finishedInPicks = selection.picks.filter((p) => {
    const ex = selection.excluded.find((e) => e.gameId === p.gameId);
    return ex?.reasons.some((r) => r === "GAME_FINISHED");
  });
  assert(finishedInPicks.length === 0, "graded/finished games must not appear in picks");

  const gradedExcluded = selection.excluded.filter((e) =>
    e.reasons.includes("GAME_FINISHED"),
  );
  console.log(
    `2026-07-28 finished excluded=${gradedExcluded.length} (expected 0 on pending slate)`,
  );

  const forcedSelection = selectTodayEdgePicks(
    forcedGraded!.candidates,
    new Date().toISOString(),
    3,
    SIM_NOW.getTime(),
  );
  assert(
    forcedSelection.picks.length === 0,
    "2026-07-27 graded slate must yield 0 runtime picks",
  );
  const gradedFinished = forcedSelection.excluded.filter((e) =>
    e.reasons.includes("GAME_FINISHED"),
  );
  console.log(
    `2026-07-27 graded games excluded=${gradedFinished.length} (expect 15)`,
  );
  assert(
    gradedFinished.length === 15,
    `expected 15 graded exclusions on 2026-07-27 (got ${gradedFinished.length})`,
  );

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
    "ranking must be stable for identical input",
  );

  const apiSelection = selectTodayEdgePicks(
    runtimeLoaded!.candidates,
    new Date().toISOString(),
    3,
    SIM_NOW.getTime(),
  );
  const apiSlateStatus =
    apiSelection.picks.length > 0 ? "UPCOMING" : "NO_ELIGIBLE_PICKS";
  assert(
    apiSlateStatus === "NO_ELIGIBLE_PICKS" || apiSlateStatus === "UPCOMING",
    `unexpected slateStatus ${apiSlateStatus}`,
  );
  assert(
    runtimeLoaded!.dateKst === UPCOMING_DATE,
    "API target date should match upcoming slate",
  );

  if (apiSelection.picks.length > 0) {
    for (const pick of apiSelection.picks) {
      assert(
        pick.selectionReasonLabels.length === pick.selectionReasons.length,
        "Korean labels should be mapped for each reason",
      );
    }
  }

  const hash2727 = await readPredictionHash(GRADED_DATE);
  console.log(`prediction hash ${GRADED_DATE}=${hash2727}`);

  console.log("PASS: TODAY EDGE PICK v1.1 verification");
  console.log(`runtime targetDate=${runtimeLoaded!.dateKst}`);
  console.log(`selected=${selection.picks.length} candidate=${selection.candidateCount}`);
  console.log(`api slateStatus=${apiSlateStatus}`);
  console.log(`api selected=${apiSelection.picks.length}`);
}

main().catch((e) => {
  if (!process.exitCode) process.exitCode = 1;
  console.error(e);
});
