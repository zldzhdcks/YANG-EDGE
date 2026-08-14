/**
 * MLB 2026-08-15 operator observation intake tests.
 * Run: npm run test:mlb-2026-08-15-operator-observations-intake-v0
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalDomesticTeam } from "../src/lib/mlb/domestic-markets-v1";
import {
  ADMIN_ROWS_2026_08_15,
  DATE_KST,
  LINEUP_SLATE,
  OLD_EXPECTED_LINEUP_HASH,
  ORIGINAL_OBSERVED_AT,
  PROTECTED_DOMESTIC_ROWS_HASH,
  PROTECTED_KOREAN_MARKET_HASH,
  PROTECTED_SCHEDULE_HASH,
  assertMlb20260815CorrectedLineupValues,
  assertOperatorIntakeOutputsAbsent,
  correctMlb20260815ExpectedLineupTranscription,
  fromPosNameBats,
  operatorIntakeOutputRels,
  resolveExactAwayHomePair,
  runMlb20260815OperatorIntake,
} from "./intake-mlb-2026-08-15-operator-observations";

const SCREENSHOT_ALIASES: Record<string, string> = {
  시카컵스: "Chicago Cubs",
  세인카디: "St. Louis Cardinals",
  신시레즈: "Cincinnati Reds",
  마이말린: "Miami Marlins",
  피츠파이: "Pittsburgh Pirates",
  보스레드: "Boston Red Sox",
  디트타이: "Detroit Tigers",
  시카화이: "Chicago White Sox",
  탬파레이: "Tampa Bay Rays",
  볼티오리: "Baltimore Orioles",
  뉴욕메츠: "New York Mets",
  워싱내셔: "Washington Nationals",
  클리가디: "Cleveland Guardians",
  샌디파드: "San Diego Padres",
  토론블루: "Toronto Blue Jays",
  뉴욕양키: "New York Yankees",
  애틀브레: "Atlanta Braves",
  애리다이: "Arizona Diamondbacks",
  휴스애스: "Houston Astros",
  시애매리: "Seattle Mariners",
  LA에인절: "Los Angeles Angels",
  캔자로열: "Kansas City Royals",
  애슬레틱: "Athletics",
  텍사레인: "Texas Rangers",
  LA다저스: "Los Angeles Dodgers",
  밀워브루: "Milwaukee Brewers",
  샌프자이: "San Francisco Giants",
  콜로로키: "Colorado Rockies",
};

function shaFile(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function listFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, name.name);
    if (name.isDirectory()) listFiles(abs, acc);
    else acc.push(abs);
  }
  return acc;
}

async function main() {
  assert.equal(LINEUP_SLATE.length, 14);
  assert.equal(ADMIN_ROWS_2026_08_15.length, 14);
  assert.equal(ADMIN_ROWS_2026_08_15.filter((r) => r.firstHalf).length, 1);

  const marlinsSlate = LINEUP_SLATE.find(
    (s) => s.awayTeam === "Miami Marlins" && s.homeTeam === "Cincinnati Reds",
  );
  const raysSlate = LINEUP_SLATE.find(
    (s) =>
      s.awayTeam === "Baltimore Orioles" && s.homeTeam === "Tampa Bay Rays",
  );
  const dbacksSlate = LINEUP_SLATE.find(
    (s) =>
      s.awayTeam === "Arizona Diamondbacks" &&
      s.homeTeam === "Atlanta Braves",
  );
  const metsSlate = LINEUP_SLATE.find(
    (s) =>
      s.awayTeam === "Washington Nationals" &&
      s.homeTeam === "New York Mets",
  );
  assert.ok(marlinsSlate?.away.includes("LF H. Hernandez R"));
  assert.equal(marlinsSlate?.away.includes("LF H. Hernandez L"), false);
  assert.ok(raysSlate?.home.includes("C Liam Hicks L"));
  assert.equal(raysSlate?.home.includes("C Liam Hicks R"), false);
  assert.ok(dbacksSlate?.away.includes("RF C. Carroll L"));
  assert.equal(dbacksSlate?.away.includes("RF G. Carroll L"), false);
  assert.ok(metsSlate?.home.includes("CF Luis Robert R"));
  assert.equal(metsSlate?.home.includes("CF Luis Robert Jr. R"), false);
  const slateLines = LINEUP_SLATE.flatMap((s) => [...s.away, ...s.home]);
  assert.equal(slateLines.some((l) => l.includes("G. Carroll")), false);
  assert.equal(slateLines.some((l) => l.includes("Luis Robert Jr.")), false);

  for (const [ko, canon] of Object.entries(SCREENSHOT_ALIASES)) {
    assert.equal(canonicalDomesticTeam(ko), canon, ko);
  }
  assert.equal(canonicalDomesticTeam("시카고컵스비슷한이름"), null);

  const bats = fromPosNameBats([
    "SS G. Henderson L",
    "1B Pete Alonso R",
    "2B J. Holliday L",
    "DH T. O'Neill R",
    "LF D. Beavers L",
    "RF L. Taveras S",
    "3B Coby Mayo R",
    "CF C. Cowser L",
    "C C. Narvaez R",
  ]);
  assert.equal(bats.length, 9);
  assert.equal(bats[3]!.displayName, "T. O'Neill");
  assert.equal(bats[3]!.position, "DH");
  assert.equal(bats[3]!.bats, "R");

  const jr = fromPosNameBats([
    "LF A.J. Ewing L",
    "SS F. Lindor S",
    "3B Bo Bichette R",
    "RF Carson Benge L",
    "CF Luis Robert Jr. R",
    "1B Jared Young L",
    "2B M. Semien R",
    "DH J. Polanco S",
    "C F. Alvarez R",
  ]);
  assert.equal(jr[4]!.displayName, "Luis Robert Jr.");

  assert.throws(
    () => fromPosNameBats(["2B J. Wetherholt L"]),
    /EXPECTED_9_GOT_1/,
  );

  const pairGames = [
    { gamePk: 1, awayTeam: "Boston Red Sox", homeTeam: "Pittsburgh Pirates" },
    { gamePk: 2, awayTeam: "Miami Marlins", homeTeam: "Cincinnati Reds" },
  ];
  assert.equal(
    resolveExactAwayHomePair(pairGames, "Boston Red Sox", "Pittsburgh Pirates")
      .gamePk,
    1,
  );
  assert.throws(
    () =>
      resolveExactAwayHomePair(pairGames, "Boston Red Sox", "Cincinnati Reds"),
    /SCHEDULE_PAIR_NOT_FOUND/,
  );
  assert.throws(
    () =>
      resolveExactAwayHomePair(
        [
          ...pairGames,
          { gamePk: 3, awayTeam: "Boston Red Sox", homeTeam: "Pittsburgh Pirates" },
        ],
        "Boston Red Sox",
        "Pittsburgh Pirates",
      ),
    /SCHEDULE_PAIR_AMBIGUOUS/,
  );
  assert.throws(
    () =>
      resolveExactAwayHomePair(pairGames, "boston red sox", "Pittsburgh Pirates"),
    /SCHEDULE_PAIR_NOT_FOUND/,
  );

  const scheduleRel = `data/research/mlb/${DATE_KST}-schedule-v1.json`;
  const root = process.cwd();
  if (!existsSync(path.join(root, scheduleRel))) {
    throw new Error(`SCHEDULE_REQUIRED_FOR_INTAKE_TEST: ${scheduleRel}`);
  }

  const schedule = JSON.parse(readFileSync(path.join(root, scheduleRel), "utf8")) as {
    games: Array<{
      gamePk: number;
      awayTeam: string;
      homeTeam: string;
      startTimeKst: string | null;
      commenceTimeUtc: string;
      internalGameId: string;
    }>;
  };
  assert.equal(schedule.games.length, 14);

  const predRel = `data/predictions/mlb/${DATE_KST}.json`;
  const recRel = `data/recommendations/mlb/${DATE_KST}-engine-recommendations-v1.json`;
  const predExisted = existsSync(path.join(root, predRel));
  const recExisted = existsSync(path.join(root, recRel));
  const predBefore = predExisted ? shaFile(path.join(root, predRel)) : null;
  const recBefore = recExisted ? shaFile(path.join(root, recRel)) : null;

  const tmp = mkdtempSync(path.join(tmpdir(), "mlb-0815-intake-"));
  try {
    mkdirSync(path.dirname(path.join(tmp, scheduleRel)), { recursive: true });
    cpSync(path.join(root, scheduleRel), path.join(tmp, scheduleRel));

    const firstPitch = schedule.games
      .map((g) => Date.parse(g.commenceTimeUtc))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)[0]!;
    const observedAt = new Date(firstPitch - 60 * 60 * 1000).toISOString();

    const result = await runMlb20260815OperatorIntake({ cwd: tmp, observedAt });
    assert.equal(result.scheduleGames, 14);
    assert.equal(result.mapping.length, 14);

    const lineup = JSON.parse(
      readFileSync(path.join(tmp, result.expectedLineupPath), "utf8"),
    ) as {
      lineupStatus: string;
      observationType: string;
      sourceType: string;
      expectedLineupHash: string;
      observedAt: string;
      summary: Record<string, number>;
      games: Array<{
        gamePk: number;
        awayTeam: string;
        homeTeam: string;
        lineupStatus: string;
        observationStatus: string;
        cutoffLabel: string;
        isBeforeFirstPitch: boolean;
        observedAt: string;
        firstPitchAt: string;
        awayLineup: Array<{
          battingOrder: number;
          displayName: string;
          position: string | null;
          bats: string | null;
          providerPlayerId: null;
        }>;
        homeLineup: Array<{
          battingOrder: number;
          displayName: string;
          position: string | null;
          bats: string | null;
          providerPlayerId: null;
        }>;
      }>;
    };
    assert.equal(lineup.lineupStatus, "EXPECTED");
    assert.equal(lineup.observationType, "EXPECTED_LINEUP");
    assert.equal(lineup.sourceType, "MANUAL_OBSERVATION");
    assert.equal(lineup.summary.scheduleGames, 14);
    assert.equal(lineup.summary.matchedGames, 14);
    assert.equal(lineup.summary.teamLineups, 28);
    assert.equal(lineup.summary.expectedBattingSlots, 252);
    assert.equal(lineup.summary.expectedGames, 14);
    assert.equal(lineup.summary.confirmedGames, 0);
    assert.equal(lineup.summary.missingGames, 0);
    assert.equal(lineup.summary.joinErrors, 0);
    assert.equal(lineup.summary.preGameObservations, 14);
    assert.equal(lineup.summary.lateObservations, 0);
    for (const g of lineup.games) {
      assert.equal(g.lineupStatus, "EXPECTED");
      assert.equal(g.observationStatus, "OBSERVED");
      assert.equal(g.awayLineup.length, 9);
      assert.equal(g.homeLineup.length, 9);
      assert.equal(g.cutoffLabel, "PRE_GAME_OBSERVATION");
      assert.equal(g.isBeforeFirstPitch, true);
      assert.ok(Date.parse(g.observedAt) < Date.parse(g.firstPitchAt));
      for (const b of [...g.awayLineup, ...g.homeLineup]) {
        assert.equal(b.providerPlayerId, null);
      }
    }
    assertMlb20260815CorrectedLineupValues(lineup);

    const domestic = JSON.parse(
      readFileSync(path.join(tmp, result.domesticPath), "utf8"),
    ) as {
      meta: { screenshotCount: number; commercialUseStatus: string; sourceType: string };
      summary: Record<string, number>;
      unresolved: unknown[];
      games: Array<{
        gamePk: number;
        homeTeam: string;
        awayTeam: string;
        capturedBeforeStart: boolean;
        cutoffStatus: string;
        mappingMethod: string;
        normalizedMarkets: Array<{
          marketType: string;
          homePrice?: number;
          awayPrice?: number;
        }>;
      }>;
    };
    assert.equal(domestic.meta.screenshotCount, 3);
    assert.equal(domestic.meta.commercialUseStatus, "INTERNAL_ONLY");
    assert.equal(domestic.meta.sourceType, "ADMIN_MANUAL_SCREENSHOT");
    assert.equal(domestic.summary.mappedGames, 14);
    assert.equal(domestic.summary.unmappedScheduleGames, 0);
    assert.equal(domestic.unresolved.length, 0);
    assert.equal(domestic.summary.moneylineComplete, 14);
    assert.equal(domestic.summary.totalsComplete, 14);
    assert.equal(domestic.summary.runLineComplete, 14);
    const firstHalfGames = domestic.games.filter((g) =>
      g.normalizedMarkets.some((m) => m.marketType.startsWith("FIRST_HALF")),
    );
    assert.equal(firstHalfGames.length, 1);
    assert.equal(firstHalfGames[0]!.homeTeam, "San Francisco Giants");
    assert.equal(firstHalfGames[0]!.awayTeam, "Colorado Rockies");
    for (const g of domestic.games) {
      assert.equal(g.cutoffStatus, "PASS");
      assert.equal(g.capturedBeforeStart, true);
      assert.match(g.mappingMethod, /EXACT_TEAM_PAIR_AND_START_TIME/);
      assert.equal(g.mappingMethod.includes("fuzzy"), false);
    }

    const korean = JSON.parse(
      readFileSync(path.join(tmp, result.koreanPath), "utf8"),
    ) as {
      sourceType: string;
      marketContext: string;
      koreanMarketOddsHash: string;
      summary: Record<string, number>;
      games: Array<{
        gamePk: number;
        homeTeam: string;
        awayTeam: string;
        internalGameId: string;
        homeOdds: number;
        awayOdds: number;
        observationStatus: string;
        isBeforeFirstPitch: boolean;
        observedAt: string;
        firstPitchAt: string;
      }>;
    };
    assert.equal(korean.sourceType, "MANUAL_OBSERVATION");
    assert.equal(korean.marketContext, "KOREAN_MARKET");
    assert.equal(korean.summary.scheduleGames, 14);
    assert.equal(korean.summary.matchedGames, 14);
    assert.equal(korean.summary.observedGames, 14);
    assert.equal(korean.summary.missingGames, 0);
    assert.equal(korean.summary.joinReviewRequired, 0);
    assert.equal(korean.summary.preGameObservations, 14);
    assert.equal(korean.summary.lateGames, 0);

    for (const g of korean.games) {
      const d = domestic.games.find((x) => x.gamePk === g.gamePk)!;
      const ml = d.normalizedMarkets.find((m) => m.marketType === "MONEYLINE_2WAY");
      assert.ok(ml, `missing MONEYLINE_2WAY gamePk=${g.gamePk}`);
      assert.equal(ml.homePrice, g.homeOdds);
      assert.equal(ml.awayPrice, g.awayOdds);
      assert.equal(d.homeTeam, g.homeTeam);
      assert.equal(d.awayTeam, g.awayTeam);
      assert.equal(g.observationStatus, "PRE_GAME_OBSERVATION");
      assert.equal(g.isBeforeFirstPitch, true);
      assert.ok(Date.parse(g.observedAt) < Date.parse(g.firstPitchAt));
    }

    await assert.rejects(
      () => runMlb20260815OperatorIntake({ cwd: tmp, observedAt }),
      /FILE_ALREADY_EXISTS/,
    );

    const domesticShaBefore = shaFile(path.join(tmp, result.domesticPath));
    const koreanShaBefore = shaFile(path.join(tmp, result.koreanPath));
    const scheduleShaBefore = shaFile(path.join(tmp, scheduleRel));
    const correction = await correctMlb20260815ExpectedLineupTranscription({
      cwd: tmp,
      correctedAt: "2026-08-14T13:50:00.000Z",
    });
    assert.equal(correction.observedAt, ORIGINAL_OBSERVED_AT);
    assert.notEqual(correction.expectedLineupHash, OLD_EXPECTED_LINEUP_HASH);
    assert.equal(shaFile(path.join(tmp, result.domesticPath)), domesticShaBefore);
    assert.equal(shaFile(path.join(tmp, result.koreanPath)), koreanShaBefore);
    assert.equal(shaFile(path.join(tmp, scheduleRel)), scheduleShaBefore);

    const correctedLineup = JSON.parse(
      readFileSync(path.join(tmp, result.expectedLineupPath), "utf8"),
    ) as typeof lineup;
    assert.equal(correctedLineup.observedAt, ORIGINAL_OBSERVED_AT);
    assertMlb20260815CorrectedLineupValues(correctedLineup);

    const tmpAudit = JSON.parse(
      readFileSync(path.join(tmp, result.auditPath), "utf8"),
    ) as {
      expectedLineupHash: string;
      correction?: {
        applied: boolean;
        reason: string;
        count: number;
        fields: string[];
      };
    };
    assert.equal(tmpAudit.expectedLineupHash, correction.expectedLineupHash);
    assert.equal(tmpAudit.correction?.applied, true);
    assert.equal(
      tmpAudit.correction?.reason,
      "SOURCE_TRANSCRIPTION_CORRECTION_BEFORE_PREDICTION",
    );
    assert.equal(tmpAudit.correction?.count, 4);
    assert.equal(tmpAudit.correction?.fields.length, 4);

    await assert.rejects(
      () => runMlb20260815OperatorIntake({ cwd: tmp, observedAt }),
      /FILE_ALREADY_EXISTS/,
    );

    const images = listFiles(path.join(tmp, "data")).filter((p) =>
      /\.(png|jpe?g|webp|gif)$/i.test(p),
    );
    assert.equal(images.length, 0);
    assert.equal(existsSync(path.join(tmp, predRel)), false);
    assert.equal(existsSync(path.join(tmp, recRel)), false);
  } finally {
    // tmp cleanup left to OS; avoid deleting if still locked
  }

  if (predExisted) {
    assert.equal(shaFile(path.join(root, predRel)), predBefore);
  } else {
    assert.equal(existsSync(path.join(root, predRel)), false);
  }
  if (recExisted) {
    assert.equal(shaFile(path.join(root, recRel)), recBefore);
  } else {
    assert.equal(existsSync(path.join(root, recRel)), false);
  }

  const rels = operatorIntakeOutputRels();
  if (existsSync(path.join(root, rels.expectedLineup))) {
    assert.throws(
      () => assertOperatorIntakeOutputsAbsent(root),
      /FILE_ALREADY_EXISTS/,
    );
    const prodLineup = JSON.parse(
      readFileSync(path.join(root, rels.expectedLineup), "utf8"),
    ) as {
      expectedLineupHash: string;
      lineupStatus: string;
      observedAt: string;
      summary: Record<string, number>;
      games: Array<{
        awayTeam: string;
        homeTeam: string;
        lineupStatus: string;
        awayLineup: Array<{
          displayName: string;
          position: string | null;
          bats: string | null;
        }>;
        homeLineup: Array<{
          displayName: string;
          position: string | null;
          bats: string | null;
        }>;
      }>;
    };
    assertMlb20260815CorrectedLineupValues(prodLineup);
    assert.equal(prodLineup.observedAt, ORIGINAL_OBSERVED_AT);
    assert.equal(prodLineup.summary.confirmedGames, 0);
    assert.equal(prodLineup.summary.expectedBattingSlots, 252);
  }
  if (existsSync(path.join(root, scheduleRel))) {
    assert.equal(shaFile(path.join(root, scheduleRel)), PROTECTED_SCHEDULE_HASH);
  }
  if (existsSync(path.join(root, rels.domestic))) {
    const prodDomestic = JSON.parse(
      readFileSync(path.join(root, rels.domestic), "utf8"),
    ) as { meta: { rowsHash: string } };
    assert.equal(prodDomestic.meta.rowsHash, PROTECTED_DOMESTIC_ROWS_HASH);
  }
  if (existsSync(path.join(root, rels.korean))) {
    const prodKorean = JSON.parse(
      readFileSync(path.join(root, rels.korean), "utf8"),
    ) as { koreanMarketOddsHash: string };
    assert.equal(prodKorean.koreanMarketOddsHash, PROTECTED_KOREAN_MARKET_HASH);
  }
  if (existsSync(path.join(root, rels.audit))) {
    const prodAudit = JSON.parse(
      readFileSync(path.join(root, rels.audit), "utf8"),
    ) as {
      scheduleHash: string;
      domesticMarketsRowsHash: string;
      koreanMarketOddsHash: string;
      expectedLineupHash: string;
      correction?: { applied: boolean; count: number; reason: string };
    };
    assert.equal(prodAudit.scheduleHash, PROTECTED_SCHEDULE_HASH);
    assert.equal(prodAudit.domesticMarketsRowsHash, PROTECTED_DOMESTIC_ROWS_HASH);
    assert.equal(prodAudit.koreanMarketOddsHash, PROTECTED_KOREAN_MARKET_HASH);
    assert.notEqual(prodAudit.expectedLineupHash, OLD_EXPECTED_LINEUP_HASH);
    assert.equal(prodAudit.correction?.applied, true);
    assert.equal(prodAudit.correction?.count, 4);
    assert.equal(
      prodAudit.correction?.reason,
      "SOURCE_TRANSCRIPTION_CORRECTION_BEFORE_PREDICTION",
    );
  }

  console.log("PASS test-mlb-2026-08-15-operator-observations-intake-v0");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
