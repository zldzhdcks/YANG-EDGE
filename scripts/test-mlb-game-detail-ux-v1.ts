/**
 * MLB Game Detail UX v1
 * Run: npx tsx scripts/test-mlb-game-detail-ux-v1.ts
 * Read-only — prediction file must not change.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { loadMlbGameDetailUxV1 } from "../src/lib/mlb/game-detail-ux-v1";
import { loadMlbResearchUxV1 } from "../src/lib/mlb/research-ux-v1";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  const dateKst = "2026-08-06";
  const predPath = `data/predictions/mlb/${dateKst}.json`;
  const before = sha256File(predPath);
  const beforeMtime = statSync(predPath).mtimeMs;
  const predHash = JSON.parse(readFileSync(predPath, "utf8")).meta
    .predictionHashSha256 as string;

  const list = await loadMlbResearchUxV1({ dateKst });
  assert.equal(list.cards.length, 15);
  for (const c of list.cards) {
    assert.ok(c.gamePk != null, `missing gamePk on ${c.gameId}`);
    const detail = await loadMlbGameDetailUxV1({
      dateKst,
      gamePk: c.gamePk!,
    });
    assert.equal(detail.loaded, true, `detail failed for ${c.gamePk}: ${detail.error}`);
    assert.ok(detail.headline.awayTeam);
    assert.ok(detail.headline.homeTeam);
  }

  // Houston Astros vs Toronto Blue Jays (failure)
  const hou = await loadMlbGameDetailUxV1({ dateKst, gamePk: 824158 });
  assert.equal(hou.loaded, true);
  assert.equal(hou.headline.researchPredictionTeam, "Houston Astros");
  assert.equal(hou.headline.modelProbabilityPercent, 55.218);
  assert.ok(hou.headline.marketProbabilityPercent != null);
  assert.ok(
    hou.headline.officialStatus === "RESEARCH_ONLY" ||
      hou.headline.officialStatus === "PASS",
  );
  assert.match(hou.headline.officialStatusPlain, /RESEARCH_ONLY|공식/);
  assert.ok(hou.postgame);
  assert.equal(hou.postgame!.researchGrade, "INCORRECT");
  assert.equal(hou.postgame!.actualWinnerTeam, "Toronto Blue Jays");
  assert.match(hou.postgame!.scoreLine, /Toronto/);
  assert.match(hou.postgame!.scoreLine, /Houston/);
  assert.equal(hou.dataQuality.overall, "LIMITED_INPUT");
  assert.ok(
    hou.dataQuality.advancedCodes.includes("LINEUP_NOT_CONFIRMED"),
  );
  assert.ok(
    hou.dataQuality.advancedCodes.includes("BULLPEN_WEIGHT_DISABLED_V0"),
  );
  assert.ok(hou.postgame!.primaryCandidates.length >= 1);
  assert.match(hou.postgame!.primaryCandidates[0]!.plain, /복기 후보/);
  assert.doesNotMatch(
    hou.postgame!.primaryCandidates[0]!.plain,
    /패배 원인은/,
  );
  assert.match(hou.modelVsMarket.narrative, /시장보다|가격 매력/);

  // Boston Red Sox vs Chicago White Sox (success)
  const bos = await loadMlbGameDetailUxV1({ dateKst, gamePk: 824728 });
  assert.equal(bos.loaded, true);
  assert.equal(bos.headline.researchPredictionTeam, "Boston Red Sox");
  assert.ok(bos.postgame);
  assert.equal(bos.postgame!.researchGrade, "CORRECT");
  assert.equal(bos.postgame!.actualWinnerTeam, "Boston Red Sox");
  assert.match(bos.postgame!.scoreLine, /Boston/);
  assert.match(bos.postgame!.scoreLine, /4/);
  assert.ok(bos.postgame!.reviewSummary.length > 10);

  // Invalid gamePk
  const bad = await loadMlbGameDetailUxV1({ dateKst, gamePk: 999999999 });
  assert.equal(bad.loaded, false);
  assert.ok(bad.error);

  assert.equal(sha256File(predPath), before);
  assert.equal(statSync(predPath).mtimeMs, beforeMtime);
  assert.equal(hou.advanced.predictionHash, predHash);

  console.log("test:mlb-game-detail-ux-v1 OK", {
    games: 15,
    hou: hou.headline.matchupLine,
    bos: bos.headline.matchupLine,
    predictionHash: predHash,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
