/**
 * Verify TODAY EDGE PICK selection (read-only).
 *   npx tsx scripts/verify-today-edge-picks-v1.ts [YYYY-MM-DD]
 */
import { loadTodayEdgePickInputs } from "../src/lib/edge/load-today-edge-pick-inputs";
import { selectTodayEdgePicks } from "../src/lib/edge/select-today-edge-picks";

const DATE = process.argv[2]?.trim() || "2026-07-27";

async function main() {
  const loaded = await loadTodayEdgePickInputs({ forceDateKst: DATE });
  if (!loaded) {
    console.error("no prediction snapshot");
    process.exitCode = 1;
    return;
  }

  const selection = selectTodayEdgePicks(
    loaded.candidates,
    new Date().toISOString(),
    3,
  );

  console.log(`date=${loaded.dateKst} candidates=${selection.candidateCount}`);
  console.log(`selected=${selection.picks.length} excluded=${selection.excluded.length}`);
  for (const pick of selection.picks) {
    console.log(
      `#${pick.todayEdgeRank} ${pick.gameId} conf=${pick.confidence} risk=${pick.risk} pick=${pick.prediction}`,
    );
    console.log(`  reasons=${pick.selectionReasons.join(", ")}`);
    console.log(`  missing=${pick.missingReasons.join(", ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
