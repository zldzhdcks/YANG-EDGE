/**
 * Build NPB Official Results v0 from immutable Pregame Evidence Snapshot.
 * Usage: npx tsx scripts/build-npb-official-results-v0.ts 2026-08-07
 */
import { buildNpbOfficialResultsV0 } from "../src/lib/npb/official-result-intake-v0";

async function main() {
  const dateKst = process.argv[2] ?? "2026-08-07";
  const collectedAt = process.argv[3] ?? "2026-08-07T12:30:00.000Z";

  const result = await buildNpbOfficialResultsV0({
    dateKst,
    collectedAt,
    write: true,
  });

  const s = result.document.summary;
  console.log(`Wrote ${result.pathRel}`);
  console.log(
    `Games ${s.games} · FINAL ${s.FINAL} · join ${s.joinMatched}/${s.games}`,
  );
  console.log(`Pregame hash ${result.pregameHash.slice(0, 8)}… (unchanged source)`);
  console.log(
    `Market Favorite Won ${s.marketFavoriteWon} · Lost ${s.marketFavoriteLost}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
