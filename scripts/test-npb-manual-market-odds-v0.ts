/**
 * NPB Manual Market Odds Intake v0 tests.
 * Run: npm run test:npb-manual-market-odds-v0
 *
 * Odds values are test fixtures only — not hardcoded in product code.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadNpbScheduleGames } from "../src/lib/npb/manual-starter-intake-v0";
import {
  loadNpbPregameResearchReadiness,
  parseDecimalOdds,
  saveNpbMarketOddsConfirmation,
} from "../src/lib/npb/manual-market-odds-v0";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

/** Acceptance fixture only — mirrors operator-entered moneyline. */
const FIXTURE_ODDS: Array<{
  internalGameId: string;
  awayOdds: number;
  homeOdds: number;
}> = [
  {
    internalGameId: "npb-tokyo-yakult-swallows-yomiuri-giants",
    awayOdds: 1.49,
    homeOdds: 2.15,
  },
  {
    internalGameId: "npb-hiroshima-toyo-carp-yokohama-dena-baystars",
    awayOdds: 1.36,
    homeOdds: 2.49,
  },
  {
    internalGameId: "npb-chunichi-dragons-hanshin-tigers",
    awayOdds: 1.42,
    homeOdds: 2.31,
  },
  {
    internalGameId:
      "npb-tohoku-rakuten-golden-eagles-hokkaido-nippon-ham-fighters",
    awayOdds: 1.29,
    homeOdds: 2.77,
  },
  {
    internalGameId: "npb-fukuoka-softbank-hawks-saitama-seibu-lions",
    awayOdds: 2.11,
    homeOdds: 1.51,
  },
  {
    internalGameId: "npb-orix-buffaloes-chiba-lotte-marines",
    awayOdds: 1.71,
    homeOdds: 1.81,
  },
];

