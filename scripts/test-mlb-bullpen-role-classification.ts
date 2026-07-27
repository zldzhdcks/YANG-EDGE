/**
 * @deprecated v1 테스트. v1.1은 test-mlb-bullpen-role-classification-v1_1.ts 사용.
 * classify 모듈이 v1.1로 교체되어 호환 smoke만 수행.
 */
import { classifyBullpenPitcher } from "../src/lib/mlb/classify-bullpen-role";
import type { BullpenAppearanceDerived } from "../src/lib/mlb/bullpen-role-types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function app(
  partial: Partial<BullpenAppearanceDerived> &
    Pick<
      BullpenAppearanceDerived,
      "playerId" | "officialDate" | "gamePk" | "pitcherSlotIndex"
    >,
): BullpenAppearanceDerived {
  return {
    playerName: "Test",
    teamId: 1,
    gameDate: `${partial.officialDate}T00:00:00.000Z`,
    outs: 3,
    earnedRuns: 0,
    hits: 1,
    walks: 0,
    strikeouts: 1,
    homeRuns: 0,
    pitches: 15,
    battersFaced: 4,
    saves: 0,
    holds: 0,
    blownSaves: 0,
    wasLastPitcher: false,
    entryInning: null,
    entryScoreDiff: null,
    fromTargetGame: false,
    ...partial,
  };
}

function main() {
  console.log("=== test-mlb-bullpen-role-classification (v1 smoke → v1.1) ===");
  const thin = classifyBullpenPitcher({
    playerId: 1,
    playerName: "Thin",
    teamId: 1,
    teamName: "A",
    cutoffTime: "2026-07-26T17:00:00.000Z",
    officialDate: "2026-07-26",
    appearances: [
      app({
        playerId: 1,
        officialDate: "2026-07-24",
        gamePk: 1,
        pitcherSlotIndex: 1,
      }),
    ],
  });
  assert(thin.engineEligible === false, "engineEligible");
  assert(thin.classificationStatus === "INSUFFICIENT_SAMPLE", "insufficient");
  assert(thin.primaryRole === "UNKNOWN", "unknown");
  console.log("ALL PASSED (smoke)");
}

main();
