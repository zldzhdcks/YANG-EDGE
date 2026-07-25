/**
 * 추천 등급 매핑 스모크 테스트
 * 실행: npx tsx scripts/test-recommendation-grade.ts
 */
import { getRecommendationGrade } from "../src/lib/edge/recommendation-grade";

const cases: Array<{ edge: number; expect: string }> = [
  { edge: 0, expect: "PASS" },
  { edge: 4.9, expect: "PASS" },
  { edge: -4.9, expect: "PASS" },
  { edge: 5, expect: "WATCH" },
  { edge: -7.5, expect: "WATCH" },
  { edge: 9.9, expect: "WATCH" },
  { edge: 10, expect: "EDGE PICK" },
  { edge: -12.5, expect: "EDGE PICK" },
  { edge: 14.9, expect: "EDGE PICK" },
  { edge: 15, expect: "TOP EDGE" },
  { edge: -20, expect: "TOP EDGE" },
  { edge: Number.NaN, expect: "PASS" },
];

function main() {
  console.log("=== getRecommendationGrade ===\n");
  let failed = 0;

  for (const c of cases) {
    const r = getRecommendationGrade(c.edge);
    const ok = r.grade === c.expect;
    if (!ok) failed += 1;
    console.log(
      `${ok ? "OK" : "FAIL"} edge=${String(c.edge).padStart(5)} → ${r.grade.padEnd(10)} | ${r.color.padEnd(8)} | ${r.description}`,
    );
  }

  // 결정성
  const a = getRecommendationGrade(11.2);
  const b = getRecommendationGrade(11.2);
  const deterministic =
    a.grade === b.grade &&
    a.color === b.color &&
    a.description === b.description;
  console.log("\n결정성:", deterministic ? "OK" : "FAIL");

  if (failed > 0 || !deterministic) {
    console.error(`\nFAILED: ${failed} case(s)`);
    process.exit(1);
  }
  console.log("\nALL PASS");
}

main();
