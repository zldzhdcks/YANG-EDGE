/**
 * NPB Official Result Intake v0 tests.
 * Run: npm run test:npb-official-result-intake-v0
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildNpbOfficialResultsV0,
  loadNpbOfficialResultIntakeView,
  loadNpbOfficialResultsV0,
  mapScoresOntoPregame,
  teamPairKey,
  type NpbCollectedOfficialGameV0,
} from "../src/lib/npb/official-result-intake-v0";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  const root = process.cwd();
  const dateKst = "2026-08-07";
  const snapshotRel = `data/predictions/npb/${dateKst}.json`;
  assert.ok(existsSync(snapshotRel), "pregame snapshot must exist");

  const snapshotBeforeHash = sha256File(snapshotRel);
  const snapshotBeforeMtime = statSync(snapshotRel).mtimeMs;
  const snapshotJson = JSON.parse(readFileSync(snapshotRel, "utf8")) as {
    predictionHashSha256: string;
    games: Array<{
      gameId: string;
      awayTeam: string;
      homeTeam: string;
      lineup: { status: string };
    }>;
  };
  assert.ok(
    snapshotJson.predictionHashSha256.startsWith("44bf11d6"),
    `expected hash prefix 44bf11d6…, got ${snapshotJson.predictionHashSha256.slice(0, 8)}`,
  );
  assert.equal(snapshotJson.games.length, 6);

  // Team-pair join ignores home/away venue flip.
  assert.equal(
    teamPairKey("Hanshin Tigers", "Chunichi Dragons"),
    teamPairKey("Chunichi Dragons", "Hanshin Tigers"),
  );
  const mapped = mapScoresOntoPregame(
    { awayTeam: "Hanshin Tigers", homeTeam: "Chunichi Dragons" },
    {
      awayTeam: "Chunichi Dragons",
      homeTeam: "Hanshin Tigers",
      awayScore: 3,
      homeScore: 2,
    },
  );
  assert.equal(mapped.awayScore, 2);
  assert.equal(mapped.homeScore, 3);

  const tmp = mkdtempSync(path.join(tmpdir(), "npb-official-result-"));
  mkdirSync(path.join(tmp, "data/predictions/npb"), { recursive: true });
  cpSync(path.join(root, snapshotRel), path.join(tmp, snapshotRel));

  const built = await buildNpbOfficialResultsV0({
    dateKst,
    cwd: tmp,
    collectedAt: "2026-08-07T12:30:00.000Z",
    write: true,
  });

  assert.equal(built.document.summary.games, 6);
  assert.equal(built.document.summary.joinMatched, 6);
  assert.equal(built.document.summary.FINAL, 6);
  assert.equal(built.document.summary.CANCELLED, 0);
  assert.equal(built.document.summary.POSTPONED, 0);
  assert.equal(built.document.summary.NOT_FINAL, 0);
  assert.equal(
    built.document.pregameSnapshotHashSha256,
    snapshotJson.predictionHashSha256,
  );
  assert.ok(built.document.pregameSnapshotHashSha256.startsWith("44bf11d6"));

  for (const g of built.document.games) {
    assert.equal(g.joinStatus, "MATCHED");
    assert.equal(g.status, "FINAL");
    assert.ok(g.winner === "HOME" || g.winner === "AWAY" || g.winner === "DRAW");
    assert.equal(g.modelGrade, "NOT_APPLICABLE");
    assert.equal(g.predictionAccuracy, "NOT_APPLICABLE");
    assert.equal(g.marketObservation.kind, "MARKET_OBSERVATION_RESULT");
    assert.equal(g.lineupStatus, "NOT_RELEASED");
    assert.ok(g.awayScore != null);
    assert.ok(g.homeScore != null);
  }

  assert.equal(
    built.document.summary.marketFavoriteWon +
      built.document.summary.marketFavoriteLost +
      built.document.summary.marketFavoriteNotApplicable,
    6,
  );
  assert.ok(built.document.summary.marketFavoriteWon >= 1);
  assert.ok(built.document.summary.marketFavoriteLost >= 1);

  // Pregame snapshot must remain byte-identical (immutable).
  assert.equal(sha256File(path.join(tmp, snapshotRel)), snapshotBeforeHash);
  assert.equal(sha256File(snapshotRel), snapshotBeforeHash);
  assert.equal(statSync(snapshotRel).mtimeMs, snapshotBeforeMtime);

  const loaded = await loadNpbOfficialResultsV0({ dateKst, cwd: tmp });
  assert.ok(loaded);
  assert.equal(loaded!.games.length, 6);

  const view = await loadNpbOfficialResultIntakeView({ dateKst, cwd: tmp });
  assert.equal(view.hasResults, true);
  assert.equal(view.games.length, 6);
  assert.ok(view.predictionNote.includes("NOT_APPLICABLE"));
  for (const g of view.games) {
    assert.equal(g.beforeGame.lineupStatus, "NOT_RELEASED");
    assert.equal(g.afterGame.status, "FINAL");
    assert.ok(g.afterGame.favoriteWon === "YES" || g.afterGame.favoriteWon === "NO");
  }

  // Ambiguous join path
  const dup: NpbCollectedOfficialGameV0[] = [
    {
      sourceGameKey: "a",
      awayTeam: "Hanshin Tigers",
      homeTeam: "Chunichi Dragons",
      awayScore: 1,
      homeScore: 0,
      status: "FINAL",
      sourceUrl: "x",
    },
    {
      sourceGameKey: "b",
      awayTeam: "Chunichi Dragons",
      homeTeam: "Hanshin Tigers",
      awayScore: 0,
      homeScore: 1,
      status: "FINAL",
      sourceUrl: "y",
    },
  ];
  const amb = await buildNpbOfficialResultsV0({
    dateKst,
    cwd: tmp,
    collected: dup,
    write: false,
  });
  const chunichi = amb.document.games.find(
    (g) => g.gameId === "npb-chunichi-dragons-hanshin-tigers",
  );
  assert.ok(chunichi);
  assert.equal(chunichi!.joinStatus, "AMBIGUOUS");
  assert.equal(chunichi!.winner, null);

  // Write repo artifact for Research UI (same deterministic payload).
  const repoBuild = await buildNpbOfficialResultsV0({
    dateKst,
    cwd: root,
    collectedAt: "2026-08-07T12:30:00.000Z",
    write: true,
  });
  assert.equal(repoBuild.document.summary.joinMatched, 6);
  assert.equal(sha256File(snapshotRel), snapshotBeforeHash);
  assert.equal(statSync(snapshotRel).mtimeMs, snapshotBeforeMtime);

  // Ensure artifact JSON is valid and does not claim engine grades.
  const artifact = readFileSync(
    path.join(root, `data/research/npb/${dateKst}-official-results-v0.json`),
    "utf8",
  );
  assert.ok(artifact.includes("NOT_APPLICABLE"));
  assert.ok(artifact.includes("MARKET_OBSERVATION_RESULT"));
  assert.ok(!artifact.includes("GOOD_PICK"));

  // Touch-guard: writing unrelated file must not mutate snapshot (sanity).
  writeFileSync(
    path.join(tmp, "data/research/npb/touch-guard.txt"),
    "ok\n",
    "utf8",
  );
  assert.equal(sha256File(path.join(tmp, snapshotRel)), snapshotBeforeHash);

  console.log("\ntest:npb-official-result-intake-v0 OK");
  console.log(
    `Pregame hash ${snapshotJson.predictionHashSha256.slice(0, 8)}… unchanged`,
  );
  console.log(
    `Join ${repoBuild.document.summary.joinMatched}/6 · FINAL ${repoBuild.document.summary.FINAL}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
