/**
 * MLB official final results collector v1.
 *
 * npm run result:mlb -- YYYY-MM-DD
 */
import { instantToKst } from "../src/lib/datetime/kst";
import { buildMlbOfficialResultsV1 } from "../src/lib/mlb/build-mlb-official-results";

const dateKst =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  instantToKst(new Date())?.date ||
  "";

async function main() {
  if (!dateKst) {
    console.error("Usage: npm run result:mlb -- YYYY-MM-DD");
    process.exit(1);
  }

  console.log(`=== MLB Official Results v1 (${dateKst}) ===`);
  const { document, pathRel, usage } = await buildMlbOfficialResultsV1({
    dateKst,
  });

  const finalCount = document.games.filter((g) => g.status === "FINAL").length;
  const pendingCount = document.games.filter(
    (g) => g.status === "NOT_FINAL",
  ).length;

  console.log(`Wrote ${pathRel}`);
  console.log(`resultHash=${document.resultHash}`);
  console.log(
    `games=${document.games.length} FINAL=${finalCount} NOT_FINAL=${pendingCount}`,
  );
  console.log(
    `statsApi networkCalls=${usage.networkCalls} rawHit=${usage.rawHit} rawMiss=${usage.rawMiss}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
