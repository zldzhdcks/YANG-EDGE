/**
 * Tests: frozen prediction identity + edge semantics (no snapshot mutation).
 * Run: npm run test:mlb-prediction-identity-v0
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import {
  auditFrozenMlbPredictionIdentityV0,
  deriveMoneylineEdgeSemantics,
} from "../src/lib/mlb/prediction-v0";

function hashFile(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  // --- Edge semantics unit ---
  const detOak = deriveMoneylineEdgeSemantics({
    homeProbability: 0.488165,
    awayProbability: 0.511835,
    marketHomeProbability: 0.444444,
    marketAwayProbability: 0.555556,
  });
  assert.equal(detOak.mostLikelySelection, "AWAY");
  assert.ok(Math.abs((detOak.homeModelEdge ?? 0) - 0.043721) < 1e-5);
  assert.ok(Math.abs((detOak.awayModelEdge ?? 0) + 0.043721) < 1e-5);
  assert.ok(Math.abs((detOak.selectedSideEdge ?? 0) + 0.043721) < 1e-5);
  assert.equal(detOak.valueSelection, "HOME");
  assert.ok((detOak.valueEdge ?? 0) > 0);
  assert.ok(Math.abs(detOak.edgeComplementSum ?? 1) < 1e-9);
  // Must NOT treat homeModelEdge as AWAY value edge
  assert.notEqual(detOak.selectedSideEdge, detOak.homeModelEdge);

  const col = deriveMoneylineEdgeSemantics({
    homeProbability: 0.512116,
    awayProbability: 0.487884,
    marketHomeProbability: 0.517413,
    marketAwayProbability: 0.482587,
  });
  assert.equal(col.mostLikelySelection, "HOME");
  assert.ok((col.selectedSideEdge ?? 0) < 0);
  assert.equal(col.valueSelection, "AWAY");

  // --- Frozen 2026-08-02 identity ---
  const dateKst = "2026-08-02";
  const predPath = `data/predictions/mlb/${dateKst}.json`;
  assert.ok(existsSync(predPath), "frozen snapshot required");
  const before = hashFile(predPath);

  const audit = await auditFrozenMlbPredictionIdentityV0({ dateKst });
  assert.equal(audit.verdict, "SNAPSHOT_IDENTITY_VALID");
  assert.equal(audit.snapshotMutationRequired, false);
  assert.equal(audit.uniqueGamePk, 15);
  assert.equal(audit.scheduleMatched, 15);
  assert.equal(audit.oddsMatched, 15);
  assert.equal(audit.issues.length, 0);

  const colRow = audit.games.find((g) => g.gamePk === 824326);
  assert.ok(colRow);
  assert.equal(colRow!.scheduleHome, "Colorado Rockies");
  assert.equal(colRow!.scheduleAway, "Kansas City Royals");
  assert.equal(colRow!.predictionHome, "Colorado Rockies");
  assert.equal(colRow!.predictionAway, "Kansas City Royals");
  assert.equal(
    colRow!.displayMatchupAwayAtHome,
    "Kansas City Royals @ Colorado Rockies",
  );
  assert.equal(colRow!.identityOk, true);
  // Wrong display "Colorado Rockies @ Kansas City Royals" would be label-only reversed
  assert.notEqual(
    colRow!.displayMatchupAwayAtHome,
    "Colorado Rockies @ Kansas City Royals",
  );

  const oak = audit.games.find((g) => g.gamePk === 824972);
  assert.ok(oak);
  assert.equal(oak!.semantics.mostLikelySelection, "AWAY");
  assert.ok((oak!.semantics.selectedSideEdge ?? 0) < 0);
  assert.equal(oak!.semantics.valueSelection, "HOME");
  assert.equal(
    oak!.legacyReportedModelEdgeHome,
    oak!.semantics.homeModelEdge,
  );

  // Complements
  for (const g of audit.games) {
    assert.ok(Math.abs(g.homeProbability + g.awayProbability - 1) < 1e-6);
    if (
      g.marketHomeProbability != null &&
      g.marketAwayProbability != null
    ) {
      assert.ok(
        Math.abs(g.marketHomeProbability + g.marketAwayProbability - 1) <
          1e-5,
      );
    }
    assert.ok(Math.abs(g.semantics.edgeComplementSum ?? 1) < 1e-5);
    assert.equal(g.officialStatus === "BLOCKED" || g.officialStatus === "PASS" || g.officialStatus === "ELIGIBLE", true);
  }

  // Frozen hash unchanged by audit
  assert.equal(hashFile(predPath), before);
  assert.equal(audit.snapshotHashSha256, before);

  // Result independence: results file may exist; audit did not load it for mutation
  const resultsPath = `data/research/mlb/${dateKst}-official-results-v1.json`;
  const resultsExisted = existsSync(resultsPath);
  await auditFrozenMlbPredictionIdentityV0({ dateKst });
  assert.equal(existsSync(resultsPath), resultsExisted);
  assert.equal(hashFile(predPath), before);

  console.log("test:mlb-prediction-identity-v0 OK", {
    verdict: audit.verdict,
    col: colRow!.displayMatchupAwayAtHome,
    oakSelectedSideEdge: oak!.semantics.selectedSideEdge,
    oakValue: oak!.semantics.valueSelection,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
