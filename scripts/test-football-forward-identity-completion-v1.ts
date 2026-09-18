/**
 * Official Forward identity completion v1 — committed evidence only.
 *
 *   npm run test:football-forward-identity-completion-v1
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NAV_ITEMS, FOOTER_NAV_ITEMS } from "../src/constants/navigation";
import {
  FORWARD_READ_MODEL_ERROR,
  ForwardReadModelError,
  identitiesEqual,
  loadCommittedIdentityIndex,
  loadCommittedScheduleIdentityIndex,
  loadFootballForwardEvidenceReadModel,
  mergeCommittedIdentityEvidence,
  parseFootballForwardPostgameReviewIdentities,
  parseScheduleIdentities,
  type ForwardGradedEvent,
  type ResolvedFixtureIdentity,
} from "../src/lib/football/forward-read-model-v1";
import {
  API_FOOTBALL_LAUNCHD,
  API_FOOTBALL_PUBLIC_FIXTURE_DISPLAY,
} from "../src/lib/provider-legal-state";
import FootballForwardResearchDashboard from "../src/components/internal/football/forward/FootballForwardResearchDashboard";
import FootballForwardEventCard from "../src/components/internal/football/forward/FootballForwardEventCard";

const ROOT = process.cwd();
const IDENTITY_DIR = join(ROOT, "src/lib/football/forward-read-model-v1");
const PAGE_REL = "src/app/internal/football/forward/page.tsx";
const PUBLIC_SURFACE_FILES = [
  "src/constants/navigation.ts",
  "src/components/layout/Header.tsx",
  "src/components/layout/Footer.tsx",
  "src/app/games/page.tsx",
  "src/app/api/football/fixtures/route.ts",
];

const EXISTING_RESOLVED: readonly ResolvedFixtureIdentity[] = [
  {
    fixtureId: 1570391,
    league: "La Liga",
    homeTeam: "Rayo Vallecano",
    awayTeam: "Espanyol",
  },
  {
    fixtureId: 1570383,
    league: "La Liga",
    homeTeam: "Alaves",
    awayTeam: "Valencia",
  },
  {
    fixtureId: 1570388,
    league: "La Liga",
    homeTeam: "Elche",
    awayTeam: "Real Madrid",
  },
  {
    fixtureId: 1570384,
    league: "La Liga",
    homeTeam: "Atletico Madrid",
    awayTeam: "Osasuna",
  },
];

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const KICKOFF = "2026-09-13T13:30:00.000Z";
const CREATED = "2026-09-13T07:32:18.853Z";
const SEALED = "2026-09-13T07:32:18.866Z";

function identitySource(): string {
  return readdirSync(IDENTITY_DIR)
    .filter((name) => name.startsWith("identity") && name.endsWith(".ts"))
    .map((name) => readFileSync(join(IDENTITY_DIR, name), "utf8"))
    .join("\n");
}

function readModelSource(): string {
  return readdirSync(IDENTITY_DIR)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => readFileSync(join(IDENTITY_DIR, name), "utf8"))
    .join("\n");
}

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof ForwardReadModelError, String(err));
    assert.equal(err.code, code);
    return;
  }
  assert.fail(`expected ${code}`);
}

function includedRow(overrides: Record<string, unknown> = {}) {
  return {
    fixtureId: 1001,
    kickoffUtc: KICKOFF,
    utcDate: "2026-09-13",
    predictedClass: "HOME",
    actualClass: "HOME",
    correct: true,
    pHome: 0.5,
    pDraw: 0.3,
    pAway: 0.2,
    maxProbability: 0.5,
    bucket: "50_60",
    snapshotHash: HASH_A,
    receiptHash: HASH_B,
    gradeHash: HASH_C,
    modelSourceHash:
      "6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf",
    validPregame: true,
    sealedAt: SEALED,
    predictionCreatedAt: CREATED,
    sealedAtBeforeKickoff: true,
    predictionCreatedAtBeforeKickoff: true,
    TARGET_RESULT_DATA_USED: false,
    ODDS_USED: false,
    MARKET_USED: false,
    PROVIDER_PREDICTION_USED: false,
    ...overrides,
  };
}

function validPayload(overrides: Record<string, unknown> = {}) {
  const included = (overrides.included as unknown[]) ?? [includedRow()];
  const totalGraded = included.length;
  const correctCount = included.filter(
    (row) => (row as { correct?: boolean }).correct === true,
  ).length;
  return {
    schemaVersion: "FOOTBALL_FORWARD_CUMULATIVE_EVALUATION_V1",
    FORWARD_MODEL: "football-poisson-research-v1",
    MODEL_HASH:
      "6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf",
    evaluatedAt: "2026-09-17T00:27:32.147Z",
    SAMPLE_INSUFFICIENT: true,
    ENGINE_CHANGE_ALLOWED: false,
    ODDS_USED: false,
    MARKET_USED: false,
    PROVIDER_PREDICTION_USED: false,
    TARGET_RESULT_DATA_USED: false,
    POSTGAME_DATA_USED_IN_PREDICTION: false,
    counts: {
      totalPredicted: totalGraded,
      totalGraded,
      pendingPredicted: 0,
      correct: correctCount,
      wrong: totalGraded - correctCount,
      accuracy: totalGraded === 0 ? 0 : correctCount / totalGraded,
      pass: 0,
      pendingPass: 0,
      integrityExclusions: 0,
    },
    checkpoint: {
      checkpointTarget: 25,
      currentN: totalGraded,
      remaining: Math.max(0, 25 - totalGraded),
      checkpointReached: totalGraded >= 25,
      ENGINE_CHANGE_ALLOWED: false,
    },
    hypothesisObservations: [
      {
        flag: "NO_DRAW_PREDICTIONS",
        HYPOTHESIS_ONLY: true,
        detail: "Included PREDICTED+GRADED cohort has zero DRAW predictions. Descriptive only.",
      },
    ],
    included,
    ...overrides,
  };
}

function postgameEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    payload: {
      schemaVersion: "yang-edge-2026-09-13-football-forward-postgame-review-v1",
      postgameContract: "FOOTBALL_FORWARD_POSTGAME_COLLECTION_V1",
      layer: "MODEL_FORWARD",
      predicted: [
        {
          fixtureId: 1001,
          leagueId: 140,
          league: "La Liga",
          homeTeam: "Levante",
          awayTeam: "Barcelona",
          actualScore: { home: 9, away: 9 },
          actualClass: "DRAW",
          pHome: 0.01,
          predictedClass: "AWAY",
          verdict: "WRONG",
        },
      ],
      pass: [],
      ...overrides,
    },
    sha256: HASH_A,
  };
}

function nonIdentitySnapshot(event: ForwardGradedEvent) {
  return {
    fixtureId: event.fixtureId,
    kickoffUtc: event.kickoffUtc,
    predictionCreatedAt: event.predictionCreatedAt,
    sealedAt: event.sealedAt,
    modelVersion: event.modelVersion,
    modelSourceHash: event.modelSourceHash,
    probabilities: event.probabilities,
    predictedClass: event.predictedClass,
    actualClass: event.actualClass,
    correct: event.correct,
    probabilityBucket: event.probabilityBucket,
    provenance: event.provenance,
  };
}

test("1 Official Forward cohort remains 15 events", () => {
  const model = loadFootballForwardEvidenceReadModel();
  assert.equal(model.sample.totalGraded, 15);
  assert.equal(model.gradedEvents.length, 15);
  assert.equal(new Set(model.gradedEvents.map((e) => e.fixtureId)).size, 15);
});

test("2 existing 4 resolved identities remain correct", () => {
  const model = loadFootballForwardEvidenceReadModel();
  for (const expected of EXISTING_RESOLVED) {
    const event = model.gradedEvents.find((e) => e.fixtureId === expected.fixtureId);
    assert.ok(event, String(expected.fixtureId));
    assert.equal(event.identityStatus, "RESOLVED");
    assert.equal(event.league, expected.league);
    assert.equal(event.homeTeam, expected.homeTeam);
    assert.equal(event.awayTeam, expected.awayTeam);
  }
});

test("3 newly admitted postgame parser requires expected schema", () => {
  expectCode(
    () => parseFootballForwardPostgameReviewIdentities({ foo: 1 }),
    FORWARD_READ_MODEL_ERROR.FORWARD_IDENTITY_SOURCE_INVALID,
  );
  expectCode(
    () =>
      parseFootballForwardPostgameReviewIdentities(
        postgameEnvelope({ schemaVersion: "not-a-postgame-schema" }),
      ),
    FORWARD_READ_MODEL_ERROR.FORWARD_IDENTITY_SOURCE_INVALID,
  );
  expectCode(
    () =>
      parseFootballForwardPostgameReviewIdentities(
        postgameEnvelope({ layer: "R1" }),
      ),
    FORWARD_READ_MODEL_ERROR.FORWARD_IDENTITY_SOURCE_INVALID,
  );
  expectCode(
    () =>
      parseFootballForwardPostgameReviewIdentities(
        postgameEnvelope({ predicted: "nope" }),
      ),
    FORWARD_READ_MODEL_ERROR.FORWARD_IDENTITY_SOURCE_INVALID,
  );
  const schedule = parseScheduleIdentities({
    meta: { schemaVersion: "football-odds-v1" },
    rows: [
      {
        providerMatchId: "1001",
        homeTeamName: "A",
        awayTeamName: "B",
        competitionId: "laliga",
      },
    ],
  });
  assert.deepEqual(schedule, []);
});

test("4 exact fixtureId joins successfully", () => {
  const parsed = parseFootballForwardPostgameReviewIdentities(postgameEnvelope());
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].fixtureId, 1001);
  assert.equal(parsed[0].league, "La Liga");
  assert.equal(parsed[0].homeTeam, "Levante");
  assert.equal(parsed[0].awayTeam, "Barcelona");
  const model = loadFootballForwardEvidenceReadModel({
    document: validPayload(),
    identityIndex: new Map([[1001, parsed[0]]]),
  });
  assert.equal(model.gradedEvents[0].identityStatus, "RESOLVED");
  assert.equal(model.gradedEvents[0].homeTeam, "Levante");
});

test("5 unknown fixtureId is ignored", () => {
  const identity: ResolvedFixtureIdentity = {
    fixtureId: 888888,
    league: "La Liga",
    homeTeam: "Ghost Home",
    awayTeam: "Ghost Away",
  };
  const model = loadFootballForwardEvidenceReadModel({
    document: validPayload(),
    identityIndex: new Map([[888888, identity]]),
  });
  assert.equal(model.gradedEvents[0].fixtureId, 1001);
  assert.equal(model.gradedEvents[0].identityStatus, "UNRESOLVED");
  assert.equal(model.gradedEvents[0].homeTeam, null);
});

test("6 no date/order/fuzzy fallback exists", () => {
  const source = identitySource();
  for (const forbidden of [
    "levenshtein",
    "fuzzy",
    "closest",
    "similar",
    "approx",
    "nearest",
    "kickoffUtc ===",
    "sameDate",
    "dateOrder",
  ]) {
    assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
});

test("7 incomplete identity tuple does not resolve event", () => {
  const parsed = parseFootballForwardPostgameReviewIdentities(
    postgameEnvelope({
      predicted: [
        {
          fixtureId: 1001,
          leagueId: 140,
          league: "La Liga",
          homeTeam: "Levante",
        },
      ],
    }),
  );
  assert.deepEqual(parsed, []);
  const model = loadFootballForwardEvidenceReadModel({
    document: validPayload(),
    identityIndex: new Map(),
  });
  assert.equal(model.gradedEvents[0].identityStatus, "UNRESOLVED");
});

test("8 two sources with same identity agree safely", () => {
  const a: ResolvedFixtureIdentity = {
    fixtureId: 1001,
    league: "La Liga",
    homeTeam: "Levante",
    awayTeam: "Barcelona",
  };
  const b = { ...a };
  const merged = mergeCommittedIdentityEvidence([[a], [b]]);
  assert.equal(merged.size, 1);
  assert.ok(identitiesEqual(merged.get(1001)!, a));
});

test("9 two sources with conflicting identity fail FORWARD_IDENTITY_CONFLICT", () => {
  const a: ResolvedFixtureIdentity = {
    fixtureId: 1001,
    league: "La Liga",
    homeTeam: "Levante",
    awayTeam: "Barcelona",
  };
  const b: ResolvedFixtureIdentity = {
    fixtureId: 1001,
    league: "La Liga",
    homeTeam: "Levante",
    awayTeam: "Real Madrid",
  };
  expectCode(
    () => mergeCommittedIdentityEvidence([[a], [b]]),
    FORWARD_READ_MODEL_ERROR.FORWARD_IDENTITY_CONFLICT,
  );
});

test("10 UNRESOLVED row is retained", () => {
  const model = loadFootballForwardEvidenceReadModel({
    document: validPayload({
      included: [includedRow({ fixtureId: 9999999 })],
    }),
    identityIndex: new Map(),
  });
  assert.equal(model.gradedEvents.length, 1);
  assert.equal(model.gradedEvents[0].fixtureId, 9999999);
  assert.equal(model.gradedEvents[0].identityStatus, "UNRESOLVED");
  assert.equal(model.gradedEvents[0].league, null);
  assert.equal(model.gradedEvents[0].homeTeam, null);
  assert.equal(model.gradedEvents[0].awayTeam, null);
});

test("11 no Provider/network invocation", () => {
  const source = readModelSource();
  for (const forbidden of [
    'from "../api-football-provider"',
    'from "@/lib/football/api-football-provider"',
    "get-football-provider",
    "the-odds-api",
    "axios",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.equal(/\bfetch\s*\(/.test(source), false);
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = ((..._args: unknown[]) => {
    fetchCalls += 1;
    throw new Error("NETWORK_FORBIDDEN");
  }) as typeof fetch;
  try {
    loadFootballForwardEvidenceReadModel();
    parseFootballForwardPostgameReviewIdentities(postgameEnvelope());
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(fetchCalls, 0);
});

test("12 no generic arbitrary-JSON identity scraping", () => {
  const source = readFileSync(
    join(IDENTITY_DIR, "identity-postgame-review.ts"),
    "utf8",
  );
  assert.equal(source.includes("successReview"), false);
  assert.equal(source.includes("failureReview"), false);
  assert.equal(source.includes("JSON.stringify"), false);
  const decoy = postgameEnvelope({
    predicted: [],
    pass: [],
    successReview: {
      fixtureId: 1001,
      homeTeam: "ShouldNotJoin",
      awayTeam: "ShouldNotJoin",
      league: "La Liga",
      leagueId: 140,
    },
  });
  const parsed = parseFootballForwardPostgameReviewIdentities(decoy);
  assert.deepEqual(parsed, []);
});

test("13 identity enrichment does not modify probabilities", () => {
  const before = loadFootballForwardEvidenceReadModel({
    identityIndex: loadCommittedScheduleIdentityIndex(ROOT),
  });
  const after = loadFootballForwardEvidenceReadModel();
  for (const event of before.gradedEvents) {
    const next = after.gradedEvents.find((e) => e.fixtureId === event.fixtureId);
    assert.ok(next);
    assert.deepEqual(next.probabilities, event.probabilities);
  }
});

test("14 identity enrichment does not modify predictedClass", () => {
  const before = loadFootballForwardEvidenceReadModel({
    identityIndex: loadCommittedScheduleIdentityIndex(ROOT),
  });
  const after = loadFootballForwardEvidenceReadModel();
  for (const event of before.gradedEvents) {
    const next = after.gradedEvents.find((e) => e.fixtureId === event.fixtureId);
    assert.ok(next);
    assert.equal(next.predictedClass, event.predictedClass);
  }
});

test("15 identity enrichment does not modify actualClass", () => {
  const before = loadFootballForwardEvidenceReadModel({
    identityIndex: loadCommittedScheduleIdentityIndex(ROOT),
  });
  const after = loadFootballForwardEvidenceReadModel();
  for (const event of before.gradedEvents) {
    const next = after.gradedEvents.find((e) => e.fixtureId === event.fixtureId);
    assert.ok(next);
    assert.equal(next.actualClass, event.actualClass);
  }
});

test("16 identity enrichment does not modify correct/grade", () => {
  const before = loadFootballForwardEvidenceReadModel({
    identityIndex: loadCommittedScheduleIdentityIndex(ROOT),
  });
  const after = loadFootballForwardEvidenceReadModel();
  for (const event of before.gradedEvents) {
    const next = after.gradedEvents.find((e) => e.fixtureId === event.fixtureId);
    assert.ok(next);
    assert.equal(next.correct, event.correct);
    assert.equal(next.provenance.gradeHash, event.provenance.gradeHash);
  }
});

test("17 identity enrichment does not modify predictionCreatedAt", () => {
  const before = loadFootballForwardEvidenceReadModel({
    identityIndex: loadCommittedScheduleIdentityIndex(ROOT),
  });
  const after = loadFootballForwardEvidenceReadModel();
  for (const event of before.gradedEvents) {
    const next = after.gradedEvents.find((e) => e.fixtureId === event.fixtureId);
    assert.ok(next);
    assert.equal(next.predictionCreatedAt, event.predictionCreatedAt);
  }
});

test("18 identity enrichment does not modify sealedAt", () => {
  const before = loadFootballForwardEvidenceReadModel({
    identityIndex: loadCommittedScheduleIdentityIndex(ROOT),
  });
  const after = loadFootballForwardEvidenceReadModel();
  for (const event of before.gradedEvents) {
    const next = after.gradedEvents.find((e) => e.fixtureId === event.fixtureId);
    assert.ok(next);
    assert.equal(next.sealedAt, event.sealedAt);
  }
});

test("19 identity enrichment does not modify provenance hashes", () => {
  const before = loadFootballForwardEvidenceReadModel({
    identityIndex: loadCommittedScheduleIdentityIndex(ROOT),
  });
  const after = loadFootballForwardEvidenceReadModel();
  for (const event of before.gradedEvents) {
    const next = after.gradedEvents.find((e) => e.fixtureId === event.fixtureId);
    assert.ok(next);
    assert.deepEqual(next.provenance, event.provenance);
    assert.equal(next.modelSourceHash, event.modelSourceHash);
  }
});

test("20 postgame identity source does not copy score/result into prediction", () => {
  const parsed = parseFootballForwardPostgameReviewIdentities(postgameEnvelope());
  assert.deepEqual(Object.keys(parsed[0]).sort(), [
    "awayTeam",
    "fixtureId",
    "homeTeam",
    "league",
  ]);
  const model = loadFootballForwardEvidenceReadModel({
    document: validPayload({
      included: [
        includedRow({
          predictedClass: "HOME",
          actualClass: "HOME",
          correct: true,
          pHome: 0.5,
          pDraw: 0.3,
          pAway: 0.2,
        }),
      ],
    }),
    identityIndex: new Map([[1001, parsed[0]]]),
  });
  const event = model.gradedEvents[0];
  assert.equal(event.predictedClass, "HOME");
  assert.equal(event.actualClass, "HOME");
  assert.equal(event.correct, true);
  assert.equal(event.probabilities.home, 0.5);
  assert.equal(event.integrity ? undefined : undefined, undefined);
  assert.equal(model.integrity.postgameDataUsedInPrediction, false);
});

test("21 ODDS_USED remains false", () => {
  const model = loadFootballForwardEvidenceReadModel();
  assert.equal(model.integrity.oddsUsed, false);
  for (const event of model.gradedEvents) {
    assert.equal(event.provenance.oddsUsed, false);
  }
});

test("22 TARGET_RESULT_DATA_USED remains false", () => {
  const model = loadFootballForwardEvidenceReadModel();
  assert.equal(model.integrity.targetResultDataUsed, false);
  for (const event of model.gradedEvents) {
    assert.equal(event.provenance.targetResultDataUsed, false);
  }
});

test("23 PROVIDER_PREDICTION_USED remains false", () => {
  const model = loadFootballForwardEvidenceReadModel();
  assert.equal(model.integrity.providerPredictionUsed, false);
  for (const event of model.gradedEvents) {
    assert.equal(event.provenance.providerPredictionUsed, false);
  }
});

test("24 internal prototype still renders 15 cards", () => {
  const model = loadFootballForwardEvidenceReadModel();
  const html = renderToStaticMarkup(
    createElement(FootballForwardResearchDashboard, { model }),
  );
  assert.equal(model.gradedEvents.length, 15);
  for (const event of model.gradedEvents) {
    assert.ok(html.includes(`data-forward-event="${event.fixtureId}"`));
  }
});

test("25 newly resolved event displays team names", () => {
  const model = loadFootballForwardEvidenceReadModel();
  const html = renderToStaticMarkup(
    createElement(FootballForwardResearchDashboard, { model }),
  );
  const newly = model.gradedEvents.find((e) => e.fixtureId === 1575159);
  assert.ok(newly);
  assert.equal(newly.identityStatus, "RESOLVED");
  assert.ok(newly.homeTeam);
  assert.ok(newly.awayTeam);
  assert.ok(html.includes(`${newly.homeTeam} vs ${newly.awayTeam}`));
});

test("26 newly resolved event displays league", () => {
  const model = loadFootballForwardEvidenceReadModel();
  const html = renderToStaticMarkup(
    createElement(FootballForwardResearchDashboard, { model }),
  );
  const newly = model.gradedEvents.find((e) => e.fixtureId === 1575159);
  assert.ok(newly);
  assert.equal(newly.league, "Bundesliga");
  assert.ok(html.includes("Bundesliga"));
});

test("27 remaining unresolved event, if any, still displays fixtureId safely", () => {
  const model = loadFootballForwardEvidenceReadModel();
  const html = renderToStaticMarkup(
    createElement(FootballForwardResearchDashboard, { model }),
  );
  const unresolved = model.gradedEvents.filter((e) => e.identityStatus === "UNRESOLVED");
  for (const event of unresolved) {
    assert.ok(html.includes(`Fixture #${event.fixtureId}`));
  }
  const sample = model.gradedEvents[0];
  const cardHtml = renderToStaticMarkup(
    createElement(FootballForwardEventCard, {
      event: {
        ...sample,
        identityStatus: "UNRESOLVED",
        league: null,
        homeTeam: null,
        awayTeam: null,
      },
    }),
  );
  assert.ok(cardHtml.includes(`Fixture #${sample.fixtureId}`));
});

test("28 no public nav entry", () => {
  assert.equal(
    NAV_ITEMS.some((item) => item.href.includes("/internal/football/forward")),
    false,
  );
  assert.equal(
    FOOTER_NAV_ITEMS.some((item) => item.href.includes("/internal/football/forward")),
    false,
  );
  for (const rel of PUBLIC_SURFACE_FILES) {
    const text = readFileSync(join(ROOT, rel), "utf8");
    assert.equal(text.includes("/internal/football/forward"), false, rel);
  }
});

test("29 noindex / nofollow unchanged", () => {
  const page = readFileSync(join(ROOT, PAGE_REL), "utf8");
  assert.ok(page.includes("index: false"));
  assert.ok(page.includes("follow: false"));
});

test("30 no logo/image introduced", () => {
  const source = identitySource();
  assert.equal(source.includes("next/image"), false);
  assert.equal(/<img\b/.test(source), false);
  assert.equal(/\.(png|jpe?g|gif|webp|svg)/i.test(source), false);
});

test("31 Read Model regression PASS", () => {
  const model = loadFootballForwardEvidenceReadModel();
  assert.equal(model.schemaVersion, "FOOTBALL_FORWARD_EVIDENCE_READ_MODEL_V1");
  assert.equal(model.sample.totalGraded, 15);
  assert.equal(model.integrity.oddsUsed, false);
  assert.equal(model.integrity.postgameDataUsedInPrediction, false);
  assert.equal(model.model.version, "football-poisson-research-v1");
});

test("32 Internal Prototype regression PASS", () => {
  const model = loadFootballForwardEvidenceReadModel();
  const html = renderToStaticMarkup(
    createElement(FootballForwardResearchDashboard, { model }),
  );
  assert.ok(html.includes("Official Forward Football Research"));
  assert.equal(model.gradedEvents.length, 15);
});

test("33 API-Football Legal State regression PASS", () => {
  assert.equal(API_FOOTBALL_LAUNCHD, "LEGAL_PASS");
  assert.equal(API_FOOTBALL_PUBLIC_FIXTURE_DISPLAY, "LEGAL_CONDITIONAL");
});

test("non-identity fields immutable across the full cohort", () => {
  const before = loadFootballForwardEvidenceReadModel({
    identityIndex: loadCommittedScheduleIdentityIndex(ROOT),
  });
  const after = loadFootballForwardEvidenceReadModel();
  assert.equal(before.gradedEvents.length, 15);
  assert.equal(after.gradedEvents.length, 15);
  for (const event of before.gradedEvents) {
    const next = after.gradedEvents.find((e) => e.fixtureId === event.fixtureId);
    assert.ok(next);
    assert.deepEqual(nonIdentitySnapshot(next), nonIdentitySnapshot(event));
  }
});

test("merged committed index covers the Official Forward cohort", () => {
  const index = loadCommittedIdentityIndex(ROOT);
  const model = loadFootballForwardEvidenceReadModel();
  for (const event of model.gradedEvents) {
    const identity = index.get(event.fixtureId);
    if (event.identityStatus === "RESOLVED") {
      assert.ok(identity);
      assert.equal(event.league, identity.league);
      assert.equal(event.homeTeam, identity.homeTeam);
      assert.equal(event.awayTeam, identity.awayTeam);
    } else {
      assert.equal(identity, undefined);
    }
  }
});

test("EPL leagueId 39 canonicalizes to Premier League", () => {
  const parsed = parseFootballForwardPostgameReviewIdentities(
    postgameEnvelope({
      predicted: [
        {
          fixtureId: 1557404,
          leagueId: 39,
          league: "EPL",
          homeTeam: "Manchester United",
          awayTeam: "Manchester City",
        },
      ],
    }),
  );
  assert.equal(parsed[0].league, "Premier League");
});
