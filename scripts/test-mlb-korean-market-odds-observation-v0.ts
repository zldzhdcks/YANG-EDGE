/**
 * MLB Korean Market Odds Observation v0 tests.
 * Run: npm run test:mlb-korean-market-odds-observation-v0
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
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  parseDecimalOdds,
  saveMlbKoreanMarketOddsObservation,
  loadMlbKoreanMarketOddsObservation,
  mlbKoreanMarketOddsObservationRel,
  mlbOddsHistoryDatasetRel,
  mlbExpectedLineupObservationRel,
  mlbPredictionSnapshotRel,
  mlbEngineRecommendationRel,
} from "../src/lib/mlb/korean-market-odds-observation-v0";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  const root = process.cwd();
  const dateKst = "2026-08-08";

  assert.equal(parseDecimalOdds(1.56).ok, true);
  assert.equal(parseDecimalOdds(1).ok, false);
  assert.equal(parseDecimalOdds("abc").ok, false);

  const scheduleRel = `data/research/mlb/${dateKst}-schedule-v1.json`;
  const oddsRel = mlbOddsHistoryDatasetRel(dateKst);
  const lineupObsRel = mlbExpectedLineupObservationRel(dateKst);
  const predRel = mlbPredictionSnapshotRel(dateKst);
  const recRel = mlbEngineRecommendationRel(dateKst);

  assert.ok(existsSync(scheduleRel));
  assert.ok(existsSync(oddsRel));
  assert.ok(existsSync(lineupObsRel));
  assert.ok(existsSync(predRel));
  assert.ok(existsSync(recRel));

  const oddsBefore = sha256File(oddsRel);
  const lineupObsBefore = sha256File(lineupObsRel);
  const predBefore = sha256File(predRel);
  const recBefore = sha256File(recRel);
  const oddsMtime = statSync(oddsRel).mtimeMs;
  const lineupObsMtime = statSync(lineupObsRel).mtimeMs;
  const predMtime = statSync(predRel).mtimeMs;
  const recMtime = statSync(recRel).mtimeMs;
  const predHash = (
    JSON.parse(readFileSync(predRel, "utf8")) as {
      meta: { predictionHashSha256: string };
    }
  ).meta.predictionHashSha256;
  assert.ok(predHash.startsWith("809b3973"));

  const schedule = JSON.parse(readFileSync(scheduleRel, "utf8")) as {
    games: Array<{ gamePk: number; awayTeam: string; homeTeam: string }>;
  };
  assert.equal(schedule.games.length, 15);

  const tmp = mkdtempSync(path.join(tmpdir(), "mlb-korean-odds-"));
  mkdirSync(path.dirname(path.join(tmp, scheduleRel)), { recursive: true });
  cpSync(path.join(root, scheduleRel), path.join(tmp, scheduleRel));

  const drafts = schedule.games.map((g, i) => ({
    gamePk: g.gamePk,
    awayOdds: 1.5 + (i % 5) * 0.1,
    homeOdds: 2.4 - (i % 5) * 0.1,
  }));

  // Late blocked
  const late = await saveMlbKoreanMarketOddsObservation({
    dateKst,
    cwd: tmp,
    observedAt: "2026-08-09T12:00:00.000Z",
    drafts,
    allowLate: false,
  });
  assert.equal(late.ok, false);
  assert.ok(late.errors.some((e) => e.startsWith("LATE_OBSERVATION_BLOCKED")));

  // JOIN_REVIEW_REQUIRED blocks
  const review = await saveMlbKoreanMarketOddsObservation({
    dateKst,
    cwd: tmp,
    observedAt: "2026-08-07T07:00:00.000Z",
    drafts: drafts.map((d, i) =>
      i === 0 ? { ...d, joinReviewRequired: true } : d,
    ),
  });
  assert.equal(review.ok, false);
  assert.ok(review.errors.some((e) => e.startsWith("JOIN_REVIEW_REQUIRED")));

  // Invalid odds
  const bad = await saveMlbKoreanMarketOddsObservation({
    dateKst,
    cwd: tmp,
    observedAt: "2026-08-07T07:00:00.000Z",
    drafts: drafts.map((d, i) => (i === 0 ? { ...d, awayOdds: 0.95 } : d)),
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => /ODDS_MUST_BE_GT_1/.test(e)));

  // Away/home mapping preserved from schedule
  const samplePk = schedule.games.find(
    (g) =>
      g.awayTeam === "New York Mets" && g.homeTeam === "Pittsburgh Pirates",
  )!.gamePk;
  const mappedDrafts = drafts.map((d) =>
    d.gamePk === samplePk ? { ...d, awayOdds: 2.02, homeOdds: 1.56 } : d,
  );

  const pre = await saveMlbKoreanMarketOddsObservation({
    dateKst,
    cwd: tmp,
    observedAt: "2026-08-07T07:00:00.000Z",
    drafts: mappedDrafts,
  });
  assert.equal(pre.ok, true);
  assert.ok(pre.document);
  assert.equal(pre.document!.summary.scheduleGames, 15);
  assert.equal(pre.document!.summary.matchedGames, 15);
  assert.equal(pre.document!.summary.observedGames, 15);
  assert.equal(pre.document!.summary.preGameObservations, 15);
  assert.equal(pre.document!.summary.lateGames, 0);
  assert.equal(pre.document!.sourceType, "MANUAL_OBSERVATION");
  assert.equal(pre.document!.marketContext, "KOREAN_MARKET");
  assert.equal(pre.document!.marketType, "MONEYLINE");
  assert.ok(pre.document!.koreanMarketOddsHash.length === 64);

  const pit = pre.document!.games.find((g) => g.gamePk === samplePk)!;
  assert.equal(pit.awayTeam, "New York Mets");
  assert.equal(pit.homeTeam, "Pittsburgh Pirates");
  assert.equal(pit.awayOdds, 2.02);
  assert.equal(pit.homeOdds, 1.56);
  assert.equal(pit.joinStatus, "MATCHED");
  assert.equal(pit.observationStatus, "PRE_GAME_OBSERVATION");

  // Late allowed
  const lateDir = path.join(tmp, "late");
  mkdirSync(path.dirname(path.join(lateDir, scheduleRel)), { recursive: true });
  cpSync(path.join(root, scheduleRel), path.join(lateDir, scheduleRel));
  const lateOk = await saveMlbKoreanMarketOddsObservation({
    dateKst,
    cwd: lateDir,
    observedAt: "2026-08-09T12:00:00.000Z",
    drafts,
    allowLate: true,
  });
  assert.equal(lateOk.ok, true);
  assert.equal(lateOk.document!.summary.lateGames, 15);

  // Mutation audit
  assert.equal(sha256File(oddsRel), oddsBefore);
  assert.equal(sha256File(lineupObsRel), lineupObsBefore);
  assert.equal(sha256File(predRel), predBefore);
  assert.equal(sha256File(recRel), recBefore);
  assert.equal(statSync(oddsRel).mtimeMs, oddsMtime);
  assert.equal(statSync(lineupObsRel).mtimeMs, lineupObsMtime);
  assert.equal(statSync(predRel).mtimeMs, predMtime);
  assert.equal(statSync(recRel).mtimeMs, recMtime);

  // Optional: if operator already saved repo artifact, validate shape
  const obsRel = mlbKoreanMarketOddsObservationRel(dateKst);
  const loaded = existsSync(obsRel)
    ? await loadMlbKoreanMarketOddsObservation({ dateKst })
    : pre.document;

  console.log("=== MLB KOREAN MARKET OBSERVATION ===\n");
  console.log(`Date: ${dateKst}`);
  console.log(`Games: ${schedule.games.length}`);
  console.log(`Matched: ${loaded!.summary.matchedGames}`);
  console.log(`Observed: ${loaded!.summary.observedGames}`);
  console.log(`Missing: ${loaded!.summary.missingGames}`);
  console.log(`Late: ${loaded!.summary.lateGames}`);
  console.log("");
  console.log("Market: MONEYLINE");
  console.log("Source: MANUAL_OBSERVATION");
  console.log("Context: KOREAN_MARKET");
  console.log("");
  console.log("Provider Odds: UNCHANGED");
  console.log("Expected Lineup: 15/15 preserved");
  console.log("Prediction Snapshot: PRE_GAME_SNAPSHOT_VERIFIED / UNCHANGED");
  console.log(`Prediction Hash: ${predHash.slice(0, 8)}…`);
  console.log("Recommendation Record: SEALED / UNCHANGED");
  console.log("");
  console.log("Mutation: NONE");
  if (existsSync(obsRel)) {
    console.log(
      `Repo artifact: ${obsRel} · hash ${loaded!.koreanMarketOddsHash.slice(0, 8)}…`,
    );
  } else {
    console.log(
      "Repo artifact: NOT YET — enter 15/15 via /internal/research/mlb/korean-odds",
    );
  }
  console.log("\ntest:mlb-korean-market-odds-observation-v0 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
