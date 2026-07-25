/**
 * 시장 확률 / Value Edge 계층 스모크 테스트
 *
 * 실행: npx tsx scripts/test-market-comparison.ts
 *
 * EDGE Engine·OddsProvider 를 호출하지 않는다 — 순수 계산만 검증.
 */
import {
  buildMarketComparison,
  calculateImpliedProbabilities,
  removeBookmakerMargin,
} from "../src/lib/market";

function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

function pp(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}pp`;
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

function printComparison(
  label: string,
  odds: {
    homeOdds: number | null;
    awayOdds: number | null;
    drawOdds?: number | null;
  },
  model?: {
    pickTeamId: "home" | "away";
    winProbability: number;
    marketSupport?: "two-way" | "three-way";
  } | null,
  marketType?: "two-way" | "three-way",
) {
  const comparison = buildMarketComparison({
    odds,
    model: model ?? null,
    marketType,
  });

  console.log(`\n--- ${label} ---`);
  console.log(
    "원 배당:",
    `홈 ${odds.homeOdds ?? "—"}` +
      (odds.drawOdds != null ? ` / 무 ${odds.drawOdds}` : "") +
      ` / 원정 ${odds.awayOdds ?? "—"}`,
  );

  const raw = comparison.rawProbabilities;
  const rawSum =
    [raw.home, raw.away, raw.draw]
      .filter((x): x is number => x != null)
      .reduce((a, b) => a + b, 0) || null;

  console.log(
    "raw 확률:",
    `홈 ${pct(raw.home)}` +
      (raw.draw != null ? ` / 무 ${pct(raw.draw)}` : "") +
      ` / 원정 ${pct(raw.away)}` +
      ` | 합계 ${pct(rawSum)}`,
  );
  console.log("overround:", comparison.overround != null ? pct(comparison.overround) : "—");

  const norm = comparison.normalizedProbabilities;
  console.log(
    "정규화 시장:",
    `홈 ${pct(norm.home)}` +
      (norm.draw != null ? ` / 무 ${pct(norm.draw)}` : "") +
      ` / 원정 ${pct(norm.away)}`,
  );
  console.log(
    "모델 확률:",
    comparison.modelProbability != null
      ? pct(comparison.modelProbability)
      : "—",
  );
  console.log(
    "비교 시장 확률:",
    comparison.marketProbability != null
      ? pct(comparison.marketProbability)
      : "—",
  );
  console.log("Value Edge:", pp(comparison.valueEdgePercentagePoints));
  console.log(
    "비교 가능:",
    comparison.comparable ? "YES" : "NO",
    `| quality=${comparison.dataQuality}`,
  );
  console.log("상태:", comparison.statusMessage);

  return comparison;
}

function main() {
  section("1) 야구 2-way — 비교 가능");
  const baseball = printComparison(
    "KBO Doosan vs Samsung (모델: 홈 58%)",
    { homeOdds: 2.2, awayOdds: 1.76 },
    { pickTeamId: "home", winProbability: 58, marketSupport: "two-way" },
    "two-way",
  );

  section("2) 야구 2-way — 원정 pick + 양의 Value Edge");
  printComparison(
    "NPB (모델: 원정 62%)",
    { homeOdds: 4.2, awayOdds: 1.4 },
    { pickTeamId: "away", winProbability: 62, marketSupport: "two-way" },
    "two-way",
  );

  section("3) 축구 3-way — 시장만 준비, 모델 비교 안 함");
  printComparison(
    "K리그1 (모델 승률만 있음)",
    { homeOdds: 2.1, drawOdds: 3.35, awayOdds: 3.2 },
    { pickTeamId: "home", winProbability: 55, marketSupport: "two-way" },
    "three-way",
  );

  section("4) 불완전 배당");
  printComparison(
    "홈만 있음",
    { homeOdds: 2.0, awayOdds: null },
    { pickTeamId: "home", winProbability: 55 },
    "two-way",
  );

  section("5) 배당 없음");
  printComparison(
    "no odds",
    { homeOdds: null, awayOdds: null },
    null,
    "two-way",
  );

  section("6) NaN / 잘못된 배당 방어");
  printComparison(
    "NaN odds",
    { homeOdds: Number.NaN, awayOdds: 1.9 },
    { pickTeamId: "home", winProbability: 50 },
    "two-way",
  );

  section("7) 결정성 (동일 입력 → 동일 결과)");
  const again = buildMarketComparison({
    odds: { homeOdds: 2.2, awayOdds: 1.76 },
    model: {
      pickTeamId: "home",
      winProbability: 58,
      marketSupport: "two-way",
    },
    marketType: "two-way",
  });
  const same = JSON.stringify(baseball) === JSON.stringify(again);
  console.log("deterministic:", same ? "OK" : "FAIL");

  section("8) 단위 검산 (2.2 / 1.76)");
  const implied = calculateImpliedProbabilities({
    homeOdds: 2.2,
    awayOdds: 1.76,
  });
  const margin = removeBookmakerMargin(implied);
  console.log("raw sum:", implied.sum);
  console.log("overround:", margin.overround);
  console.log("normalized home+away:", (margin.normalized.home ?? 0) + (margin.normalized.away ?? 0));

  if (!same) process.exitCode = 1;
  if (!baseball.comparable || baseball.dataQuality !== "complete") {
    console.error("FAIL: baseball case should be comparable");
    process.exitCode = 1;
  }
}

main();
