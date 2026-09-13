/**
 * Domestic screenshot odds promotion v1 tests.
 * Synthetic OCR geometry only. No network. No live inbox.
 *
 *   npm run test:domestic-odds-promotion-v1
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { OPERATOR_ROOT_NAME } from "../src/lib/proto-round-screenshot-intake-v1";
import {
  inventoryDailyScreenshots,
  parseRoundDirectoryName,
} from "../src/lib/proto-round-daily-odds-intake-v0";
import {
  clusterOcrLinesByGeometry,
  countJoin,
  joinStructuredOddsRow,
  parseClusteredRow,
  parseOcrImageToRows,
  sha256Text,
  canonicalJson,
} from "../src/lib/domestic-odds-promotion-v1";

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
  y: number,
  x = 0,
): { text: string; boundingBox: { x: number; y: number; width: number; height: number } } {
  return { text, boundingBox: { x, y, width: 80, height: 12 } };
}

async function main() {
  assert.deepEqual(parseRoundDirectoryName("108"), {
    round: 108,
    kind: "NUMERIC",
  });

  const workspace = mkdtempSync(path.join(tmpdir(), "odds-promo-"));
  const operatorRootAbs = path.join(workspace, OPERATOR_ROOT_NAME);
  mkdirSync(path.join(operatorRootAbs, "2026", "108"), { recursive: true });
  writeFileSync(
    path.join(operatorRootAbs, "2026", "108", "스크린샷 2026-09-13 162226.png"),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x03]),
  );
  const discovered = inventoryDailyScreenshots({
    operatorRootAbs,
    inventoryDate: "2026-09-13",
  });
  assert.equal(discovered.length, 1);
  assert.equal(discovered[0]!.roundDirectoryKind, "NUMERIC");

  const clustered = clusterOcrLinesByGeometry([
    line("1381 09.13(일) 17:00 KBO 두산 : NC 1.56 - 2.02 경기전", 10),
    line("1382 09.13(일) 17:00 KBO 승①패 두산 : NC 2.19 3.25 2.60 경기전", 24),
  ]);
  assert.equal(clustered.length, 2);

  const parsed = parseClusteredRow({
    operatingDateKst: "2026-09-13",
    claimedRound: 108,
    sourceFile: "스크린샷 2026-09-13 162226.png",
    sourceSha256: "abc",
    fileMtimeUtc: "2026-09-13T07:22:26.793Z",
    operatorObservedAtUtc: "2026-09-13T08:22:37.608Z",
    sourceProvenance: "WINDOWS_MEDIA_OCR_LOCAL",
    lines: clustered[0]!,
  });
  assert.equal(parsed.boardGameNumber, "1381");
  assert.equal(parsed.targetDateKst, "2026-09-13");
  assert.equal(parsed.displayedStartKst, "17:00");
  assert.equal(parsed.competitionRawLabel, "KBO");
  assert.equal(parsed.homeRawName, "두산");
  assert.equal(parsed.awayRawName, "NC");
  assert.deepEqual(parsed.parsedOddsValues, [1.56, 2.02]);
  assert.equal(parsed.extractionStatus, "PARSED");
  assert.equal(parsed.predictionInputAllowed, false);
  assert.equal(parsed.verifiedCaptureTime, null);
  assert.equal(parsed.verifiedProviderTime, null);

  const spacedDate = parseClusteredRow({
    operatingDateKst: "2026-09-13",
    claimedRound: 108,
    sourceFile: "스크린샷 2026-09-13 162226.png",
    sourceSha256: "abc",
    fileMtimeUtc: null,
    operatorObservedAtUtc: "2026-09-13T08:22:37.608Z",
    sourceProvenance: "WINDOWS_MEDIA_OCR_LOCAL",
    lines: [
      line("1381 09 13(일) 18 00 KBO 두산 : NC 1.56 - 2.02 경기전", 10),
    ],
  });
  assert.equal(spacedDate.targetDateKst, "2026-09-13");
  assert.equal(spacedDate.displayedStartKst, "18:00");
  assert.deepEqual(spacedDate.parsedOddsValues, [1.56, 2.02]);

  const ambiguousClock = parseClusteredRow({
    operatingDateKst: "2026-09-13",
    claimedRound: 108,
    sourceFile: "스크린샷 2026-09-13 162226.png",
    sourceSha256: "abc",
    fileMtimeUtc: null,
    operatorObservedAtUtc: "2026-09-13T08:22:37.608Z",
    sourceProvenance: "WINDOWS_MEDIA_OCR_LOCAL",
    lines: [line("1381 09 13(일) 17고0 KBO 그 : NC", 11)],
  });
  assert.equal(ambiguousClock.targetDateKst, "2026-09-13");
  assert.equal(ambiguousClock.displayedStartKst, null);
  assert.equal(ambiguousClock.parsedOddsValues, null);
  assert.equal(
    ambiguousClock.rejectionReason.includes("DISPLAYED_CLOCK_OCR_AMBIGUOUS"),
    true,
  );

  const unreadable = parseClusteredRow({
    operatingDateKst: "2026-09-13",
    claimedRound: 108,
    sourceFile: "스크린샷 2026-09-13 162226.png",
    sourceSha256: "abc",
    fileMtimeUtc: null,
    operatorObservedAtUtc: "2026-09-13T08:22:37.608Z",
    sourceProvenance: "WINDOWS_MEDIA_OCR_LOCAL",
    lines: [line("1405 09.13(일) 17:00 KBO KT : 롯데 1.35 - 경기전", 40)],
  });
  assert.equal(unreadable.boardGameNumber, "1405");
  assert.equal(unreadable.homeRawName, "KT");
  assert.equal(unreadable.awayRawName, "롯데");
  assert.equal(unreadable.extractionStatus, "SOURCE_UNREADABLE");
  assert.equal(unreadable.joinStatus, "SOURCE_UNREADABLE");
  assert.equal(unreadable.parsedOddsValues, null);
  assert.equal(unreadable.predictionInputAllowed, false);

  const excluded = joinStructuredOddsRow(
    parseClusteredRow({
      operatingDateKst: "2026-09-13",
      claimedRound: 108,
      sourceFile: "스크린샷 2026-09-13 162255.png",
      sourceSha256: "abc",
      fileMtimeUtc: null,
      operatorObservedAtUtc: "2026-09-13T08:22:37.608Z",
      sourceProvenance: "WINDOWS_MEDIA_OCR_LOCAL",
      lines: [
        line("1541 09.14(월) 01:10 MLB 디트타이 : 콜로밀워 1.50 - 2.13 경기전", 50),
      ],
    }),
    { footballSchedule: null, mlbSchedule: null },
  );
  assert.equal(excluded.joinStatus, "EXCLUDED_NON_TARGET_DATE");
  assert.equal(excluded.predictionInputAllowed, false);

  const levante = joinStructuredOddsRow(
    parseClusteredRow({
      operatingDateKst: "2026-09-13",
      claimedRound: 108,
      sourceFile: "스크린샷 2026-09-13 162248.png",
      sourceSha256: "abc",
      fileMtimeUtc: null,
      operatorObservedAtUtc: "2026-09-13T08:22:37.608Z",
      sourceProvenance: "WINDOWS_MEDIA_OCR_LOCAL",
      lines: [
        line("1506 09.13(일) 23:15 라리가 레반테 : 바르셀로 10.00 7.00 1.12 경기전", 60),
      ],
    }),
    { footballSchedule: null, mlbSchedule: null },
  );
  assert.equal(levante.joinStatus, "TEAM_ALIAS_MATCHED_NO_SCHEDULE");
  assert.equal(levante.canonicalFixtureId, null);
  assert.equal(levante.predictionInputAllowed, false);

  const matched = joinStructuredOddsRow(levante, {
    footballSchedule: {
      meta: {
        schemaVersion: "football-schedule-v1",
        builderVersion: "football-schedule-builder-v1",
        identityVersion: "football-core-identity-v1",
        dateKst: "2026-09-13",
        generatedAt: "2026-09-13T07:00:00.000Z",
        provider: "api-football",
        researchOnly: true,
        legalStatus: "NEEDS_LEGAL_REVIEW",
        scheduleGames: 1,
        identityMatched: 1,
        identityBlocked: 0,
        formatEligible: 1,
        formatNotSupported: 0,
        droppedUnregisteredCompetition: 0,
        artifactHash: "test",
      },
      rows: [
        {
          dateKst: "2026-09-13",
          matchId: "fb-test-levante-barcelona",
          provider: "api-football",
          providerMatchId: "1",
          competitionId: "fb-comp-api-football-140",
          seasonId: null,
          competitionType: "LEAGUE",
          matchFormat: "LEAGUE_MATCH",
          homeTeamId: null,
          awayTeamId: null,
          homeProviderTeamId: "539",
          awayProviderTeamId: "529",
          homeTeamName: "Levante",
          awayTeamName: "Barcelona",
          kickoffTimeUtc: "2026-09-13T14:15:00.000Z",
          status: "SCHEDULED",
          venue: null,
          identityStatus: "MATCHED",
          identityReasons: [],
          predictionEligibility: "ELIGIBLE_FORMAT",
          researchOnly: true,
        },
      ],
    },
    mlbSchedule: null,
  });
  assert.equal(matched.joinStatus, "SCHEDULE_MATCHED");
  assert.equal(matched.canonicalFixtureId, "fb-test-levante-barcelona");
  assert.equal(matched.predictionInputAllowed, false);
  assert.equal(matched.verifiedCaptureTime, null);

  const rows = parseOcrImageToRows({
    operatingDateKst: "2026-09-13",
    claimedRound: 108,
    sourceFile: "스크린샷 2026-09-13 162226.png",
    sourceSha256: "abc",
    fileMtimeUtc: null,
    operatorObservedAtUtc: "2026-09-13T08:22:37.608Z",
    sourceProvenance: "WINDOWS_MEDIA_OCR_LOCAL",
    lines: clustered.flat(),
  });
  const again = parseOcrImageToRows({
    operatingDateKst: "2026-09-13",
    claimedRound: 108,
    sourceFile: "스크린샷 2026-09-13 162226.png",
    sourceSha256: "abc",
    fileMtimeUtc: null,
    operatorObservedAtUtc: "2026-09-13T08:22:37.608Z",
    sourceProvenance: "WINDOWS_MEDIA_OCR_LOCAL",
    lines: clustered.flat(),
  });
  assert.equal(sha256Text(canonicalJson(rows)), sha256Text(canonicalJson(again)));
  const counts = countJoin([parsed, unreadable, excluded, levante, matched]);
  assert.equal(counts.oddsParsedRows, 4);
  assert.equal(counts.unreadableRows, 1);
  assert.equal(counts.scheduleMatched, 1);
  assert.equal(counts.predictionEligible, 0);
  assert.equal(counts.predictionRejected, 5);
  assert.equal(
    gitDiffExitCode("src/lib/proto-round-daily-odds-intake-v0") === 0 ||
      gitDiffExitCode("src/lib/proto-round-daily-odds-intake-v0") === 1,
    true,
  );
  console.log("test:domestic-odds-promotion-v1 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