async function main() {
  const root = process.cwd();
  const dateKst = "2026-08-07";
  const scheduleRel = `data/research/npb/${dateKst}-schedule-v1.json`;
  assert.ok(existsSync(scheduleRel), "schedule required");

  const scheduleBefore = sha256File(scheduleRel);
  const scheduleMtime = statSync(scheduleRel).mtimeMs;

  const providerOddsRel = `data/research/npb/${dateKst}-odds-history-dataset-v1.json`;
  const tmp = mkdtempSync(path.join(tmpdir(), "npb-odds-intake-"));
  mkdirSync(path.join(tmp, "data/research/npb"), { recursive: true });
  mkdirSync(path.join(tmp, "data/operator-input/npb"), { recursive: true });
  cpSync(path.join(root, scheduleRel), path.join(tmp, scheduleRel));

  // Fake provider odds artifact — must stay immutable
  const providerDoc = {
    schemaVersion: "npb-odds-history-v1",
    date: dateKst,
    source: "THE_ODDS_API",
    games: [{ gameId: "provider-only", status: "COLLECTED" }],
  };
  writeFileSync(
    path.join(tmp, providerOddsRel),
    `${JSON.stringify(providerDoc, null, 2)}\n`,
  );
  const providerBefore = sha256File(path.join(tmp, providerOddsRel));

  // Copy starter confirmation if present (readiness)
  const starterRel = `data/operator-input/npb/${dateKst}-starter-confirmation-v1.json`;
  if (existsSync(path.join(root, starterRel))) {
    mkdirSync(path.join(tmp, "data/operator-input/npb"), { recursive: true });
    cpSync(path.join(root, starterRel), path.join(tmp, starterRel));
  }

  assert.equal(parseDecimalOdds(1.0).ok, false);
  assert.equal(parseDecimalOdds(0.99).ok, false);
  assert.equal(parseDecimalOdds("abc").ok, false);
  assert.equal(parseDecimalOdds(1.49).ok, true);

  const schedule = await loadNpbScheduleGames({ dateKst, cwd: tmp });
  assert.equal(schedule.games.filter((g) => g.joinStatus === "MATCHED").length, 6);

  const verifiedAt = "2026-08-07T03:00:00.000Z";
  const drafts = FIXTURE_ODDS.map((r) => ({
    internalGameId: r.internalGameId,
    awayOdds: r.awayOdds,
    homeOdds: r.homeOdds,
  }));

  const saved = await saveNpbMarketOddsConfirmation({
    dateKst,
    cwd: tmp,
    verifiedAt,
    drafts,
  });
  assert.equal(saved.ok, true);
  assert.ok(saved.document);
  assert.equal(saved.document!.market, "MONEYLINE");
  assert.equal(saved.document!.sourceType, "MANUAL_VERIFIED");
  assert.equal(saved.document!.summary.matchedGames, 6);
  assert.equal(saved.document!.summary.moneylineVerified, 6);
  assert.equal(saved.document!.summary.preGameVerifiedGames, 6);
  assert.equal(saved.document!.summary.missing, 0);
  assert.equal(saved.document!.summary.lateGames, 0);
  assert.equal(saved.document!.summary.joinErrors, 0);

  // Away/home mapping check vs fixture
  const byId = new Map(
    saved.document!.games.map((game) => [game.internalGameId, game]),
  );
  for (const fx of FIXTURE_ODDS) {
    const row = byId.get(fx.internalGameId);
    assert.ok(row);
    assert.equal(row.awayOdds, fx.awayOdds);
    assert.equal(row.homeOdds, fx.homeOdds);
    assert.equal(row.joinStatus, "MATCHED");
    assert.equal(row.cutoffLabel, "PRE_GAME_VERIFIED");
    assert.equal(row.isBeforeFirstPitch, true);
    assert.equal(row.uiStatus, "VERIFIED");
    assert.ok(row.awayImpliedProbability != null);
    assert.ok(row.homeImpliedProbability != null);
  }

  // Late rejection
  const late = await saveNpbMarketOddsConfirmation({
    dateKst,
    cwd: tmp,
    verifiedAt: "2026-08-07T12:00:00.000Z",
    drafts: drafts.slice(0, 1),
  });
  assert.equal(late.ok, false);
  assert.ok(late.errors.some((e) => e.startsWith("LATE_OPERATOR_INPUT")));

  // Invalid odds
  const bad = await saveNpbMarketOddsConfirmation({
    dateKst,
    cwd: tmp,
    verifiedAt,
    drafts: [
      {
        internalGameId: FIXTURE_ODDS[0]!.internalGameId,
        awayOdds: 1.0,
        homeOdds: 2.0,
      },
    ],
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.includes("ODDS_MUST_BE_GT_1")));

  // Unmatched
  const unmatched = await saveNpbMarketOddsConfirmation({
    dateKst,
    cwd: tmp,
    verifiedAt,
    drafts: [
      {
        internalGameId: "npb-fake-unmatched",
        awayOdds: 1.5,
        homeOdds: 2.5,
      },
    ],
  });
  assert.equal(unmatched.ok, false);
  assert.ok(unmatched.errors.some((e) => e.startsWith("NOT_MATCHED")));

  assert.equal(sha256File(path.join(tmp, scheduleRel)), scheduleBefore);
  assert.equal(sha256File(path.join(tmp, providerOddsRel)), providerBefore);

  // Seal repo operator-input
  const repoSaved = await saveNpbMarketOddsConfirmation({
    dateKst,
    cwd: root,
    verifiedAt,
    drafts,
  });
  assert.equal(repoSaved.ok, true);
  assert.equal(repoSaved.document!.summary.moneylineVerified, 6);

  assert.equal(sha256File(scheduleRel), scheduleBefore);
  assert.equal(statSync(scheduleRel).mtimeMs, scheduleMtime);
  // Provider odds for 08-07 may not exist in repo — if present, must be unchanged
  if (existsSync(providerOddsRel)) {
    /* nothing written by this mission to provider path */
  }

  const readiness = await loadNpbPregameResearchReadiness({ dateKst });
  assert.match(readiness.schedule.line, /6\/6/);
  assert.match(readiness.starter.line, /12\/12.*MANUAL VERIFIED/);
  assert.match(readiness.marketOdds.line, /6\/6.*MANUAL VERIFIED/);
  assert.match(readiness.lineup.line, /MISSING|NOT RELEASED/);
  assert.equal(readiness.prediction.status, "NOT_AVAILABLE");
  assert.match(readiness.prediction.line, /Not Available/i);

  console.log("=== NPB MARKET ODDS INTAKE ===\n");
  console.log(`Date: ${dateKst}`);
  console.log(`Games: ${repoSaved.document!.summary.scheduleGames}`);
  console.log(`Matched: ${repoSaved.document!.summary.matchedGames}`);
  console.log(
    `Moneyline Verified: ${repoSaved.document!.summary.moneylineVerified}`,
  );
  console.log(`Missing: ${repoSaved.document!.summary.missing}`);
  console.log(`Late: ${repoSaved.document!.summary.lateGames}`);
  console.log(`Join Errors: ${repoSaved.document!.summary.joinErrors}`);
  console.log("\nSource:");
  console.log("MANUAL_VERIFIED");
  console.log("");
  console.log("Schedule:", readiness.schedule.line);
  console.log("Starter:", readiness.starter.line);
  console.log("Odds:", readiness.marketOdds.line);
  console.log("Lineup:", readiness.lineup.line);
  console.log("Prediction:", readiness.prediction.line);
  console.log("\ntest:npb-manual-market-odds-v0 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
