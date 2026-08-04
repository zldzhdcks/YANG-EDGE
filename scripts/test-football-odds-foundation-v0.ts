/**
 * Football 1X2 Odds Foundation v0 tests.
 * Run: npm run test:football-odds-foundation-v0
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import {
  buildFootballMatchIdentity,
} from "../src/lib/football/foundation";
import {
  FOOTBALL_1X2_OVERROUND_CONFIG,
  FOOTBALL_PREDICTION_MARKET,
  buildFootballOddsView,
  computeOneXTwoDevig,
  joinOddsRowToIdentity,
  resolveFootballOddsUsability,
  validateCollectOnlyRow,
  validateOneXTwoOddsRow,
  type FootballCollectOnlyOddsRow,
  type FootballOneXTwoOddsRow,
} from "../src/lib/football/odds-foundation-v0";

function identity() {
  return buildFootballMatchIdentity({
    provider: "api-football",
    fixtureId: "1234567",
    competitionId: "fb-comp-api-football-39",
    season: "2025",
    kickoffUtc: "2025-08-15T19:00:00.000Z",
    homeTeamId: "33",
    awayTeamId: "40",
    neutralVenue: false,
    status: "SCHEDULED",
  });
}

function baseRow(
  id: ReturnType<typeof identity>,
  patch: Partial<FootballOneXTwoOddsRow> = {},
): FootballOneXTwoOddsRow {
  return {
    matchId: id.matchId,
    identityHash: id.identityHash,
    provider: id.provider,
    fixtureId: id.fixtureId,
    competitionId: id.competitionId,
    homeTeamId: id.homeTeamId,
    awayTeamId: id.awayTeamId,
    bookmakerId: "bk-1",
    marketType: FOOTBALL_PREDICTION_MARKET,
    homeDecimal: 2.1,
    drawDecimal: 3.4,
    awayDecimal: 3.5,
    capturedAt: "2025-08-15T12:00:00.000Z",
    commenceTime: id.kickoffUtc,
    sourceType: "OVERSEAS_PROVIDER",
    sourceNamespace: "OVERSEAS",
    commercialUseStatus: "INTERNAL_ONLY",
    format: "DECIMAL",
    status: "COLLECTED",
    ...patch,
  };
}

function main() {
  const id = identity();
  const map = new Map([[id.matchId, id]]);

  // 정상 1X2 → FULLY_USABLE
  const ok = resolveFootballOddsUsability({
    overseasRows: [baseRow(id)],
    identitiesByMatchId: map,
    expectedMatchCount: 1,
  });
  assert.equal(ok.usability, "FULLY_USABLE");
  assert.equal(ok.gate.predictionAllowed, true);
  assert.equal(ok.usableOverseasCount, 1);

  // draw 누락 → PARTIAL (row) / ARTIFACT_PRESENT_NO_USABLE or partial usability
  const noDraw = resolveFootballOddsUsability({
    overseasRows: [baseRow(id, { drawDecimal: null, status: "PARTIAL" })],
    identitiesByMatchId: map,
  });
  assert.equal(noDraw.usableOverseasCount, 0);
  assert.ok(
    noDraw.usability === "ARTIFACT_PRESENT_NO_USABLE_ROWS" ||
      noDraw.usability === "PARTIAL_USABLE",
  );
  assert.equal(noDraw.gate.predictionAllowed, false);
  const vDraw = validateOneXTwoOddsRow(baseRow(id, { drawDecimal: null }));
  assert.equal(vDraw.status, "PARTIAL");
  assert.equal(vDraw.predictionEligible, false);

  // home odds <= 1 → INVALID
  const badHome = validateOneXTwoOddsRow(baseRow(id, { homeDecimal: 1 }));
  assert.ok(badHome.reasonCodes.includes("HOME_ODDS_LTE_1_OR_NONFINITE"));
  assert.equal(badHome.predictionEligible, false);

  // capturedAt after kickoff → AFTER_CUTOFF
  const late = validateOneXTwoOddsRow(
    baseRow(id, { capturedAt: "2025-08-15T20:00:00.000Z" }),
  );
  assert.equal(late.status, "AFTER_CUTOFF");
  const lateU = resolveFootballOddsUsability({
    overseasRows: [baseRow(id, { capturedAt: "2025-08-15T20:00:00.000Z" })],
    identitiesByMatchId: map,
  });
  assert.equal(lateU.usability, "AFTER_CUTOFF");
  assert.equal(lateU.gate.predictionAllowed, false);

  // fixture identity mismatch → IDENTITY_UNRESOLVED
  const mismatch = joinOddsRowToIdentity(
    baseRow(id, { fixtureId: "999" }),
    id,
  );
  assert.equal(mismatch.ok, false);
  assert.ok(mismatch.reasonCodes.includes("FIXTURE_ID_MISMATCH"));
  assert.ok(mismatch.reasonCodes.includes("IDENTITY_UNRESOLVED"));

  // displayName change does not affect hash/usability (identity hash stable)
  const hash1 = id.identityHash;
  const id2 = identity();
  assert.equal(hash1, id2.identityHash);
  const u2 = resolveFootballOddsUsability({
    overseasRows: [baseRow(id2)],
    identitiesByMatchId: new Map([[id2.matchId, id2]]),
    expectedMatchCount: 1,
  });
  assert.equal(u2.usability, "FULLY_USABLE");

  // home/away reverse → not auto-approved
  const rev = joinOddsRowToIdentity(
    baseRow(id, { homeTeamId: "40", awayTeamId: "33" }),
    id,
  );
  assert.equal(rev.orientation, "REVERSED_SUSPECTED");
  assert.equal(rev.ok, false);
  assert.ok(rev.reasonCodes.includes("HOME_AWAY_REVERSED_NOT_AUTO_APPROVED"));

  // overseas vs domestic separation
  const domesticRow = baseRow(id, {
    sourceNamespace: "DOMESTIC",
    sourceType: "ADMIN_MANUAL_SCREENSHOT",
    commercialUseStatus: "INTERNAL_ONLY",
    bookmakerId: null,
  });
  const sep = resolveFootballOddsUsability({
    overseasRows: [],
    domesticRows: [domesticRow],
    identitiesByMatchId: map,
  });
  assert.equal(sep.namespacesSeparated, true);
  assert.equal(sep.usableOverseasCount, 0);
  assert.equal(sep.usableDomesticCount, 1);
  assert.equal(sep.gate.predictionAllowed, false); // domestic does not unlock prediction
  assert.ok(
    sep.gate.reasons.includes("DOMESTIC_DOES_NOT_REPLACE_OVERSEAS_PRIOR"),
  );

  // collect-only → prediction forbidden
  const collect: FootballCollectOnlyOddsRow = {
    matchId: id.matchId,
    identityHash: id.identityHash,
    provider: id.provider,
    fixtureId: id.fixtureId,
    marketType: "BTTS",
    payload: { yes: 1.9, no: 1.9 },
    capturedAt: "2025-08-15T12:00:00.000Z",
    commenceTime: id.kickoffUtc,
    sourceNamespace: "OVERSEAS",
    status: "COLLECT_ONLY",
    predictionEligible: false,
  };
  assert.equal(validateCollectOnlyRow(collect).predictionEligible, false);
  const withCollect = resolveFootballOddsUsability({
    overseasRows: [baseRow(id)],
    collectOnlyRows: [collect],
    identitiesByMatchId: map,
    expectedMatchCount: 1,
  });
  assert.equal(withCollect.collectOnlyExcludedFromPrediction, true);
  assert.ok(
    withCollect.gate.reasons.some((r) => r.startsWith("COLLECT_ONLY_EXCLUDED")),
  );

  // devig sum ≈ 1
  const devig = computeOneXTwoDevig({
    homeDecimal: 2.1,
    drawDecimal: 3.4,
    awayDecimal: 3.5,
  });
  assert.ok(Number.isFinite(devig.overround));
  assert.ok(
    Math.abs(devig.devigSum - 1) <= FOOTBALL_1X2_OVERROUND_CONFIG.devigSumTolerance,
  );
  assert.equal(devig.devigHome + devig.devigDraw + devig.devigAway, devig.devigSum);

  // artifact exists + usable 0 → BLOCKED
  const emptyPresent = resolveFootballOddsUsability({
    overseasRows: [],
    domesticRows: [],
    identitiesByMatchId: map,
  });
  assert.equal(emptyPresent.usability, "ARTIFACT_PRESENT_NO_USABLE_ROWS");
  assert.equal(emptyPresent.gate.status, "BLOCKED");
  assert.equal(emptyPresent.gate.predictionAllowed, false);

  // deterministic hash
  const a = resolveFootballOddsUsability({
    overseasRows: [baseRow(id)],
    identitiesByMatchId: map,
  });
  const b = resolveFootballOddsUsability({
    overseasRows: [baseRow(id)],
    identitiesByMatchId: map,
  });
  assert.equal(a.artifactHash, b.artifactHash);

  // default OS view NOT_STARTED
  const view = buildFootballOddsView({
    dateKst: "2026-08-04",
    identities: [],
    artifactPresent: false,
  });
  assert.equal(view.slice.oddsStage, "NOT_STARTED");
  assert.equal(view.slice.prediction, "NONE");
  assert.equal(view.slice.gate.progressPercent, null);
  assert.match(view.slice.gate.plainLanguage, /아직 수집되지 않았습니다/);

  // config thresholds visible
  assert.ok(FOOTBALL_1X2_OVERROUND_CONFIG.blockAbove > FOOTBALL_1X2_OVERROUND_CONFIG.warnAbove);

  console.log("PASS test-football-odds-foundation-v0");
  console.log(
    JSON.stringify(
      {
        fullyUsable: ok.usability,
        afterCutoff: lateU.usability,
        domesticDoesNotReplace: sep.usableOverseasCount === 0,
        artifactHashPrefix: a.artifactHash.slice(0, 12),
        overround: Number(devig.overround.toFixed(6)),
        defaultStage: view.slice.oddsStage,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]!).href) {
  main();
}
