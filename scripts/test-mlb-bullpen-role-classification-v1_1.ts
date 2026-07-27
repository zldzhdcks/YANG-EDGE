/**
 * Bullpen Role Classifier v1.1 단위 테스트 (네트워크 없음).
 *
 * 실행:
 *   npx tsx scripts/test-mlb-bullpen-role-classification-v1_1.ts
 */
import {
  TRADITIONAL_STARTER_MIN_OUTS,
} from "../src/lib/mlb/bullpen-role-constants";
import {
  buildRoleEvidence,
  classifyBullpenPitcher,
  isOpenerSlotAppearance,
  isTraditionalStarterAppearance,
  partitionAppearances,
} from "../src/lib/mlb/classify-bullpen-role";
import type { BullpenAppearanceDerived } from "../src/lib/mlb/bullpen-role-types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function app(
  partial: Partial<BullpenAppearanceDerived> &
    Pick<
      BullpenAppearanceDerived,
      "playerId" | "officialDate" | "gamePk" | "pitcherSlotIndex" | "outs"
    >,
): BullpenAppearanceDerived {
  return {
    playerName: "T",
    teamId: 1,
    gameDate: `${partial.officialDate}T00:00:00.000Z`,
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
    entryInning: 6,
    entryScoreDiff: 1,
    fromTargetGame: false,
    ...partial,
  };
}

function main() {
  console.log("=== test-mlb-bullpen-role-classification-v1_1 ===");

  // starter exclusion
  const starter = app({
    playerId: 1,
    officialDate: "2026-07-20",
    gamePk: 1,
    pitcherSlotIndex: 0,
    outs: TRADITIONAL_STARTER_MIN_OUTS,
  });
  const opener = app({
    playerId: 1,
    officialDate: "2026-07-21",
    gamePk: 2,
    pitcherSlotIndex: 0,
    outs: 5,
  });
  const relief = app({
    playerId: 1,
    officialDate: "2026-07-22",
    gamePk: 3,
    pitcherSlotIndex: 1,
    outs: 3,
  });
  assert(isTraditionalStarterAppearance(starter), "traditional starter");
  assert(isOpenerSlotAppearance(opener), "opener kept");
  const part = partitionAppearances([starter, opener, relief]);
  assert(part.traditionalStarterExcluded.length === 1, "exclude starter");
  assert(part.opener.length === 1, "keep opener");
  assert(part.relief.length === 1, "relief");

  const ev = buildRoleEvidence([starter, opener, relief]);
  assert(ev.traditionalStarterExcluded === 1, "excluded count");
  assert(ev.avgOuts === 3, `avgOuts relief-only got ${ev.avgOuts}`);

  // insufficient sample
  const thin = classifyBullpenPitcher({
    playerId: 2,
    playerName: "Thin",
    teamId: 1,
    teamName: "A",
    cutoffTime: "2026-07-26T17:00:00.000Z",
    officialDate: "2026-07-26",
    appearances: [
      app({
        playerId: 2,
        officialDate: "2026-07-24",
        gamePk: 10,
        pitcherSlotIndex: 1,
        outs: 6,
      }),
      app({
        playerId: 2,
        officialDate: "2026-07-25",
        gamePk: 11,
        pitcherSlotIndex: 1,
        outs: 6,
      }),
    ],
  });
  assert(thin.classificationStatus === "INSUFFICIENT_SAMPLE", "status");
  assert(thin.primaryRole === "UNKNOWN", "force unknown");
  assert(thin.primaryRole !== "LONG_RELIEF", "no long under 3");

  // closer with sample
  const closerApps = [20, 21, 22, 23, 24, 25].map((d, i) =>
    app({
      playerId: 3,
      officialDate: `2026-07-${d}`,
      gamePk: 100 + i,
      pitcherSlotIndex: 3,
      outs: 3,
      saves: 1,
      wasLastPitcher: true,
      entryInning: 9,
      entryScoreDiff: 2,
    }),
  );
  const closer = classifyBullpenPitcher({
    playerId: 3,
    playerName: "C",
    teamId: 1,
    teamName: "A",
    cutoffTime: "2026-07-26T17:00:00.000Z",
    officialDate: "2026-07-26",
    appearances: closerApps,
  });
  assert(closer.primaryRole === "CLOSER", `closer got ${closer.primaryRole}`);
  assert(closer.classificationStatus === "CLASSIFIED", "classified");
  assert(closer.engineEligible === false, "engine false");
  assert(Array.isArray(closer.secondaryRoles), "secondary array");
  assert(typeof closer.roleScores === "object", "roleScores");

  // long needs multi factors + sample
  const longApps = [10, 11, 12, 13, 14, 15].map((d, i) =>
    app({
      playerId: 4,
      officialDate: `2026-07-${d}`,
      gamePk: 200 + i,
      pitcherSlotIndex: 1,
      outs: 6,
      entryInning: 3,
      entryScoreDiff: 5,
    }),
  );
  const longP = classifyBullpenPitcher({
    playerId: 4,
    playerName: "L",
    teamId: 1,
    teamName: "A",
    cutoffTime: "2026-07-26T17:00:00.000Z",
    officialDate: "2026-07-26",
    appearances: longApps,
  });
  assert(
    longP.sampleSize >= 6,
    "long sample",
  );
  // may be LONG or MOP depending on scores — must not be insufficient
  assert(longP.classificationStatus === "CLASSIFIED", "long status");
  assert(longP.sampleSize >= 3 || longP.primaryRole !== "LONG_RELIEF", "guard");

  console.log("ALL PASSED");
}

main();
