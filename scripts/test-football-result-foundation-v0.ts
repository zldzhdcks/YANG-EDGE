/**
 * Football Result Foundation v0 tests.
 * Run: npm run test:football-result-foundation-v0
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { buildFootballMatchIdentity } from "../src/lib/football/foundation";
import {
  FOOTBALL_RESULT_RISK_REGISTER_V0,
  buildDefaultFootballResultView,
  buildFootballResultView,
  computeFootballResultHash,
  deriveOneXTwoOutcome,
  joinResultToIdentity,
  normalizeFootballResult,
  resolveFootballResultUsability,
  resultHashIgnoresFields,
  toFootballReviewResultAdapter,
  type FootballResultInputV0,
} from "../src/lib/football/result-foundation-v0";

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

function baseInput(
  id: ReturnType<typeof identity>,
  patch: Partial<FootballResultInputV0> = {},
): FootballResultInputV0 {
  return {
    matchId: id.matchId,
    identityHash: id.identityHash,
    provider: id.provider,
    fixtureId: id.fixtureId,
    competitionId: id.competitionId,
    season: id.season,
    homeTeamId: id.homeTeamId,
    awayTeamId: id.awayTeamId,
    status: "FINAL",
    regularTime: { home: 2, away: 1 },
    extraTime: { home: null, away: null },
    penalties: { home: null, away: null },
    finalScore: { home: 2, away: 1 },
    resultObservedAt: "2025-08-15T21:00:00.000Z",
    sourceStatusRaw: "FT",
    ...patch,
  };
}

function main() {
  const id = identity();
  const map = new Map([[id.matchId, id]]);

  // HOME / DRAW / AWAY FT
  assert.equal(
    deriveOneXTwoOutcome({
      status: "FINAL",
      regularTime: { home: 2, away: 1 },
    }),
    "HOME",
  );
  assert.equal(
    deriveOneXTwoOutcome({
      status: "FINAL",
      regularTime: { home: 1, away: 1 },
    }),
    "DRAW",
  );
  assert.equal(
    deriveOneXTwoOutcome({
      status: "FINAL",
      regularTime: { home: 0, away: 3 },
    }),
    "AWAY",
  );

  // FT DRAW + ET HOME → 1X2 DRAW / advancement HOME
  const et = normalizeFootballResult(
    baseInput(id, {
      status: "FINAL_AFTER_EXTRA_TIME",
      regularTime: { home: 1, away: 1 },
      extraTime: { home: 2, away: 1 },
      finalScore: { home: 2, away: 1 },
    }),
  );
  assert.ok(et.result);
  assert.equal(et.result!.oneXTwoOutcome, "DRAW");
  assert.equal(et.result!.advancementWinner, "HOME");

  // FT DRAW + PEN AWAY
  const pen = normalizeFootballResult(
    baseInput(id, {
      status: "FINAL_AFTER_PENALTIES",
      regularTime: { home: 0, away: 0 },
      extraTime: { home: 0, away: 0 },
      penalties: { home: 3, away: 4 },
      finalScore: { home: 0, away: 0 },
    }),
  );
  assert.ok(pen.result);
  assert.equal(pen.result!.oneXTwoOutcome, "DRAW");
  assert.equal(pen.result!.advancementWinner, "AWAY");

  // NOT_FINAL blocked
  const live = resolveFootballResultUsability({
    rows: [baseInput(id, { status: "LIVE", regularTime: { home: 1, away: 0 } })],
    identitiesByMatchId: map,
  });
  assert.equal(live.resolved[0]!.usability, "NOT_FINAL");
  assert.equal(live.resolved[0]!.gradingAllowed, false);

  // POSTPONED / CANCELLED / VOID
  for (const [status, u] of [
    ["POSTPONED", "POSTPONED_NOT_GRADED"],
    ["CANCELLED", "CANCELLED_NOT_GRADED"],
    ["VOID", "VOID_NOT_GRADED"],
  ] as const) {
    const r = resolveFootballResultUsability({
      rows: [baseInput(id, { status })],
      identitiesByMatchId: map,
    });
    assert.equal(r.resolved[0]!.usability, u);
    assert.equal(r.resolved[0]!.gradingAllowed, false);
  }

  // ABANDONED
  const abd = resolveFootballResultUsability({
    rows: [baseInput(id, { status: "ABANDONED" })],
    identitiesByMatchId: map,
  });
  assert.equal(abd.resolved[0]!.usability, "ABANDONED_REVIEW_REQUIRED");

  // negative score
  const neg = normalizeFootballResult(
    baseInput(id, { regularTime: { home: -1, away: 0 } }),
  );
  assert.equal(neg.ok, false);
  assert.ok(neg.reasonCodes.some((c) => c.includes("REGULAR_TIME")));

  // penalties tie
  const penTie = normalizeFootballResult(
    baseInput(id, {
      status: "FINAL_AFTER_PENALTIES",
      regularTime: { home: 1, away: 1 },
      penalties: { home: 5, away: 5 },
    }),
  );
  assert.equal(penTie.ok, false);
  assert.ok(penTie.reasonCodes.includes("PENALTIES_TIE"));

  // provider winner conflict
  const conflict = normalizeFootballResult(
    baseInput(id, {
      regularTime: { home: 2, away: 1 },
      providerAdvancementWinner: "AWAY",
    }),
  );
  assert.equal(conflict.conflict, true);
  assert.ok(conflict.reasonCodes.includes("RESULT_CONFLICT"));
  const conflictU = resolveFootballResultUsability({
    rows: [
      baseInput(id, {
        regularTime: { home: 2, away: 1 },
        providerAdvancementWinner: "AWAY",
      }),
    ],
    identitiesByMatchId: map,
  });
  assert.equal(conflictU.resolved[0]!.usability, "RESULT_CONFLICT");
  assert.equal(conflictU.resolved[0]!.gradingAllowed, false);

  // identity mismatch
  const badJoin = joinResultToIdentity(
    baseInput(id, { fixtureId: "999" }),
    id,
  );
  assert.equal(badJoin.ok, false);
  assert.ok(badJoin.reasonCodes.includes("IDENTITY_UNRESOLVED"));

  // reversed teams
  const rev = joinResultToIdentity(
    baseInput(id, { homeTeamId: "40", awayTeamId: "33" }),
    id,
  );
  assert.equal(rev.orientation, "REVERSED_SUSPECTED");
  assert.equal(rev.ok, false);

  // hash ignores display/generatedAt
  assert.ok(resultHashIgnoresFields().includes("generatedAt"));
  assert.ok(resultHashIgnoresFields().includes("displayName"));
  const n1 = normalizeFootballResult(baseInput(id));
  const n2 = normalizeFootballResult(
    baseInput(id, { resultObservedAt: "2099-01-01T00:00:00.000Z" }),
  );
  assert.ok(n1.result && n2.result);
  assert.equal(n1.result!.resultHash, n2.result!.resultHash);
  assert.equal(
    computeFootballResultHash({
      matchId: n1.result!.matchId,
      identityHash: n1.result!.identityHash,
      provider: n1.result!.provider,
      fixtureId: n1.result!.fixtureId,
      competitionId: n1.result!.competitionId,
      season: n1.result!.season,
      homeTeamId: n1.result!.homeTeamId,
      awayTeamId: n1.result!.awayTeamId,
      status: n1.result!.status,
      regularTime: n1.result!.regularTime,
      extraTime: n1.result!.extraTime,
      penalties: n1.result!.penalties,
      finalScore: n1.result!.finalScore,
      oneXTwoOutcome: n1.result!.oneXTwoOutcome,
      advancementWinner: n1.result!.advancementWinner,
    }),
    n1.result!.resultHash,
  );

  // adapter
  const usable = resolveFootballResultUsability({
    rows: [baseInput(id)],
    identitiesByMatchId: map,
  });
  assert.equal(usable.resolved[0]!.gradingAllowed, true);
  const adapter = toFootballReviewResultAdapter({
    result: usable.resolved[0]!.result!,
    usability: "FINAL_USABLE",
  });
  assert.equal(adapter.gradingAllowed, true);
  assert.equal(adapter.outcome, "HOME");
  assert.equal(adapter.marketType, "MONEYLINE_3WAY_1X2");

  const blockedAdapter = toFootballReviewResultAdapter({
    result: usable.resolved[0]!.result!,
    usability: "NOT_FINAL",
  });
  assert.equal(blockedAdapter.gradingAllowed, false);

  // default view FOUNDATION
  const def = buildDefaultFootballResultView("2026-08-04");
  assert.equal(def.slice.resultStage, "FOUNDATION");
  assert.equal(def.slice.prediction, "NONE");
  assert.equal(def.slice.gate.progressPercent, null);
  assert.match(def.slice.plainLanguage, /아직 수집되지 않았습니다/);

  // multi summary language
  const multi = buildFootballResultView({
    dateKst: "2026-08-04",
    identities: [id],
    rows: [
      baseInput(id),
      baseInput(id, {
        matchId: id.matchId,
        status: "LIVE",
        regularTime: { home: 0, away: 0 },
      }),
    ],
  });
  // second row same matchId overwrites identity map lookup — use only statuses on resolved
  assert.ok(multi.slice.plainLanguage.length > 0);

  assert.ok(FOOTBALL_RESULT_RISK_REGISTER_V0.length >= 10);

  // aggregate collect-only does not change 1X2
  const agg = normalizeFootballResult(
    baseInput(id, {
      regularTime: { home: 1, away: 1 },
      aggregateHome: 3,
      aggregateAway: 2,
      legNumber: 2,
      tieId: "tie-1",
    }),
  );
  assert.equal(agg.result!.oneXTwoOutcome, "DRAW");
  assert.equal(agg.result!.aggregateCollectOnly.aggregateHome, 3);

  console.log("PASS test-football-result-foundation-v0");
  console.log(
    JSON.stringify(
      {
        etDrawAdvHome: {
          oneXTwo: et.result!.oneXTwoOutcome,
          adv: et.result!.advancementWinner,
        },
        penDrawAdvAway: {
          oneXTwo: pen.result!.oneXTwoOutcome,
          adv: pen.result!.advancementWinner,
        },
        hashPrefix: n1.result!.resultHash.slice(0, 12),
        defaultStage: def.slice.resultStage,
        risks: FOOTBALL_RESULT_RISK_REGISTER_V0.length,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]!).href) {
  main();
}
