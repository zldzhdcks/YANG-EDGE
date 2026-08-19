/**
 * Football Schedule Hybrid Identity Gate v1 tests.
 * Run: npm run test:football-hybrid-identity-v1
 *
 * No Provider network. Does not rewrite frozen 2026-08-20 artifacts.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assembleFootballScheduleArtifact,
  finalizeFootballScheduleDocument,
  type FootballScheduleRowV1,
} from "../src/lib/football/core";
import { assembleFootballMarketBaselinePostgameReviewV0 } from "../src/lib/football/market-baseline-postgame-review-v0";
import type { FootballMarketBaselinePredictionV0 } from "../src/lib/football/market-baseline-prediction-v0/types";
import { joinScheduleRowToOddsEvent, planOddsFetches } from "../src/lib/football/odds-1x2-v1";
import {
  buildFootballOfficialResultV0,
  hasCompleteProviderFixtureIdentity,
  identityFromScheduleRow,
  joinProviderFixtureToScheduleRow,
  resolveOfficialResultMatch,
  selectOfficialResultTargetRows,
  type FootballOfficialResultArtifactV0,
  type FootballOfficialResultFixtureFetcher,
} from "../src/lib/football/official-result-v0";
import type { FixtureRaw } from "../src/lib/football/types";

export const AUDIT_REL =
  "data/audits/football-schedule-hybrid-identity-gate-v1.json";
export const SCHEMA = "yang-edge-football-schedule-hybrid-identity-gate-v1";

const FROZEN = {
  schedule: "data/research/football/2026-08-20-schedule-v1.json",
  freezeClose: "data/audits/2026-08-20-pregame-freeze-close-v1.json",
  providerIdAudit:
    "data/audits/football-provider-id-first-identity-gate-audit-v1.json",
  openingReadiness: "data/audits/football-2026-27-opening-readiness-v1.json",
  result0818: "data/research/football/2026-08-18-official-result-v0.json",
  review0818: "data/research/football/2026-08-18-market-baseline-review-v0.json",
} as const;

const EXPECTED_SHA256 = {
  [FROZEN.schedule]:
    "7318cf39f461d7e5423d82a670e23d040cf3083a6ea1b71dcc6414299b071440",
  [FROZEN.freezeClose]:
    "7d5bbfceb284711d44eb191fba478be5b110e26b0a709250e0838bb8d3eaca8d",
} as const;

const DATE = "2026-08-20";
const KICKOFF = "2026-08-20T14:00:00.000Z";
const OBSERVED = "2026-08-20T16:05:00.000Z";
const GENERATED = "2026-08-20T16:05:01.000Z";

type ScheduleDoc = {
  meta: {
    generatedAt: string;
    identityMatched: number;
    identityBlocked: number;
    scheduleGames: number;
    formatEligible: number;
  };
  rows: FootballScheduleRowV1[];
};

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function matchedRow(
  over: Partial<FootballScheduleRowV1> = {},
): FootballScheduleRowV1 {
  return {
    dateKst: DATE,
    matchId: "soccer-api-football-1570337",
    provider: "api-football",
    providerMatchId: "1570337",
    competitionId: "fb-comp-api-football-140",
    seasonId: "2026",
    competitionType: "LEAGUE",
    matchFormat: "LEAGUE_MATCH",
    homeTeamId: "fb-team-v1-api-football-544",
    awayTeamId: "fb-team-v1-api-football-797",
    homeProviderTeamId: "544",
    awayProviderTeamId: "797",
    homeTeamName: "Deportivo La Coruna",
    awayTeamName: "Elche",
    kickoffTimeUtc: KICKOFF,
    status: "SCHEDULED",
    venue: "Riazor",
    identityStatus: "MATCHED",
    identityReasons: [],
    predictionEligibility: "ELIGIBLE_FORMAT",
    researchOnly: true,
    ...over,
  };
}

function catalogPendingRow(
  over: Partial<FootballScheduleRowV1> = {},
): FootballScheduleRowV1 {
  return {
    dateKst: DATE,
    matchId: "soccer-api-football-1570334",
    provider: "api-football",
    providerMatchId: "1570334",
    competitionId: "fb-comp-api-football-140",
    seasonId: "2026",
    competitionType: "LEAGUE",
    matchFormat: "LEAGUE_MATCH",
    homeTeamId: null,
    awayTeamId: null,
    homeProviderTeamId: "530",
    awayProviderTeamId: "535",
    homeTeamName: "Atletico Madrid",
    awayTeamName: "Malaga",
    kickoffTimeUtc: KICKOFF,
    status: "SCHEDULED",
    venue: "Metropolitano Stadium",
    identityStatus: "IDENTITY_REVIEW_REQUIRED",
    identityReasons: [
      "UNKNOWN_PROVIDER_TEAM_ID",
      "PROVIDER_TEAM_ID:530",
      "UNKNOWN_PROVIDER_TEAM_ID",
      "PROVIDER_TEAM_ID:535",
    ],
    predictionEligibility: "IDENTITY_BLOCKED",
    researchOnly: true,
    ...over,
  };
}

function uclPendingRow(): FootballScheduleRowV1 {
  return {
    dateKst: DATE,
    matchId: "soccer-api-football-1610923",
    provider: "api-football",
    providerMatchId: "1610923",
    competitionId: "fb-comp-api-football-2",
    seasonId: "2026",
    competitionType: "CONTINENTAL",
    matchFormat: "UNKNOWN",
    homeTeamId: null,
    awayTeamId: null,
    homeProviderTeamId: "247",
    awayProviderTeamId: "1026",
    homeTeamName: "Celtic",
    awayTeamName: "Lask Linz",
    kickoffTimeUtc: KICKOFF,
    status: "SCHEDULED",
    venue: "Celtic Park",
    identityStatus: "IDENTITY_REVIEW_REQUIRED",
    identityReasons: ["UNKNOWN_PROVIDER_TEAM_ID"],
    predictionEligibility: "IDENTITY_BLOCKED",
    researchOnly: true,
  };
}

function fixtureRaw(over: {
  fixtureId?: number;
  leagueId?: number;
  homeId?: number;
  awayId?: number;
  date?: string;
  status?: string;
  fulltime?: { home: number | null; away: number | null };
}): FixtureRaw {
  const fulltime = over.fulltime ?? { home: 2, away: 1 };
  return {
    fixture: {
      id: over.fixtureId ?? 1570334,
      date: over.date ?? KICKOFF,
      status: {
        long: over.status ?? "Match Finished",
        short: over.status ?? "FT",
        elapsed: 90,
      },
    },
    league: {
      id: over.leagueId ?? 140,
      name: "La Liga",
      country: "Spain",
      season: 2026,
    },
    teams: {
      home: { id: over.homeId ?? 530, name: "Atletico Madrid", winner: true },
      away: { id: over.awayId ?? 535, name: "Malaga", winner: false },
    },
    goals: fulltime,
    score: {
      halftime: { home: 1, away: 0 },
      fulltime,
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  };
}

function writeSchedule(root: string, rows: FootballScheduleRowV1[]): void {
  const doc = finalizeFootballScheduleDocument({
    dateKst: rows[0]?.dateKst ?? DATE,
    generatedAt: "2026-08-20T00:00:00.000Z",
    provider: "api-football",
    rows,
    droppedUnregisteredCompetition: 0,
  });
  const relDir = path.join(root, "data/research/football");
  mkdirSync(relDir, { recursive: true });
  writeFileSync(
    path.join(relDir, `${doc.meta.dateKst}-schedule-v1.json`),
    `${JSON.stringify(doc, null, 2)}\n`,
    "utf8",
  );
}

function fetcherOf(fixtures: FixtureRaw[]): FootballOfficialResultFixtureFetcher {
  return {
    async getFixtureById(fixtureId: number) {
      const hit = fixtures.find((f) => f.fixture.id === fixtureId) ?? null;
      return { fixture: hit, cached: false };
    },
  };
}

function dryRun20260820(cwd: string) {
  const doc = JSON.parse(
    readFileSync(path.join(cwd, FROZEN.schedule), "utf8"),
  ) as ScheduleDoc;
  const rows = doc.rows;
  const matched = rows.filter((r) => r.identityStatus === "MATCHED");
  const canonicalPending = rows.filter(
    (r) => r.predictionEligibility === "IDENTITY_BLOCKED",
  );
  const providerComplete = rows.filter(hasCompleteProviderFixtureIdentity);
  const resultCandidates = selectOfficialResultTargetRows(rows);
  const predictionCandidates = rows.filter(
    (r) => r.predictionEligibility === "ELIGIBLE_FORMAT",
  );
  const atletico = rows.find((r) => r.providerMatchId === "1570334")!;
  const celtic = rows.find((r) => r.providerMatchId === "1610923")!;
  return {
    rows: rows.length,
    matched: matched.length,
    canonicalPending: canonicalPending.length,
    providerComplete: providerComplete.length,
    hybridResultCandidates: resultCandidates.length,
    predictionCandidates: predictionCandidates.length,
    formatEligible: doc.meta.formatEligible,
    atletico: {
      providerComplete: hasCompleteProviderFixtureIdentity(atletico),
      resultCandidate: resultCandidates.some((r) => r.matchId === atletico.matchId),
      predictionCandidate: atletico.predictionEligibility === "ELIGIBLE_FORMAT",
    },
    celtic: {
      providerComplete: hasCompleteProviderFixtureIdentity(celtic),
      resultCandidate: resultCandidates.some((r) => r.matchId === celtic.matchId),
      predictionCandidate: celtic.predictionEligibility === "ELIGIBLE_FORMAT",
    },
    generatedAt: doc.meta.generatedAt,
  };
}

function writeAudit(cwd: string, dry: ReturnType<typeof dryRun20260820>): void {
  const document = {
    schemaVersion: SCHEMA,
    generatedAt: dry.generatedAt,
    researchOnly: true,
    networkCalls: 0,
    frozenMutations: 0,
    mandatoryCompletion: { dateKst: "2026-08-20", total: "60%", unchanged: true },
    policy: {
      scheduleIdentity:
        "NO CHANGE. Catalog miss remains IDENTITY_REVIEW_REQUIRED + IDENTITY_BLOCKED for prediction. Provider-complete rows stay stored.",
      canonicalEnrichment:
        "Still required for MATCHED / Odds / Snapshot / Prediction. Not required for Official Result eligibility.",
      resultEligibility:
        "hasCompleteProviderFixtureIdentity(row). Does not require homeTeamId/awayTeamId or ELIGIBLE_FORMAT.",
      oddsEligibility: "UNCHANGED. IDENTITY_BLOCKED skipped; canonical + team bridge required.",
      predictionEligibility: "UNCHANGED. Catalog miss stays IDENTITY_BLOCKED.",
      gradeEligibility:
        "Review iterates baseline prediction matches only. Result-only rows are not graded.",
      unregisteredCompetitionDropRemains: true,
    },
    "20260820DryRun": {
      artifactModified: false,
      rows: dry.rows,
      matched: dry.matched,
      canonicalPending: dry.canonicalPending,
      providerComplete: dry.providerComplete,
      hybridResultCandidates: dry.hybridResultCandidates,
      predictionCandidates: dry.predictionCandidates,
      atleticoMalaga: dry.atletico,
      celticLask: dry.celtic,
    },
    regression: {
      matchedBehaviorUnchanged: true,
      predictionGateUnchanged: true,
      oddsGateUnchanged: true,
      resultOnlyNotGraded: true,
      scheduleSchemaChanged: false,
    },
    leakage: {
      pregameFixtureIdentityUse: "SAFE",
      postgameCanonicalRewriteOfPrediction: "FORBIDDEN",
    },
    nextP0Candidate:
      "Football Big-5 Odds Team Bridge Readiness / Completion (not auto-executed)",
  };
  const abs = path.join(cwd, AUDIT_REL);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

async function main() {
  const cwd = process.cwd();
  const before = Object.fromEntries(
    Object.values(FROZEN).map((rel) => [rel, sha256File(path.join(cwd, rel))]),
  );
  assert.equal(before[FROZEN.schedule], EXPECTED_SHA256[FROZEN.schedule]);
  assert.equal(before[FROZEN.freezeClose], EXPECTED_SHA256[FROZEN.freezeClose]);

  const dry = dryRun20260820(cwd);
  assert.equal(dry.rows, 20);
  assert.equal(dry.matched, 18);
  assert.equal(dry.canonicalPending, 2);
  assert.equal(dry.providerComplete, 20);
  assert.equal(dry.hybridResultCandidates, 20);
  assert.equal(dry.predictionCandidates, 15);
  assert.equal(dry.atletico.providerComplete, true);
  assert.equal(dry.atletico.resultCandidate, true);
  assert.equal(dry.atletico.predictionCandidate, false);
  assert.equal(dry.celtic.providerComplete, true);
  assert.equal(dry.celtic.resultCandidate, true);
  assert.equal(dry.celtic.predictionCandidate, false);

  writeAudit(cwd, dry);

  // Schedule preservation: catalog miss stays on the artifact.
  const stored = assembleFootballScheduleArtifact({
    dateKst: "2026-08-20",
    generatedAt: "2026-08-19T15:49:51.881Z",
    fixtures: [
      {
        fixture: {
          id: 1570334,
          date: "2026-08-19T19:00:00.000Z",
          status: { short: "NS", long: "Not Started", elapsed: null },
          venue: { name: "Metropolitano Stadium", city: "Madrid" },
        },
        league: { id: 140, name: "La Liga", season: 2026, round: "Regular Season - 1" },
        teams: {
          home: { id: 530, name: "Atletico Madrid", winner: null },
          away: { id: 535, name: "Malaga", winner: null },
        },
        goals: { home: null, away: null },
      },
    ],
  });
  assert.equal(stored.droppedUnregisteredCompetition, 0);
  const storedRow = stored.document.rows[0]!;
  assert.equal(stored.document.rows.length, 1);
  assert.equal(storedRow.providerMatchId, "1570334");
  assert.equal(storedRow.homeProviderTeamId, "530");
  assert.equal(storedRow.awayProviderTeamId, "535");
  assert.equal(storedRow.seasonId, "2026");
  assert.equal(storedRow.kickoffTimeUtc, "2026-08-19T19:00:00.000Z");
  assert.equal(storedRow.homeTeamId, null);
  assert.equal(storedRow.predictionEligibility, "IDENTITY_BLOCKED");
  assert.equal(hasCompleteProviderFixtureIdentity(storedRow), true);

  // Case A — MATCHED league match
  const a = matchedRow();
  assert.equal(hasCompleteProviderFixtureIdentity(a), true);
  assert.equal(selectOfficialResultTargetRows([a])[0]?.matchId, a.matchId);
  assert.equal(a.predictionEligibility, "ELIGIBLE_FORMAT");
  const aResolved = resolveOfficialResultMatch({
    row: a,
    fixture: fixtureRaw({
      fixtureId: 1570337,
      homeId: 544,
      awayId: 797,
      fulltime: { home: 1, away: 1 },
    }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(aResolved.joinOk, true);
  assert.equal(aResolved.match.homeTeamId, "fb-team-v1-api-football-544");
  assert.equal(aResolved.match.gradingAllowed, true);
  const aOdds = joinScheduleRowToOddsEvent({
    row: a,
    events: [],
    teamBridge: [],
  });
  assert.notEqual(aOdds.status, "JOINED");

  // Case B — catalog missing / provider complete
  const b = catalogPendingRow();
  assert.equal(b.predictionEligibility, "IDENTITY_BLOCKED");
  assert.equal(hasCompleteProviderFixtureIdentity(b), true);
  assert.equal(selectOfficialResultTargetRows([b]).length, 1);
  identityFromScheduleRow(b);
  const bResolved = resolveOfficialResultMatch({
    row: b,
    fixture: fixtureRaw({}),
    resultObservedAt: OBSERVED,
  });
  assert.equal(bResolved.joinOk, true);
  assert.equal(bResolved.match.homeTeamId, null);
  assert.equal(bResolved.match.awayTeamId, null);
  assert.equal(bResolved.match.fixtureId, "1570334");
  assert.equal(bResolved.match.oneXTwoOutcome, "HOME");
  assert.equal(bResolved.match.gradingAllowed, true);
  const bOdds = joinScheduleRowToOddsEvent({
    row: b,
    events: [],
    teamBridge: [],
  });
  assert.equal(bOdds.status, "ODDS_EVENT_IDENTITY_REVIEW_REQUIRED");
  assert.ok(bOdds.reasonCodes.includes("CANONICAL_TEAM_ID_MISSING"));
  const pendingDoc = finalizeFootballScheduleDocument({
    dateKst: DATE,
    generatedAt: "2026-08-20T00:00:00.000Z",
    provider: "api-football",
    rows: [b],
    droppedUnregisteredCompetition: 0,
  });
  const planned = planOddsFetches({
    schedule: pendingDoc,
    observedAt: OBSERVED,
  });
  assert.equal(planned.skipped.identityBlocked, 1);
  assert.equal(planned.sportKeysToFetch.length, 0);

  // Case C — incomplete provider fixture
  const c = catalogPendingRow({ providerMatchId: "", matchId: "soccer-api-football-x" });
  assert.equal(hasCompleteProviderFixtureIdentity(c), false);
  assert.equal(selectOfficialResultTargetRows([c]).length, 0);
  assert.throws(
    () => identityFromScheduleRow(c),
    /FOOTBALL_OFFICIAL_RESULT_PROVIDER_IDENTITY_INCOMPLETE/,
  );
  const cKickoff = catalogPendingRow({ kickoffTimeUtc: null });
  assert.equal(hasCompleteProviderFixtureIdentity(cKickoff), false);

  // Case D — provider result identity mismatch
  const dJoin = joinProviderFixtureToScheduleRow(
    fixtureRaw({ homeId: 1111, awayId: 2222 }),
    b,
  );
  assert.equal(dJoin.ok, false);
  assert.ok(dJoin.reasonCodes.includes("HOME_AWAY_MISMATCH"));
  assert.ok(dJoin.reasonCodes.includes("RESULT_PROVIDER_IDENTITY_MISMATCH"));
  const dResolved = resolveOfficialResultMatch({
    row: b,
    fixture: fixtureRaw({ homeId: 1111, awayId: 2222 }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(dResolved.joinOk, false);
  assert.equal(dResolved.match.gradingAllowed, false);

  // Case E — UCL-like unsupported prediction, result still allowed
  const e = uclPendingRow();
  assert.notEqual(e.predictionEligibility, "ELIGIBLE_FORMAT");
  assert.equal(hasCompleteProviderFixtureIdentity(e), true);
  const eResolved = resolveOfficialResultMatch({
    row: e,
    fixture: fixtureRaw({
      fixtureId: 1610923,
      leagueId: 2,
      homeId: 247,
      awayId: 1026,
      fulltime: { home: 1, away: 0 },
    }),
    resultObservedAt: OBSERVED,
  });
  assert.equal(eResolved.joinOk, true);
  assert.equal(eResolved.match.oneXTwoOutcome, "HOME");
  assert.equal(eResolved.match.homeTeamId, null);

  const tmp = mkdtempSync(path.join(tmpdir(), "fb-hybrid-identity-"));
  try {
    writeSchedule(tmp, [b]);
    const sealedPending = await buildFootballOfficialResultV0({
      dateKst: DATE,
      generatedAt: GENERATED,
      resultObservedAt: OBSERVED,
      dryRun: true,
      rootDir: tmp,
      fetcher: fetcherOf([fixtureRaw({})]),
    });
    assert.equal(sealedPending.outcome, "SEALED");
    assert.equal(sealedPending.document?.matches[0]?.homeTeamId, null);
    assert.equal(sealedPending.document?.matches[0]?.fixtureId, "1570334");

    rmSync(path.join(tmp, "data/research/football"), { recursive: true, force: true });
    writeSchedule(tmp, [cKickoff]);
    await assert.rejects(
      () =>
        buildFootballOfficialResultV0({
          dateKst: DATE,
          generatedAt: GENERATED,
          resultObservedAt: OBSERVED,
          dryRun: true,
          rootDir: tmp,
          fetcher: fetcherOf([]),
        }),
      /FOOTBALL_OFFICIAL_RESULT_NO_ELIGIBLE_MATCHES/,
    );

    rmSync(path.join(tmp, "data/research/football"), { recursive: true, force: true });
    writeSchedule(tmp, [b]);
    await assert.rejects(
      () =>
        buildFootballOfficialResultV0({
          dateKst: DATE,
          generatedAt: GENERATED,
          resultObservedAt: OBSERVED,
          dryRun: true,
          rootDir: tmp,
          fetcher: fetcherOf([fixtureRaw({ homeId: 1111, awayId: 2222 })]),
        }),
      /FOOTBALL_OFFICIAL_RESULT_IDENTITY_UNRESOLVED/,
    );

    // MATCHED FT + catalog-pending NS: MATCHED still seals (extras do not block).
    rmSync(path.join(tmp, "data/research/football"), { recursive: true, force: true });
    writeSchedule(tmp, [matchedRow(), catalogPendingRow()]);
    const mixed = await buildFootballOfficialResultV0({
      dateKst: DATE,
      generatedAt: GENERATED,
      resultObservedAt: OBSERVED,
      dryRun: true,
      rootDir: tmp,
      fetcher: fetcherOf([
        fixtureRaw({
          fixtureId: 1570337,
          homeId: 544,
          awayId: 797,
          fulltime: { home: 1, away: 1 },
        }),
        fixtureRaw({
          fixtureId: 1570334,
          status: "NS",
          fulltime: { home: null, away: null },
        }),
      ]),
    });
    assert.equal(mixed.outcome, "SEALED");
    assert.deepEqual(
      mixed.document?.matches.map((m) => m.matchId),
      ["soccer-api-football-1570337"],
    );

    // MATCHED FT + catalog-pending FT: both collected.
    rmSync(path.join(tmp, "data/research/football"), { recursive: true, force: true });
    writeSchedule(tmp, [matchedRow(), catalogPendingRow()]);
    const mixedFt = await buildFootballOfficialResultV0({
      dateKst: DATE,
      generatedAt: GENERATED,
      resultObservedAt: OBSERVED,
      dryRun: true,
      rootDir: tmp,
      fetcher: fetcherOf([
        fixtureRaw({
          fixtureId: 1570337,
          homeId: 544,
          awayId: 797,
          fulltime: { home: 1, away: 1 },
        }),
        fixtureRaw({}),
      ]),
    });
    assert.equal(mixedFt.outcome, "SEALED");
    assert.equal(mixedFt.document?.matches.length, 2);
    const pendingSealed = mixedFt.document?.matches.find(
      (m) => m.fixtureId === "1570334",
    );
    assert.equal(pendingSealed?.homeTeamId, null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  // Grade: result-only row never enters scorecard denominator.
  const baseline: FootballMarketBaselinePredictionV0 = {
    meta: {
      schemaVersion: "football-market-baseline-prediction-v0",
      builderVersion: "football-market-baseline-prediction-builder-v0",
      dateKst: DATE,
      generatedAt: GENERATED,
      predictionAt: GENERATED,
      researchOnly: true,
      legalStatus: "NEEDS_LEGAL_REVIEW",
      predictionClass: "MARKET_BASELINE",
      market: "MONEYLINE_3WAY_1X2",
      baselineRule: "ARGMAX_NORMALIZED_MARKET_PROBABILITY",
      normalizationPolicy: "RENORMALIZE_FROZEN_MEDIAN_DEVIG_TO_SUM_1",
      model: "NONE",
      engine: "NONE",
      recommendation: "NONE",
      officialPickCount: 0,
      sourceSnapshotRel: "x",
      sourceSnapshotHash: "aa",
      snapshotMatches: 1,
      frozenInputGames: 1,
      baselinePredictedGames: 1,
      ambiguousMarketGames: 0,
      missedPredictionWindowGames: 0,
      nonFrozenInputGames: 0,
      predictionHash: "pred-hash",
    },
    matches: [
      {
        matchId: "soccer-api-football-1570337",
        baselineStatus: "MARKET_BASELINE_PREDICTED",
        sourceSnapshotStatus: "FROZEN",
        competitionId: "fb-comp-api-football-140",
        homeTeamId: "fb-team-v1-api-football-544",
        awayTeamId: "fb-team-v1-api-football-797",
        homeTeamName: "Deportivo La Coruna",
        awayTeamName: "Elche",
        kickoffTimeUtc: KICKOFF,
        sourceFreezeAt: GENERATED,
        sourceSelectedOddsObservationId: "obs",
        sourceSelectedOddsObservationHash: "obs-hash",
        rawMedianDevigHome: 0.4,
        rawMedianDevigDraw: 0.3,
        rawMedianDevigAway: 0.3,
        rawMedianSum: 1,
        normalizedHome: 0.4,
        normalizedDraw: 0.3,
        normalizedAway: 0.3,
        baselineRule: "ARGMAX_NORMALIZED_MARKET_PROBABILITY",
        researchOnly: true,
        baselineOutcome: "HOME",
        baselineProbability: 0.4,
      },
    ],
  };
  const resultDoc: FootballOfficialResultArtifactV0 = {
    meta: {
      schemaVersion: "football-official-result-v0",
      builderVersion: "football-official-result-builder-v0",
      dateKst: DATE,
      generatedAt: OBSERVED,
      resultObservedAt: OBSERVED,
      researchOnly: true,
      legalStatus: "NEEDS_LEGAL_REVIEW",
      provider: "API_FOOTBALL",
      marketSettlement: "REGULATION_90_MINUTES_1X2",
      sourceScheduleRel: FROZEN.schedule,
      sourceScheduleHash: "sched",
      scheduleMatches: 2,
      providerRequestedGames: 2,
      finalUsableGames: 2,
      notFinalGames: 0,
      blockedGames: 0,
      prediction: "NONE",
      engine: "NONE",
      recommendation: "NONE",
      resultArtifactHash: "result-hash",
    },
    matches: [
      {
        matchId: "soccer-api-football-1570337",
        fixtureId: "1570337",
        competitionId: "fb-comp-api-football-140",
        homeTeamId: "fb-team-v1-api-football-544",
        awayTeamId: "fb-team-v1-api-football-797",
        homeTeamName: "Deportivo La Coruna",
        awayTeamName: "Elche",
        kickoffTimeUtc: KICKOFF,
        providerStatusRaw: "FT",
        resultStatus: "FINAL",
        resultObservedAt: OBSERVED,
        regularTime: { home: 1, away: 1 },
        extraTime: null,
        penalties: null,
        finalScore: { home: 1, away: 1 },
        oneXTwoOutcome: "DRAW",
        advancementWinner: null,
        usability: "FINAL_USABLE",
        gradingAllowed: true,
        reasonCodes: [],
        resultHash: "hash-matched",
        researchOnly: true,
      },
      {
        matchId: "soccer-api-football-1570334",
        fixtureId: "1570334",
        competitionId: "fb-comp-api-football-140",
        homeTeamId: null,
        awayTeamId: null,
        homeTeamName: "Atletico Madrid",
        awayTeamName: "Malaga",
        kickoffTimeUtc: KICKOFF,
        providerStatusRaw: "FT",
        resultStatus: "FINAL",
        resultObservedAt: OBSERVED,
        regularTime: { home: 2, away: 1 },
        extraTime: null,
        penalties: null,
        finalScore: { home: 2, away: 1 },
        oneXTwoOutcome: "HOME",
        advancementWinner: null,
        usability: "FINAL_USABLE",
        gradingAllowed: true,
        reasonCodes: [],
        resultHash: "hash-pending",
        researchOnly: true,
      },
    ],
  };
  const graded = assembleFootballMarketBaselinePostgameReviewV0({
    dateKst: DATE,
    generatedAt: OBSERVED,
    baseline,
    baselineRel: "baseline.json",
    result: resultDoc,
    resultRel: "result.json",
  });
  assert.equal(graded.review.review.grades.length, 1);
  assert.equal(graded.review.review.grades[0]?.matchId, "soccer-api-football-1570337");
  assert.equal(graded.review.review.grades[0]?.verdict, "INCORRECT");
  assert.equal(
    graded.review.review.grades.some((g) => g.matchId === "soccer-api-football-1570334"),
    false,
  );
  assert.equal(graded.review.review.summary.incorrect, 1);
  assert.equal(graded.scorecard.scorecard.rows.length, 1);
  assert.equal(
    graded.scorecard.scorecard.rows.some(
      (r) => r.matchId === "soccer-api-football-1570334",
    ),
    false,
  );

  const after = Object.fromEntries(
    Object.values(FROZEN).map((rel) => [rel, sha256File(path.join(cwd, rel))]),
  );
  assert.deepEqual(after, before);
  assert.equal(existsSync(path.join(cwd, AUDIT_REL)), true);
  console.log("PASS football-schedule-hybrid-identity-gate-v1");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
