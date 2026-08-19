/**
 * Football Odds Bridge Candidate Intake v1 tests.
 * Run: npm run test:football-odds-bridge-candidates-v1
 *
 * Network 0. Does not mutate team-bridge or frozen artifacts.
 * Does not live-run 2026-08-20 candidate intake.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  finalizeFootballScheduleDocument,
  footballScheduleV1Rel,
  type FootballScheduleRowV1,
} from "../src/lib/football/core";
import {
  assembleFootballOddsBridgeCandidateIntake,
  assertLiveOddsBridgeIntakeProvider,
  buildFootballOddsBridgeCandidateIntakeV1,
  sportKeysForIntakeTargets,
} from "../src/lib/football/odds-bridge-intake-v1";
import {
  FOOTBALL_ODDS_TEAM_BRIDGE_V1,
  parseFootballScheduleArtifact,
  planOddsFetches,
  type FootballOddsTeamBridgeEntry,
} from "../src/lib/football/odds-1x2-v1";
import { DummyOddsProvider, emptyUsage } from "../src/lib/odds";
import type { OddsEventListing, OddsProvider } from "../src/lib/odds/types";

const HOME_ID = "fb-team-v1-api-football-9001";
const AWAY_ID = "fb-team-v1-api-football-9002";
const KICKOFF = "2026-08-21T14:00:00.000Z";
const OBSERVED = "2026-08-21T12:00:00.000Z";
const GENERATED = "2026-08-21T12:01:00.000Z";
const DATE = "2026-08-21";

const AUDIT_REL =
  "data/audits/football-daily-odds-bridge-candidate-intake-v1.json";

const FROZEN_REL = [
  "data/research/football/2026-08-20-schedule-v1.json",
  "data/research/football/2026-08-18-1x2-odds-v1.json",
  "data/audits/football-big5-odds-team-bridge-readiness-v1.json",
  "data/audits/football-schedule-hybrid-identity-gate-v1.json",
] as const;

const FUNCTIONAL_FORBIDDEN = [
  "src/lib/football/odds-1x2-v1/team-bridge.ts",
  "src/lib/football/odds-1x2-v1/sport-keys.ts",
  "src/lib/football/odds-1x2-v1/build.ts",
  "src/lib/football/odds-1x2-v1/event-join.ts",
];

const TEST_BRIDGE: FootballOddsTeamBridgeEntry[] = [
  {
    canonicalTeamId: HOME_ID,
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Home FC"],
    source: "test-fixture",
  },
  {
    canonicalTeamId: AWAY_ID,
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Away FC"],
    source: "test-fixture",
  },
];

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function eligibleRow(
  over: Partial<FootballScheduleRowV1> = {},
): FootballScheduleRowV1 {
  return {
    dateKst: DATE,
    matchId: "soccer-api-football-999001",
    provider: "api-football",
    providerMatchId: "999001",
    competitionId: "fb-comp-api-football-39",
    seasonId: "2026",
    competitionType: "LEAGUE",
    matchFormat: "LEAGUE_MATCH",
    homeTeamId: HOME_ID,
    awayTeamId: AWAY_ID,
    homeProviderTeamId: "9001",
    awayProviderTeamId: "9002",
    homeTeamName: "Home Display",
    awayTeamName: "Away Display",
    kickoffTimeUtc: KICKOFF,
    status: "SCHEDULED",
    venue: "Test",
    identityStatus: "MATCHED",
    identityReasons: [],
    predictionEligibility: "ELIGIBLE_FORMAT",
    researchOnly: true,
    ...over,
  };
}

function listing(over: Partial<OddsEventListing> = {}): OddsEventListing {
  return {
    externalEventId: "evt-1",
    sportKey: "soccer_epl",
    homeTeam: "Home FC",
    awayTeam: "New Odds Away",
    commenceTime: KICKOFF,
    ...over,
  };
}

class RecordingProvider implements OddsProvider {
  readonly kind = "the-odds-api" as const;
  listEventsCalls = 0;
  getOddsCalls = 0;
  constructor(private readonly byKey: Record<string, OddsEventListing[]>) {}
  async listEvents(sportKey: string) {
    this.listEventsCalls += 1;
    return { events: this.byKey[sportKey] ?? [], usage: emptyUsage() };
  }
  async getOdds() {
    this.getOddsCalls += 1;
    throw new Error("GET_ODDS_CALLED");
  }
}

function scheduleOf(rows: FootballScheduleRowV1[]) {
  return finalizeFootballScheduleDocument({
    dateKst: rows[0]?.dateKst ?? DATE,
    generatedAt: "2026-08-21T00:00:00.000Z",
    provider: "api-football",
    rows,
    droppedUnregisteredCompetition: 0,
  });
}

function assemble(input: {
  rows: FootballScheduleRowV1[];
  teamBridge?: FootballOddsTeamBridgeEntry[];
  events?: OddsEventListing[];
  sportKey?: string;
  observedAt?: string;
  eventsFetched?: boolean;
  providerCalls?: number;
  failedSportKeys?: string[];
}) {
  const schedule = scheduleOf(input.rows);
  const sportKey = input.sportKey ?? "soccer_epl";
  return assembleFootballOddsBridgeCandidateIntake({
    schedule,
    observedAt: input.observedAt ?? OBSERVED,
    generatedAt: GENERATED,
    teamBridge: input.teamBridge ?? TEST_BRIDGE,
    eventsBySportKey: { [sportKey]: input.events ?? [] },
    uniqueSportKeysRequested: [sportKey],
    providerCalls: input.providerCalls ?? 0,
    failedSportKeys: input.failedSportKeys,
    eventsFetched: input.eventsFetched ?? true,
  });
}

function assertNoOddsPrices(value: unknown): void {
  const text = JSON.stringify(value);
  for (const needle of [
    "bookmakers",
    "bestHomeOdds",
    "impliedHomeProbability",
    "homeDecimal",
    "devigHome",
    "overround",
  ]) {
    assert.equal(text.includes(`"${needle}"`), false, `price field ${needle}`);
  }
}

function writeTmpSchedule(
  cwd: string,
  rows: FootballScheduleRowV1[],
): ReturnType<typeof scheduleOf> {
  const schedule = scheduleOf(rows);
  const rel = footballScheduleV1Rel(schedule.meta.dateKst);
  const abs = path.join(cwd, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(schedule, null, 2)}\n`, "utf8");
  return schedule;
}

async function main() {
  const cwd = process.cwd();
  const before = Object.fromEntries(
    FROZEN_REL.map((rel) => [rel, sha256File(path.join(cwd, rel))]),
  );

  const homeOnlyBridge = TEST_BRIDGE.filter((e) => e.canonicalTeamId === HOME_ID);

  // Historical replay: 08-18 Deportivo / Elche with in-memory bridge stripped.
  const schedule0818 = parseFootballScheduleArtifact(
    JSON.parse(
      readFileSync(
        path.join(cwd, "data/research/football/2026-08-18-schedule-v1.json"),
        "utf8",
      ),
    ),
  );
  const evidence0818 = JSON.parse(
    readFileSync(
      path.join(
        cwd,
        "data/research/football/2026-08-18-la-liga-odds-identity-evidence-v0.json",
      ),
      "utf8",
    ),
  ) as {
    events: Array<{
      oddsProviderEventId: string;
      sportKey: string;
      rawHomeTeam: string;
      rawAwayTeam: string;
      commenceTime: string;
    }>;
  };
  const replayEvents: OddsEventListing[] = evidence0818.events.map((e) => ({
    externalEventId: e.oddsProviderEventId,
    sportKey: e.sportKey,
    homeTeam: e.rawHomeTeam,
    awayTeam: e.rawAwayTeam,
    commenceTime: e.commenceTime,
  }));
  const strippedBridge = FOOTBALL_ODDS_TEAM_BRIDGE_V1.filter(
    (e) =>
      e.canonicalTeamId !== "fb-team-v1-api-football-544" &&
      e.canonicalTeamId !== "fb-team-v1-api-football-797",
  );
  const replay = assembleFootballOddsBridgeCandidateIntake({
    schedule: schedule0818,
    observedAt: "2026-08-17T14:17:15.455Z",
    generatedAt: GENERATED,
    teamBridge: strippedBridge,
    eventsBySportKey: { soccer_spain_la_liga: replayEvents },
    uniqueSportKeysRequested: ["soccer_spain_la_liga"],
    providerCalls: 1,
    eventsFetched: true,
  });
  const replayRow = replay.rows.find(
    (r) => r.matchId === "soccer-api-football-1570337",
  );
  assert.ok(replayRow);
  assert.equal(
    replayRow.candidateStatus,
    "PENDING_REVIEW_SINGLE_EVENT_UNANCHORED",
  );
  assert.equal(replayRow.reviewStatus, "PENDING");
  assert.equal(replayRow.candidateEvents[0]?.externalEventId, "7b9f4d89d66c48e0c496aab1679e4ae4");
  assert.equal(replayRow.candidateEvents[0]?.homeTeamExact, "Deportivo La Coruña");
  assert.equal(replayRow.candidateEvents[0]?.awayTeamExact, "Elche CF");
  assert.equal(replayRow.candidateMappings.length, 2);
  assert.equal(replayRow.home.canonicalTeamId, "fb-team-v1-api-football-544");
  assert.equal(replayRow.away.canonicalTeamId, "fb-team-v1-api-football-797");
  assert.ok(!replayRow.reasonCodes.includes("APPROVED"));
  assertNoOddsPrices(replay);

  const restored = assembleFootballOddsBridgeCandidateIntake({
    schedule: schedule0818,
    observedAt: "2026-08-17T14:17:15.455Z",
    generatedAt: GENERATED,
    teamBridge: FOOTBALL_ODDS_TEAM_BRIDGE_V1,
    eventsBySportKey: { soccer_spain_la_liga: replayEvents },
    uniqueSportKeysRequested: [],
    providerCalls: 0,
    eventsFetched: true,
  });
  assert.equal(restored.rows[0]?.candidateStatus, "NO_CANDIDATE_NEEDED");
  assert.equal(
    sportKeysForIntakeTargets({
      schedule: schedule0818,
      teamBridge: FOOTBALL_ODDS_TEAM_BRIDGE_V1,
    }).length,
    0,
  );

  // Single-side anchor.
  const single = assemble({
    rows: [eligibleRow()],
    teamBridge: homeOnlyBridge,
    events: [listing()],
  });
  assert.equal(
    single.rows[0]?.candidateStatus,
    "PENDING_REVIEW_SINGLE_SIDE_ANCHORED",
  );
  assert.equal(single.rows[0]?.reviewStatus, "PENDING");
  assert.equal(single.rows[0]?.candidateMappings.length, 1);
  assert.equal(single.rows[0]?.candidateMappings[0]?.canonicalTeamId, AWAY_ID);
  assert.equal(single.rows[0]?.candidateMappings[0]?.oddsExactName, "New Odds Away");
  assert.equal(single.rows[0]?.candidateMappings[0]?.side, "away");
  assert.equal(
    single.rows[0]?.candidateMappings[0]?.confidenceClass,
    "HIGH_CONFIDENCE_REVIEW_CANDIDATE",
  );
  assert.equal(single.meta.predictionInput, false);
  assert.equal(single.rows[0]?.pregameUsable, true);

  // Reverse single-side (away anchored).
  const reverse = assemble({
    rows: [eligibleRow()],
    teamBridge: TEST_BRIDGE.filter((e) => e.canonicalTeamId === AWAY_ID),
    events: [listing({ homeTeam: "New Odds Home", awayTeam: "Away FC" })],
  });
  assert.equal(
    reverse.rows[0]?.candidateStatus,
    "PENDING_REVIEW_SINGLE_SIDE_ANCHORED",
  );
  assert.equal(reverse.rows[0]?.candidateMappings[0]?.side, "home");
  assert.equal(reverse.rows[0]?.candidateMappings[0]?.oddsExactName, "New Odds Home");

  // Ambiguous: two events, no anchor.
  const ambiguous = assemble({
    rows: [eligibleRow()],
    teamBridge: [],
    events: [
      listing({ externalEventId: "a", homeTeam: "A1", awayTeam: "A2" }),
      listing({ externalEventId: "b", homeTeam: "B1", awayTeam: "B2" }),
    ],
  });
  assert.equal(ambiguous.rows[0]?.candidateStatus, "AMBIGUOUS_EVENT_CANDIDATES");
  assert.equal(ambiguous.rows[0]?.candidateMappings.length, 0);
  assert.equal(ambiguous.rows[0]?.reviewStatus, "NOT_APPLICABLE");

  // Orientation conflict.
  const oriented = assemble({
    rows: [eligibleRow()],
    teamBridge: homeOnlyBridge,
    events: [
      listing({ homeTeam: "Other Home", awayTeam: "Home FC" }),
    ],
  });
  assert.equal(oriented.rows[0]?.candidateStatus, "ORIENTATION_CONFLICT");
  assert.equal(oriented.rows[0]?.candidateMappings.length, 0);

  // Canonical missing.
  const missing = assemble({
    rows: [
      eligibleRow({
        homeTeamId: null,
        awayTeamId: null,
        identityStatus: "IDENTITY_BLOCKED",
        predictionEligibility: "IDENTITY_BLOCKED",
        identityReasons: ["UNKNOWN_PROVIDER_TEAM_ID"],
      }),
    ],
    events: [listing()],
  });
  assert.equal(missing.rows[0]?.candidateStatus, "CANONICAL_IDENTITY_BLOCKED");
  assert.equal(missing.rows[0]?.home.canonicalTeamId, null);
  assert.equal(missing.rows[0]?.candidateMappings.length, 0);
  assert.ok(
    !JSON.stringify(missing.rows[0]).includes("fb-team-v1-api-football-9001"),
  );

  // Post-kickoff.
  const late = assemble({
    rows: [eligibleRow()],
    teamBridge: homeOnlyBridge,
    events: [listing()],
    observedAt: "2026-08-21T14:00:00.000Z",
  });
  assert.equal(
    late.rows[0]?.candidateStatus,
    "PENDING_REVIEW_SINGLE_SIDE_ANCHORED",
  );
  assert.equal(late.rows[0]?.timingClass, "LATE_IDENTITY_EVIDENCE");
  assert.equal(late.rows[0]?.pregameUsable, false);
  assert.equal(late.meta.predictionInput, false);
  assert.ok(late.rows[0]?.reasonCodes.includes("LATE_IDENTITY_EVIDENCE"));

  // Zero event.
  const zero = assemble({
    rows: [eligibleRow()],
    teamBridge: [],
    events: [],
  });
  assert.equal(zero.rows[0]?.candidateStatus, "NO_EVENT_CANDIDATE");

  // Sport-key missing: no provider key requested by classifier.
  const unmappedRow = eligibleRow({
    competitionId: "fb-comp-api-football-0",
  });
  const unmappedSchedule = scheduleOf([unmappedRow]);
  assert.deepEqual(
    sportKeysForIntakeTargets({
      schedule: unmappedSchedule,
      teamBridge: [],
    }),
    [],
  );
  const unmapped = assembleFootballOddsBridgeCandidateIntake({
    schedule: unmappedSchedule,
    observedAt: OBSERVED,
    generatedAt: GENERATED,
    teamBridge: [],
    eventsBySportKey: {},
    uniqueSportKeysRequested: [],
    providerCalls: 0,
    eventsFetched: true,
  });
  assert.equal(unmapped.rows[0]?.candidateStatus, "SPORT_KEY_NOT_MAPPED");
  assert.equal(unmapped.meta.providerCalls, 0);

  // Endpoint failure is not hidden as a bridge miss.
  const failed = assemble({
    rows: [eligibleRow()],
    teamBridge: [],
    events: [],
    failedSportKeys: ["soccer_epl"],
  });
  assert.equal(failed.rows[0]?.candidateStatus, "SPORT_KEY_ENDPOINT_FAILED");

  // listEvents contract via build + tmp schedule.
  const tmp = mkdtempSync(path.join(tmpdir(), "fb-bridge-intake-"));
  writeTmpSchedule(tmp, [eligibleRow()]);
  const recorder = new RecordingProvider({
    soccer_epl: [listing()],
  });
  const built = await buildFootballOddsBridgeCandidateIntakeV1({
    dateKst: DATE,
    observedAt: OBSERVED,
    generatedAt: GENERATED,
    cwd: tmp,
    teamBridge: homeOnlyBridge,
    writeArtifact: false,
    listEvents: async (sportKey) => recorder.listEvents(sportKey),
  });
  assert.equal(recorder.listEventsCalls, 1);
  assert.equal(recorder.getOddsCalls, 0);
  assert.equal(built.document.meta.providerMethod, "listEvents");
  assert.equal(built.document.meta.providerCalls, 1);
  assert.equal(
    built.document.rows[0]?.candidateStatus,
    "PENDING_REVIEW_SINGLE_SIDE_ANCHORED",
  );
  assert.equal(built.wrote, false);

  // Target 0 → provider calls 0.
  const tmpComplete = mkdtempSync(path.join(tmpdir(), "fb-bridge-complete-"));
  writeTmpSchedule(tmpComplete, [eligibleRow()]);
  const recorderIdle = new RecordingProvider({ soccer_epl: [listing()] });
  const idle = await buildFootballOddsBridgeCandidateIntakeV1({
    dateKst: DATE,
    observedAt: OBSERVED,
    generatedAt: GENERATED,
    cwd: tmpComplete,
    teamBridge: TEST_BRIDGE,
    writeArtifact: false,
    listEvents: async (sportKey) => recorderIdle.listEvents(sportKey),
  });
  assert.equal(recorderIdle.listEventsCalls, 0);
  assert.equal(idle.document.meta.providerCalls, 0);
  assert.equal(idle.document.rows[0]?.candidateStatus, "NO_CANDIDATE_NEEDED");
  assert.equal(idle.wouldCallProvider, false);

  // Unique sport-key: two EPL rows, one call.
  const tmpTwo = mkdtempSync(path.join(tmpdir(), "fb-bridge-two-"));
  writeTmpSchedule(tmpTwo, [
    eligibleRow(),
    eligibleRow({
      matchId: "soccer-api-football-999002",
      providerMatchId: "999002",
    }),
  ]);
  const recorderTwo = new RecordingProvider({
    soccer_epl: [listing(), listing({ externalEventId: "evt-2" })],
  });
  await buildFootballOddsBridgeCandidateIntakeV1({
    dateKst: DATE,
    observedAt: OBSERVED,
    generatedAt: GENERATED,
    cwd: tmpTwo,
    teamBridge: [],
    writeArtifact: false,
    listEvents: async (sportKey) => recorderTwo.listEvents(sportKey),
  });
  assert.equal(recorderTwo.listEventsCalls, 1);

  // Dummy live guard.
  assert.throws(
    () => assertLiveOddsBridgeIntakeProvider(new DummyOddsProvider()),
    /DUMMY_ODDS_PROVIDER_NOT_RESEARCH/,
  );

  // Odds collection eligibility is not loosened.
  const stillSkipped = planOddsFetches({
    schedule: scheduleOf([eligibleRow()]),
    teamBridge: homeOnlyBridge,
    observedAt: OBSERVED,
  });
  assert.equal(stillSkipped.skipped.teamBridgeMissing, 1);
  assert.equal(stillSkipped.wouldCallProvider, false);

  // Source schedule hash is sealed.
  assert.equal(
    replay.meta.sourceScheduleArtifactHash,
    schedule0818.meta.artifactHash,
  );
  assert.equal(replay.meta.legalStatus, "NEEDS_LEGAL_REVIEW");
  assert.equal(replay.meta.researchOnly, true);
  assert.equal(replay.meta.kickoffToleranceMinutes, 15);

  const after = Object.fromEntries(
    FROZEN_REL.map((rel) => [rel, sha256File(path.join(cwd, rel))]),
  );
  assert.deepEqual(after, before);

  const frozenDiff = execSync(`git diff --name-only -- ${FROZEN_REL.join(" ")}`, {
    cwd,
    encoding: "utf8",
  }).trim();
  assert.equal(frozenDiff, "");

  const functionalDiff = execSync(
    `git diff --name-only -- ${FUNCTIONAL_FORBIDDEN.join(" ")}`,
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(functionalDiff, "");

  const audit = {
    schemaVersion: "yang-edge-football-daily-odds-bridge-candidate-intake-v1",
    generatedAt: JSON.parse(
      readFileSync(path.join(cwd, FROZEN_REL[0]), "utf8"),
    ).meta.generatedAt,
    researchOnly: true,
    networkCallsDuringDevelopment: { apiFootball: 0, theOddsApi: 0 },
    providerCapability: {
      listEventsPresent: true,
      getOddsNotUsedForDiscovery: true,
    },
    policy: {
      exactOnly: true,
      noFuzzy: true,
      noAutoApprove: true,
      noAutoRegistryMutation: true,
      predictionInput: false,
    },
    replayTests: {
      dateKst: "2026-08-18",
      matchId: "soccer-api-football-1570337",
      inMemoryBridgeRemoved: true,
      candidateStatus: replayRow.candidateStatus,
      oddsProviderEventId: replayRow.candidateEvents[0]?.externalEventId,
      restoredBridgeStatus: restored.rows[0]?.candidateStatus,
    },
    singleSideAnchorTest: {
      status: single.rows[0]?.candidateStatus,
      autoApproved: false,
    },
    ambiguousTest: { status: ambiguous.rows[0]?.candidateStatus },
    orientationTest: { status: oriented.rows[0]?.candidateStatus },
    canonicalMissingTest: { status: missing.rows[0]?.candidateStatus },
    postKickoffTest: {
      timingClass: late.rows[0]?.timingClass,
      pregameUsable: late.rows[0]?.pregameUsable,
      predictionInput: false,
    },
    frozenHashes: after,
    mandatoryCompletion: {
      dateKst: "2026-08-20",
      total: "60%",
      unchanged: true,
    },
  };
  const auditAbs = path.join(cwd, AUDIT_REL);
  mkdirSync(path.dirname(auditAbs), { recursive: true });
  writeFileSync(auditAbs, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  assert.equal(existsSync(auditAbs), true);

  const afterWrite = Object.fromEntries(
    FROZEN_REL.map((rel) => [rel, sha256File(path.join(cwd, rel))]),
  );
  assert.deepEqual(afterWrite, before);

  console.log("PASS football-odds-bridge-candidates-v1");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
