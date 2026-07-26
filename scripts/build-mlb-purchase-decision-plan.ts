/**
 * 2026-07-28 KST MLB 전체 경기 — 한국 구매 가능 시간 기준 분석·재확인·결정 계획.
 *
 * 시간 계획만 생성. 추천·배당·Engine·Watchlist·스냅샷 미변경.
 * 공식 판매 마감은 임의 생성하지 않는다.
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/build-mlb-purchase-decision-plan.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertPurchasePlanInvariants,
  buildPurchaseDecisionPlan,
  runPurchasePlanSelfCheck,
} from "../src/lib/betting/build-purchase-decision-plan";
import {
  formatKstDateTime,
  PURCHASE_WINDOW_CLOSE_KST,
  PURCHASE_WINDOW_OPEN_KST,
} from "../src/lib/betting/purchase-window";
import { getMlbGamesForDate } from "../src/lib/games/mlb-games";

const TARGET_DATE_KST = "2026-07-28";
const OUTPUT_PATH = path.join(
  process.cwd(),
  "data",
  "plans",
  `${TARGET_DATE_KST}-mlb-purchase-plan.json`,
);

async function main() {
  console.log(`=== MLB Purchase Decision Plan (${TARGET_DATE_KST} KST) ===`);
  console.log(
    `구매 창 ${PURCHASE_WINDOW_OPEN_KST}~${PURCHASE_WINDOW_CLOSE_KST} KST. Engine·추천·배당 미변경.\n`,
  );

  const selfCheckErrors = runPurchasePlanSelfCheck(TARGET_DATE_KST);
  if (selfCheckErrors.length > 0) {
    throw new Error(`셀프체크 실패:\n${selfCheckErrors.join("\n")}`);
  }
  console.log("셀프체크: 01:15/03:10/08:20/10:00 통과");

  const mlb = await getMlbGamesForDate(TARGET_DATE_KST);
  const nowMs = Date.now();

  const buildOnce = () =>
    buildPurchaseDecisionPlan({
      targetDateKst: TARGET_DATE_KST,
      games: mlb.games,
      nowMs,
    });

  const first = buildOnce();
  const second = buildOnce();
  const fingerprint = (plan: typeof first) =>
    JSON.stringify(
      plan.games.map((g) => ({
        gameId: g.gameId,
        bucket: g.bucket,
        initial: g.recommendedInitialAnalysisKst,
        odds: g.recommendedOddsRefreshKst,
        final: g.recommendedFinalDecisionKst,
        next: g.nextAction,
        nextAt: g.nextActionAtKst,
        warnings: g.warnings,
      })),
    );
  const deterministic = fingerprint(first) === fingerprint(second);

  const invariantErrors = assertPurchasePlanInvariants(first);
  if (invariantErrors.length > 0) {
    throw new Error(`불변조건 실패:\n${invariantErrors.join("\n")}`);
  }

  const output = {
    meta: {
      version: "mlb-purchase-decision-plan-v1",
      generatedAt: new Date(nowMs).toISOString(),
      generatedAtKst: formatKstDateTime(nowMs),
      targetDateKst: TARGET_DATE_KST,
      kind: "purchase-decision-plan",
      timeZone: "Asia/Seoul",
      engineRerun: false,
      oddsRefetched: false,
      watchlistChanged: false,
      predictionSnapshotSaved: false,
      officialSalesCloseInvented: false,
      purchaseWindow: {
        openKst: PURCHASE_WINDOW_OPEN_KST,
        closeKst: PURCHASE_WINDOW_CLOSE_KST,
      },
      deterministic,
      note:
        "시간 계획만. 추천·배당·Engine 결과와 무관. 공식 회차별 발매 마감은 미연결(null).",
    },
    apiUsage: {
      apiBaseball: {
        cached: mlb.cached,
        fetchedAt: mlb.fetchedAt,
        requestsRemaining: mlb.usage.requestsRemaining,
        requestsLimit: mlb.usage.requestsLimit,
        leagueId: mlb.leagueId,
        season: mlb.season,
        gamesReturned: mlb.games.length,
      },
    },
    summary: first.summary,
    games: first.games.map((g) => ({
      gameId: g.gameId,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      gameStartKst: g.gameStartKst,
      purchaseWindowOpenKst: g.purchaseWindowOpenKst,
      purchaseWindowCloseKst: g.purchaseWindowCloseKst,
      officialSalesCloseKst: g.officialSalesCloseKst,
      officialCloseVerified: g.officialCloseVerified,
      lastPossiblePurchaseTimeKst: g.lastPossiblePurchaseTimeKst,
      recommendedInitialAnalysisKst: g.recommendedInitialAnalysisKst,
      recommendedOddsRefreshKst: g.recommendedOddsRefreshKst,
      recommendedFinalDecisionKst: g.recommendedFinalDecisionKst,
      recommendedFinalDataFetchKst: g.recommendedFinalDataFetchKst,
      conditionalMorningRecheckKst: g.conditionalMorningRecheckKst,
      bucket: g.bucket,
      nextAction: g.nextAction,
      nextActionAtKst: g.nextActionAtKst,
      researchOnly: g.researchOnly,
      warnings: g.warnings,
      notes: g.notes,
    })),
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  const s = first.summary;
  console.log(`전체 경기: ${s.totalGames}`);
  console.log(`전날 결정 필요: ${s.previousDayDecisionRequired}`);
  console.log(`당일 결정 가능: ${s.sameDayDecisionAvailable}`);
  console.log(`오전 좁은 창: ${s.conditionalMorningWindow}`);
  console.log(`구매 창 없음(경과): ${s.noPurchaseWindow}`);
  console.log(`놓친 단계 있는 경기: ${s.missedAny}`);
  console.log(`공식 마감 미확인: ${s.officialCloseUnverified}/${s.totalGames}`);
  if (s.nextAction) {
    console.log(
      `다음 행동: ${s.nextAction.action} @ ${s.nextAction.atKst} (${s.nextAction.match})`,
    );
  } else {
    console.log("다음 행동: 없음");
  }
  console.log("");
  for (const g of first.games) {
    console.log(
      `${g.awayTeam} @ ${g.homeTeam} | ${g.gameStartKst} | ${g.bucket} | 판단마감 ${g.recommendedFinalDecisionKst}`,
    );
  }
  console.log(`\n결정성: ${deterministic ? "동일" : "불일치"}`);
  console.log(
    `API-BASEBALL: cached=${mlb.cached} remaining=${mlb.usage.requestsRemaining ?? "n/a"}`,
  );
  console.log(`저장: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("FAILED:", message.replace(/apiKey=[^&\s]+/gi, "apiKey=***"));
  process.exitCode = 1;
});
