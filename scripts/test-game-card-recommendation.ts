/**
 * GameCard 추천 등급 표시 결정 테스트
 * 실행: npx tsx scripts/test-game-card-recommendation.ts
 */
import { resolveGameCardRecommendation } from "../src/lib/games/attach-recommendation-grades";

function assert(
  cond: boolean,
  label: string,
  detail?: string,
): void {
  if (cond) {
    console.log(`OK  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
    throw new Error(label);
  }
}

function main() {
  console.log("=== GameCard 추천 등급 ===\n");

  const pass = resolveGameCardRecommendation(true, 3);
  assert(pass?.grade === "PASS" && pass.color === "zinc", "PASS 경기");

  const watch = resolveGameCardRecommendation(true, 7);
  assert(watch?.grade === "WATCH" && watch.color === "blue", "WATCH 경기");

  const edgePick = resolveGameCardRecommendation(true, 12);
  assert(
    edgePick?.grade === "EDGE PICK" && edgePick.color === "emerald",
    "EDGE PICK 경기",
  );

  const top = resolveGameCardRecommendation(true, 18);
  assert(top?.grade === "TOP EDGE" && top.color === "amber", "TOP EDGE 경기");

  const none = resolveGameCardRecommendation(false, 18);
  assert(none === null, "분석 데이터 없는 경기", "배지 미표시");

  const noneScore = resolveGameCardRecommendation(true, null);
  assert(noneScore === null, "edgeScore 없음", "배지 미표시");

  const neg = resolveGameCardRecommendation(true, -12.5);
  assert(
    neg?.grade === "EDGE PICK" && neg.color === "emerald",
    "음수 EDGE",
    "|EDGE| 기준",
  );

  const a = resolveGameCardRecommendation(true, -7.5);
  const b = resolveGameCardRecommendation(true, -7.5);
  assert(
    a?.grade === b?.grade && a?.color === b?.color,
    "동일 입력 → 동일 결과",
  );

  // description 필드는 카드 결정에 포함하지 않음
  assert(
    a != null && !("description" in a),
    "설명 문구 미포함",
  );

  console.log("\nALL PASS");
}

main();
