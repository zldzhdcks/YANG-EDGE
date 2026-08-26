/**
 * Public Analysis UX v0.1B — daily artifact wiring + user analysis view.
 * Read-only. No provider / engine / prediction writes.
 * Run: npm run test:public-analysis-ux-v0-1b
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadFrozenBaseballSlate } from "../src/lib/baseball/load-frozen-baseball-slate";
import { publicCopyForCState } from "../src/lib/public-analysis/c-state-display";
import { collectCandidateGameIds } from "../src/lib/public-analysis/game-id-resolver";
import { loadDailyCArtifact } from "../src/lib/public-analysis/load-daily-c-artifact";
import { loadPublicGameAnalysis } from "../src/lib/public-analysis/load-public-game-analysis";
import {
  PUBLIC_FORBIDDEN_COPY,
  visiblePublicAnalysisCopy,
} from "../src/lib/public-analysis/visible-copy";

const ROOT = process.cwd();
const DATE = "2026-08-26";
const KBO_OWNER_ID = "kbo-ssg-landers-hanwha-eagles";

function readSrc(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function assertNoForbidden(label: string, text: string) {
  for (const forbidden of PUBLIC_FORBIDDEN_COPY) {
    assert.equal(
      text.includes(forbidden),
      false,
      `${label} must not contain ${forbidden}`,
    );
  }
}

function listPublicComponentFiles(): string[] {
  return [
    "src/app/analysis/[gameId]/page.tsx",
    "src/components/analysis/public/PublicAnalysisViewer.tsx",
    "src/components/analysis/public/PublicAnalysisHeader.tsx",
    "src/components/analysis/public/PublicAnalysisDecision.tsx",
    "src/components/analysis/public/PublicKeyPoints.tsx",
    "src/components/analysis/public/PublicRecentForm.tsx",
    "src/components/analysis/public/PublicLineup.tsx",
    "src/components/analysis/public/PublicAvailability.tsx",
    "src/components/analysis/public/PublicCoachTactics.tsx",
    "src/components/analysis/public/PublicTeamMetrics.tsx",
    "src/components/analysis/public/PublicMarketBenchmark.tsx",
    "src/components/analysis/public/PublicAnalysisFooter.tsx",
  ];
}

async function main() {
  const publicPage = readSrc("src/app/analysis/[gameId]/page.tsx");
  assert.match(publicPage, /PublicAnalysisViewer/);
  assert.equal(publicPage.includes("ResearchAnalysisViewer"), false);
  assert.equal(publicPage.includes("SampleAnalysisNotice"), false);
  assert.equal(publicPage.includes("loadResearchAnalysisView"), false);

  const internalPage = readSrc("src/app/internal/research/game/[gameId]/page.tsx");
  assert.ok(existsSync(path.join(ROOT, "src/app/internal/research/game/[gameId]/page.tsx")));
  assert.match(internalPage, /ResearchAnalysisViewer/);
  assert.match(internalPage, /loadResearchAnalysisView/);
  assert.match(internalPage, /OsShell/);
  assert.match(internalPage, /경기 연구 상세/);

  const artifact = await loadDailyCArtifact({ dateKst: DATE });
  assert.ok(artifact, "2026-08-26 C artifact must load");
  assert.equal(artifact.predictionCount, 0);
  assert.equal(artifact.passCount, 26);
  assert.equal(artifact.providerLiveCalls, 0);
  assert.equal(artifact.games.length, 26);

  const kbo = await loadPublicGameAnalysis({
    publicGameId: KBO_OWNER_ID,
    fromDate: DATE,
  });
  assert.equal(kbo.resolution.matched, true);
  assert.equal(kbo.resolution.source, "daily-c");
  assert.equal(kbo.resolution.operatorGameId, "KBO|2026-08-26|18:30|KBO|SSG|한화");
  assert.equal(kbo.view.game.league, "KBO");
  assert.equal(kbo.view.game.homeTeam, "SSG");
  assert.equal(kbo.view.game.awayTeam, "한화");
  assert.equal(kbo.view.game.startTimeKst, "18:30");
  assert.equal(kbo.view.analysis.headline, "공식 승패 분석 보류");
  assert.match(
    kbo.view.analysis.description,
    /현재 검증을 마친 확률 모델이 없어 승패 확률은 제공하지 않습니다/,
  );
  assert.equal(kbo.view.analysis.officialPredictionAvailable, false);
  assert.equal(kbo.view.analysis.probability, null);
  assert.equal(kbo.view.analysis.confidence, null);
  assert.ok(kbo.view.context.recentForm);
  assert.match(kbo.view.context.recentForm!.home.summary, /최근 5경기/);
  assert.ok(kbo.view.market);
  assert.equal(kbo.view.market!.sourceType, "해외 시장");
  assert.equal(kbo.view.market!.marketBenchmarkOnly, true);
  assert.equal(kbo.view.market!.homeOdds, 2.57);
  assert.equal(kbo.view.market!.awayOdds, 1.57);
  assert.match(kbo.view.market!.referenceNote, /독립 분석 입력에는 사용하지 않습니다/);
  assert.equal(kbo.view.context.lineup, null);
  assert.equal(kbo.view.context.injuries, null);
  assert.equal(kbo.view.analysis.headline.includes(KBO_OWNER_ID), false);

  const frozen = await loadFrozenBaseballSlate({ dateKst: DATE, league: "NPB" });
  assert.ok(frozen.npb.length > 0, "frozen NPB slate must exist");
  const npbSample = frozen.npb[0];
  const npb = await loadPublicGameAnalysis({
    publicGameId: npbSample.gameId,
    fromDate: DATE,
  });
  assert.equal(npb.resolution.matched, true, `NPB id ${npbSample.gameId} must resolve`);
  assert.equal(npb.resolution.source, "daily-c");
  assert.equal(npb.view.game.league, "NPB");
  assert.equal(npb.view.analysis.headline, "공식 승패 분석 보류");
  assert.equal(npb.view.analysis.probability, null);
  assert.equal(npb.view.context.recentForm, null);
  assert.ok(npb.view.market);
  assert.equal(npb.view.market!.marketBenchmarkOnly, true);

  const wrong = await loadPublicGameAnalysis({
    publicGameId: "kbo-ssg-landers-nc-dinos",
    fromDate: DATE,
  });
  assert.equal(wrong.resolution.matched, false);
  assert.equal(wrong.view.analysis.headline, "경기 분석 정보를 준비하고 있습니다.");
  assert.equal(wrong.view.analysis.probability, null);

  assert.equal(publicCopyForCState("PREDICTION").headline, "YANG EDGE 분석");
  assert.equal(publicCopyForCState("PASS_ENGINE_NOT_APPROVED").headline, "공식 승패 분석 보류");
  assert.equal(publicCopyForCState("PASS_IDENTITY_REVIEW_REQUIRED").headline, "경기 분석 준비 중");
  assert.equal(publicCopyForCState("PASS_PROVIDER_NOT_SUPPORTED").headline, "현재 분석 준비 중");
  assert.equal(publicCopyForCState("PASS_MISSED_PRE_GAME_WINDOW").headline, "사전 분석 미제공");

  const identityRow = artifact.games.find(
    (g) => g.cState === "PASS_IDENTITY_REVIEW_REQUIRED",
  );
  assert.ok(identityRow);
  const identityIds = [...collectCandidateGameIds(identityRow)];
  const identityPublicId = identityIds.find((id) => !id.includes("|"));
  assert.ok(identityPublicId);
  const identityView = await loadPublicGameAnalysis({
    publicGameId: identityPublicId,
    fromDate: DATE,
  });
  assert.equal(identityView.view.analysis.headline, "경기 분석 준비 중");

  const unsupported = artifact.games.find(
    (g) => g.cState === "PASS_PROVIDER_NOT_SUPPORTED",
  );
  assert.ok(unsupported);
  const unsupportedId = [...collectCandidateGameIds(unsupported)].find(
    (id) => !id.includes("|"),
  );
  assert.ok(unsupportedId);
  const unsupportedView = await loadPublicGameAnalysis({
    publicGameId: unsupportedId,
    fromDate: DATE,
  });
  assert.equal(unsupportedView.view.analysis.headline, "현재 분석 준비 중");

  const missed = artifact.games.find(
    (g) => g.cState === "PASS_MISSED_PRE_GAME_WINDOW",
  );
  assert.ok(missed);
  const missedId = [...collectCandidateGameIds(missed)].find((id) => !id.includes("|"));
  assert.ok(missedId);
  const missedView = await loadPublicGameAnalysis({
    publicGameId: missedId,
    fromDate: DATE,
  });
  assert.equal(missedView.view.analysis.headline, "사전 분석 미제공");

  const missedEncoded = await loadPublicGameAnalysis({
    publicGameId: encodeURIComponent(missedId),
    fromDate: DATE,
  });
  assert.equal(missedEncoded.resolution.matched, true);
  assert.equal(missedEncoded.view.analysis.headline, "사전 분석 미제공");

  const baseballMarket = artifact.games.filter(
    (g) =>
      (g.sport === "KBO" || g.sport === "NPB") &&
      g.marketBenchmark.attached &&
      g.marketBenchmark.marketBenchmarkOnly,
  );
  assert.equal(baseballMarket.length, 11);

  for (const view of [kbo.view, npb.view, wrong.view, identityView.view, missedView.view]) {
    const copy = visiblePublicAnalysisCopy(view);
    assertNoForbidden(`view ${view.game.gameId}`, copy);
    assert.equal(copy.includes("YANG EDGE 우세"), false);
    assert.equal(view.analysis.probability, null);
  }

  for (const rel of listPublicComponentFiles()) {
    assertNoForbidden(rel, readSrc(rel));
    assert.equal(readSrc(rel).includes("ResearchAnalysisViewer"), false);
  }

  const loaderSrc = readSrc("src/lib/public-analysis/load-public-game-analysis.ts");
  assert.match(loaderSrc, /No provider\/network calls/);
  assert.equal(loaderSrc.includes("getOdds("), false);
  assert.equal(loaderSrc.includes("fetch("), false);

  const resolverSrc = readSrc("src/lib/public-analysis/game-id-resolver.ts");
  assert.match(resolverSrc, /No fuzzy/);
  assert.equal(resolverSrc.includes("includes(nb)"), false);
  assert.equal(resolverSrc.includes("Levenshtein"), false);

  console.log("test:public-analysis-ux-v0-1b OK", {
    kbo: KBO_OWNER_ID,
    kboOperator: kbo.resolution.operatorGameId,
    npb: npbSample.gameId,
    npbOperator: npb.resolution.operatorGameId,
    footballMissed: missedId,
    predictionCount: artifact.predictionCount,
    baseballMarket: baseballMarket.length,
    providerCalls: 0,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
