/**
 * Domestic odds OCR extraction v2 tests.
 * No live inbox. No network. Synthetic geometry and OCR passes only.
 *
 *   npm run test:domestic-odds-ocr-extraction-v2
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assembleBoardRow,
  buildMatchupEntities,
  classifyTeamLabel,
  countUniqueMatchups,
  diagnoseV1Lines,
  extractCompactThreeDigitTokens,
  inferColumnBands,
  joinAssembledRowV2,
  parseDateTimeFromText,
  planImageCrops,
  sha256Text,
  canonicalJson,
  verifyOddsFromPasses,
} from "../src/lib/domestic-odds-ocr-extraction-v2";

function gitDiffExitCode(rel: string): number {
  try {
    execFileSync("git", ["diff", "--exit-code", "--", rel], {
      stdio: "pipe",
      encoding: "utf8",
    });
    return 0;
  } catch (err) {
    const e = err as { status?: number };
    return typeof e.status === "number" ? e.status : 1;
  }
}

function line(
  text: string,
  x: number,
  y: number,
  w = 20,
  h = 10,
): {
  text: string;
  boundingBox: { x: number; y: number; width: number; height: number };
} {
  return { text, boundingBox: { x, y, width: w, height: h } };
}

async function main() {
  assert.equal(extractCompactThreeDigitTokens("156")[0], "156");
  const compact = verifyOddsFromPasses([
    { pass: "BASELINE_V1", rawText: "156" },
    { pass: "KO_SCALE3_CROP", rawText: "156" },
  ]);
  assert.equal(compact.verificationStatus, "ODDS_UNREADABLE");
  assert.equal(compact.normalizedCandidate, null);

  const singleSplit = verifyOddsFromPasses([
    { pass: "BASELINE_V1", rawText: "1 56" },
  ]);
  assert.equal(singleSplit.verificationStatus, "ODDS_CANDIDATE_UNVERIFIED");
  assert.equal(singleSplit.normalizedCandidate, null);

  const corroborated = verifyOddsFromPasses([
    { pass: "BASELINE_V1", rawText: "1 56" },
    { pass: "KO_SCALE3_CROP", rawText: "1-56" },
  ]);
  assert.equal(corroborated.verificationStatus, "ODDS_VERIFIED");
  assert.equal(corroborated.normalizedCandidate, 1.56);

  const punct = verifyOddsFromPasses([
    { pass: "BASELINE_V1", rawText: "1.56" },
    { pass: "KO_SCALE3_CROP", rawText: "1 56" },
  ]);
  assert.equal(punct.verificationStatus, "ODDS_VERIFIED");
  assert.equal(punct.normalizedCandidate, 1.56);

  assert.equal(classifyTeamLabel("바르셀로").status, "TEAM_TEXT_PARTIAL");
  assert.equal(classifyTeamLabel("레반테").status, "TEAM_TEXT_VERIFIED");
  assert.equal(classifyTeamLabel("Barcelona").status, "TEAM_TEXT_VERIFIED");

  const partialJoin = joinAssembledRowV2(
    assembleBoardRow({
      operatingDateKst: "2026-09-13",
      sourceFile: "스크린샷 2026-09-13 162248.png",
      sourceSha256: "abc",
      fileMtimeUtc: null,
      operatorObservedAtUtc: "2026-09-13T08:22:37.608Z",
      board: "1506",
      datePasses: [{ pass: "BASELINE_V1", rawText: "09 13(일) 23 15" }],
      teamPasses: [{ pass: "BASELINE_V1", rawText: "라리가 레반테 : 바르셀로" }],
      oddsPasses: [
        { pass: "BASELINE_V1", rawText: "10 00" },
        { pass: "KO_SCALE3_CROP", rawText: "10-00" },
      ],
    }),
    { footballSchedule: null, mlbSchedule: null },
  );
  assert.equal(partialJoin.awayStatus, "TEAM_TEXT_PARTIAL");
  assert.equal(partialJoin.canonicalFixtureId, null);
  assert.equal(partialJoin.predictionInputAllowed, false);

  const excluded = joinAssembledRowV2(
    assembleBoardRow({
      operatingDateKst: "2026-09-13",
      sourceFile: "스크린샷 2026-09-13 162255.png",
      sourceSha256: "abc",
      fileMtimeUtc: null,
      operatorObservedAtUtc: "2026-09-13T08:22:37.608Z",
      board: "1541",
      datePasses: [{ pass: "BASELINE_V1", rawText: "09 14(월) 01 10" }],
      teamPasses: [{ pass: "BASELINE_V1", rawText: "MLB 디트타이 : 콜로밀워" }],
      oddsPasses: [{ pass: "BASELINE_V1", rawText: "1 50" }],
    }),
    { footballSchedule: null, mlbSchedule: null },
  );
  assert.equal(excluded.joinStatus, "EXCLUDED_NON_TARGET_DATE");
  assert.equal(excluded.targetDateKst, "2026-09-14");

  const board1405 = assembleBoardRow({
    operatingDateKst: "2026-09-13",
    sourceFile: "스크린샷 2026-09-13 162226.png",
    sourceSha256: "abc",
    fileMtimeUtc: null,
    operatorObservedAtUtc: "2026-09-13T08:22:37.608Z",
    board: "1405",
    datePasses: [{ pass: "BASELINE_V1", rawText: "09 13(일) 17고0" }],
    teamPasses: [{ pass: "BASELINE_V1", rawText: "KT" }],
    oddsPasses: [{ pass: "BASELINE_V1", rawText: "1 35" }],
  });
  assert.equal(board1405.parsedOddsValues, null);
  assert.notEqual(board1405.oddsFields[0]?.verificationStatus, "ODDS_VERIFIED");
  assert.equal(board1405.predictionInputAllowed, false);

  const clock = parseDateTimeFromText("09 13(일) 18 00", "2026-09-13");
  assert.equal(clock.targetDateKst, "2026-09-13");
  assert.equal(clock.displayedStartKst, "18:00");
  const ambiguous = parseDateTimeFromText("09 13(일) 17고0", "2026-09-13");
  assert.equal(ambiguous.targetDateKst, "2026-09-13");
  assert.equal(ambiguous.displayedStartKst, null);
  assert.equal(ambiguous.clockAmbiguous, true);

  const geo = [
    line("1381", 12, 7, 24, 8),
    line("09 13(일) 17고0", 52, 5, 77, 12),
    line("그 NC", 334, 6, 48, 12),
    line("1 56", 470, 7, 30, 10),
    line("경기전 0", 606, 3, 80, 18),
    line("1382", 12, 36, 24, 8),
    line("09 13(일) 17고0", 52, 34, 77, 12),
  ];
  const planA = planImageCrops({
    sourceFile: "a.png",
    lines: geo,
    imageWidth: 720,
    imageHeight: 900,
  });
  const planB = planImageCrops({
    sourceFile: "a.png",
    lines: geo,
    imageWidth: 720,
    imageHeight: 900,
  });
  assert.equal(sha256Text(canonicalJson(planA)), sha256Text(canonicalJson(planB)));
  assert.equal(planA.cells.length, planB.cells.length);
  assert.deepEqual(planA.cells[0]!.crop, planB.cells[0]!.crop);

  const bands = inferColumnBands(geo, 720);
  assert.equal(bands.BOARD.x0, 0);
  assert.equal(bands.DATE.x0 < bands.TEAM.x0, true);
  assert.equal(bands.TEAM.x0 < bands.ODDS.x0, true);

  const diag = diagnoseV1Lines(geo);
  assert.equal(diag.familyCounts.DECIMAL_SEPARATOR_DROPPED >= 1, true);
  assert.equal(diag.familyCounts.TIME_TEXT_CONFUSION >= 1, true);

  const entities = buildMatchupEntities([
    {
      boardGameNumber: "1381",
      targetDateKst: "2026-09-13",
      competitionRawLabel: "KBO",
      homeRawName: "두산",
      awayRawName: "NC",
      homeStatus: "TEAM_TEXT_VERIFIED",
      awayStatus: "TEAM_TEXT_VERIFIED",
    },
    {
      boardGameNumber: "1382",
      targetDateKst: "2026-09-13",
      competitionRawLabel: "KBO",
      homeRawName: "두산",
      awayRawName: "NC",
      homeStatus: "TEAM_TEXT_VERIFIED",
      awayStatus: "TEAM_TEXT_VERIFIED",
    },
    {
      boardGameNumber: "1405",
      targetDateKst: "2026-09-13",
      competitionRawLabel: "KBO",
      homeRawName: "KT",
      awayRawName: null,
      homeStatus: "TEAM_TEXT_VERIFIED",
      awayStatus: "TEAM_TEXT_UNREADABLE",
    },
  ]);
  const counts = countUniqueMatchups(entities);
  assert.equal(counts.uniqueMatchups, 1);
  assert.equal(entities.some((e) => e.mergeStatus === "UNMERGED_INCOMPLETE"), true);

  const leakedOddsAsAway = buildMatchupEntities([
    {
      boardGameNumber: "1386",
      targetDateKst: "2026-09-13",
      competitionRawLabel: "KBO",
      homeRawName: "NC",
      awayRawName: "2-19",
      homeStatus: "TEAM_TEXT_VERIFIED",
      awayStatus: "TEAM_TEXT_UNREADABLE",
    },
  ]);
  assert.equal(countUniqueMatchups(leakedOddsAsAway).uniqueMatchups, 0);

  const again = verifyOddsFromPasses([
    { pass: "BASELINE_V1", rawText: "1 56" },
    { pass: "KO_SCALE3_CROP", rawText: "1-56" },
  ]);
  assert.equal(sha256Text(canonicalJson(corroborated)), sha256Text(canonicalJson(again)));

  assert.equal(gitDiffExitCode("data/audits/2026-09-13-domestic-odds-structured-v1.json"), 0);
  assert.equal(gitDiffExitCode("data/audits/2026-09-13-domestic-odds-ocr-geometry-v1.json"), 0);

  const lib = path.join(process.cwd(), "src/lib/domestic-odds-ocr-extraction-v2");
  const src = readFileSync(path.join(lib, "odds-verify.ts"), "utf8");
  assert.equal(src.includes("fetch("), false);
  assert.equal(src.includes("https://"), false);

  console.log("test:domestic-odds-ocr-extraction-v2 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
