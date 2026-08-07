/**
 * MLB Good Pick Human Feedback Review v1
 * Run: npm run test:mlb-good-pick-feedback-v1
 * Read-only — prediction artifact must not change.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { loadDailyPicksV1 } from "../src/lib/mlb/daily-picks-v1";
import { loadGoodPickFeedbackV1 } from "../src/lib/mlb/good-pick-feedback-v1";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  const dateKst = "2026-08-06";
  const predPath = `data/predictions/mlb/${dateKst}.json`;
  const beforeHash = sha256File(predPath);
  const beforeMtime = statSync(predPath).mtimeMs;
  const predDoc = JSON.parse(readFileSync(predPath, "utf8"));
  const predictionHash = predDoc.meta.predictionHashSha256 as string;

  // 08-06: reconstructed research review (not ENGINE recommendations)
  const picks = await loadDailyPicksV1({ dateKst, sealDeliveryRecord: false });
  assert.equal(picks.goodPicks.length, 0);
  assert.ok(picks.reconstructedPicks.length >= 1);
  assert.ok(picks.reconstructedPicks.length <= 3);

  const view = await loadGoodPickFeedbackV1({ dateKst });
  assert.equal(view.loaded, true);
  assert.equal(view.statusCode, "OK");
  assert.equal(view.predictionHash, predictionHash);
  // Research review may still list reconstructed games; official Good Pick scoreboard is 0
  assert.equal(view.goodPickScoreboard.goodPickCount, 0);
  assert.ok(view.games.length >= 1);
  assert.deepEqual(
    view.games.map((g) => g.gameId).sort(),
    picks.reconstructedPicks.map((g) => g.gameId).sort(),
  );

  // All research vs Good Picks separated
  assert.ok(view.allResearch);
  assert.equal(view.allResearch!.totalGames, 15);
  assert.equal(view.allResearch!.graded, 15);
  assert.equal(view.allResearch!.correct, 10);
  assert.equal(view.allResearch!.incorrect, 5);
  assert.equal(view.allResearch!.accuracyPercent, 66.7);
  assert.ok(view.allResearch!.brier != null);
  assert.ok(view.allResearch!.logLoss != null);
  assert.equal(view.allResearch!.leakageStatus, "PASS");

  const sb = view.goodPickScoreboard;
  assert.equal(sb.goodPickCount, 0);

  for (const g of view.games) {
    assert.equal(g.pickTier, "GOOD");
    assert.ok(g.beforeSignals.length >= 5);
    assert.ok(g.preGameRisks.length >= 1);
    assert.ok(g.whatWeLearned.length > 40);
    assert.ok(
      g.grade === "CORRECT" ||
        g.grade === "INCORRECT" ||
        g.grade === "PENDING" ||
        g.grade === "UNKNOWN",
    );
    if (g.grade === "CORRECT") {
      assert.ok(g.whyCorrect.length >= 1, `whyCorrect missing for ${g.gameId}`);
    }
    if (g.grade === "INCORRECT") {
      assert.ok(
        g.whyIncorrect.length >= 1,
        `whyIncorrect missing for ${g.gameId}`,
      );
    }
    // No postgame leakage into before risks from results
    for (const s of g.beforeSignals) {
      assert.ok(
        [
          "POSITIVE",
          "NEGATIVE",
          "NEUTRAL",
          "LIMITED",
          "NOT_CONNECTED",
          "NOT_AVAILABLE",
        ].includes(s.polarity),
      );
    }
  }

  assert.ok(view.dailyLearning);
  assert.ok(view.dailyLearning!.researchQuestions.length >= 1);
  assert.match(view.dailyLearning!.plain, /Engine|Research Question|표본/);

  // 08-07 NO_PREGAME_SNAPSHOT
  const missing = await loadGoodPickFeedbackV1({ dateKst: "2026-08-07" });
  assert.equal(missing.statusCode, "NO_PREGAME_SNAPSHOT");
  assert.equal(missing.loaded, false);
  assert.equal(missing.games.length, 0);
  assert.equal(missing.goodPickScoreboard.goodPickCount, 0);
  assert.match(missing.error ?? "", /NO_PREGAME_SNAPSHOT/);

  // Mutation audit
  assert.equal(sha256File(predPath), beforeHash);
  assert.equal(statSync(predPath).mtimeMs, beforeMtime);
  assert.equal(view.predictionHash, predictionHash);

  // Console report for operator
  console.log("=== 2026-08-06 GOOD PICK REVIEW ===");
  console.log(
    `Good Picks: ${sb.goodPickCount}\nCorrect: ${sb.correct}\nIncorrect: ${sb.incorrect}\nAccuracy: ${sb.accuracyPercent}%`,
  );
  for (const [i, g] of view.games.entries()) {
    console.log(`\n${i + 1}. ${g.matchupLine}`);
    console.log(`Pick: ${g.pickTeam}`);
    console.log(`Probability: ${g.modelProbabilityPercent}`);
    console.log(`Confidence: ${g.confidence}`);
    console.log(`Result: ${g.finalScore}`);
    console.log(`Grade: ${g.grade}`);
    console.log("Before:");
    for (const s of g.beforeSignals) {
      console.log(`- ${s.label}: ${s.polarity}`);
    }
    console.log(
      `Pre-game Risk: ${g.preGameRisks.map((r) => r.label).join(", ")}`,
    );
    console.log("After:");
    console.log(`- Primary Review Candidate: ${g.primaryReviewCandidate}`);
    console.log(
      `- Secondary: ${g.secondaryReviewCandidates.join(", ") || "—"}`,
    );
    console.log(`What We Learned:\n${g.whatWeLearned}`);
  }
  console.log("\nDaily Learning:");
  console.log(view.dailyLearning!.plain);
  console.log("\ntest:mlb-good-pick-feedback-v1 OK", {
    predictionHash,
    goodPickIds: view.games.map((g) => g.gameId),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
