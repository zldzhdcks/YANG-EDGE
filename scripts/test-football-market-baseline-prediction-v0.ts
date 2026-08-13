/**
 * Football Market Baseline Prediction v0 tests.
 * Run: npm run test:football-market-baseline-prediction-v0
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  finalizeFootballScheduleDocument,
  type FootballScheduleArtifactV1,
  type FootballScheduleRowV1,
} from "../src/lib/football/core";
import {
  assembleFootball1x2OddsArtifact,
  computeFootball1x2OddsObservationHash,
  type FootballOddsTeamBridgeEntry,
} from "../src/lib/football/odds-1x2-v1";
import {
  assembleFootballMarketBaselinePredictionV0,
  buildFootballMarketBaselinePredictionV0,
  computeFootballMarketBaselinePredictionHash,
  sourceStatusToBaseline,
} from "../src/lib/football/market-baseline-prediction-v0";
import {
  assembleFootballPredictionSnapshotV0,
  computeFootballPredictionSnapshotHash,
  parseFootballPredictionSnapshotArtifact,
  parseFootballPredictionSnapshotJsonText,
  type FootballPredictionSnapshotV0,
} from "../src/lib/football/prediction-snapshot-v0";
import type { OddsBookmaker, OddsData } from "../src/lib/odds/types";

const HOME_ID = "fb-team-v1-api-football-9001";
const AWAY_ID = "fb-team-v1-api-football-9002";
const KICKOFF = "2026-08-20T14:00:00.000Z";
const FREEZE = "2026-08-20T13:00:00.000Z";
const OBSERVED = "2026-08-20T12:30:00.000Z";
const GENERATED = "2026-08-20T13:01:00.000Z";
const PREDICTION_AT = "2026-08-20T13:30:00.000Z";

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

function shaFile(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function readTree(dir: string, acc: string[] = [], prefix = ""): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${name.name}` : name.name;
    const abs = path.join(dir, name.name);
    if (name.isDirectory()) readTree(abs, acc, rel);
    else acc.push(rel);
  }
  return acc;
}

function eligibleRow(
  over: Partial<FootballScheduleRowV1> = {},
): FootballScheduleRowV1 {
  return {
    dateKst: "2026-08-20",
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
    homeTeamName: "Home FC",
    awayTeamName: "Away FC",
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

function scheduleOf(rows: FootballScheduleRowV1[]): FootballScheduleArtifactV1 {
  return finalizeFootballScheduleDocument({
    dateKst: rows[0]?.dateKst ?? "2026-08-20",
    generatedAt: "2026-08-20T00:00:00.000Z",
    provider: "api-football",
    rows,
    droppedUnregisteredCompetition: 0,
  });
}

function bookmaker(over: {
  outcomes: { name: string; price: number }[];
}): OddsBookmaker {
  return {
    key: "pinnacle",
    title: "Pinnacle",
    lastUpdate: "2026-08-20T11:00:00Z",
    markets: [
      {
        key: "h2h",
        lastUpdate: "2026-08-20T11:00:00Z",
        outcomes: over.outcomes,
      },
    ],
  };
}

function oddsEvent(over: Partial<OddsData> = {}): OddsData {
  return {
    externalEventId: "odds-evt-1",
    sportKey: "soccer_epl",
    homeTeam: "Home FC",
    awayTeam: "Away FC",
    commenceTime: "2026-08-20T14:05:00.000Z",
    bookmakers: [
      bookmaker({
        outcomes: [
          { name: "Home FC", price: 2.1 },
          { name: "Draw", price: 3.4 },
          { name: "Away FC", price: 3.6 },
        ],
      }),
    ],
    bestHomeOdds: null,
    bestDrawOdds: null,
    bestAwayOdds: null,
    impliedHomeProbability: null,
    impliedDrawProbability: null,
    impliedAwayProbability: null,
    lastUpdated: "2026-08-20T11:00:00Z",
    source: "the-odds-api",
    ...over,
  };
}

function frozenSnapshot(
  rows: FootballScheduleRowV1[] = [eligibleRow()],
  events: OddsData[] = [oddsEvent()],
  freezeAt = FREEZE,
): FootballPredictionSnapshotV0 {
  const schedule = scheduleOf(rows);
  const odds = assembleFootball1x2OddsArtifact({
    schedule,
    observedAt: OBSERVED,
    generatedAt: GENERATED,
    eventsBySportKey: { soccer_epl: events },
    teamBridge: TEST_BRIDGE,
    providerCalled: events.length > 0,
    providerSportKeysRequested: events.length > 0 ? ["soccer_epl"] : [],
  });
  return assembleFootballPredictionSnapshotV0({
    schedule,
    odds,
    freezeAt,
    generatedAt: GENERATED,
  });
}

function rehashSnapshot(
  doc: FootballPredictionSnapshotV0,
): FootballPredictionSnapshotV0 {
  const { snapshotHash: _h, ...meta } = doc.meta;
  void _h;
  return {
    ...doc,
    meta: {
      ...doc.meta,
      snapshotHash: computeFootballPredictionSnapshotHash({
        meta,
        matches: doc.matches,
      }),
    },
  };
}

function setFrozenProbs(
  doc: FootballPredictionSnapshotV0,
  home: number | null,
  draw: number | null,
  away: number | null,
): FootballPredictionSnapshotV0 {
  const clone = structuredClone(doc);
  const match = clone.matches.find((m) => m.snapshotStatus === "FROZEN");
  assert.ok(match?.frozenOddsObservation);
  match.frozenOddsObservation.medianDevigHome = home;
  match.frozenOddsObservation.medianDevigDraw = draw;
  match.frozenOddsObservation.medianDevigAway = away;
  match.selectedOddsObservationHash = computeFootball1x2OddsObservationHash(
    match.frozenOddsObservation,
  );
  return rehashSnapshot(clone);
}

function baselineOf(
  snapshot: FootballPredictionSnapshotV0,
  predictionAt = PREDICTION_AT,
  generatedAt = GENERATED,
) {
  return assembleFootballMarketBaselinePredictionV0({
    snapshot,
    predictionAt,
    generatedAt,
  });
}

function predictedMatch(snapshot: FootballPredictionSnapshotV0) {
  const doc = baselineOf(snapshot);
  const row = doc.matches.find((m) => m.sourceSnapshotStatus === "FROZEN");
  assert.ok(row);
  return row;
}

function assertNoForbiddenBaselineImports(filePath: string) {
  const src = readFileSync(filePath, "utf8");
  assert.equal(/getOddsProvider/.test(src), false, filePath);
  assert.equal(/the-odds-api-provider/.test(src), false, filePath);
  assert.equal(/assembleFootball1x2OddsArtifact/.test(src), false, filePath);
  assert.equal(/buildFootball1x2OddsV1/.test(src), false, filePath);
  assert.equal(/assembleFootballScheduleArtifact/.test(src), false, filePath);
  assert.equal(/finalizeFootballScheduleDocument/.test(src), false, filePath);
  assert.equal(/assembleFootballPredictionSnapshotV0/.test(src), false, filePath);
  assert.equal(/buildFootballPredictionSnapshotV0/.test(src), false, filePath);
  assert.equal(/footballScheduleV1Rel/.test(src), false, filePath);
  assert.equal(/football1x2OddsV1Rel/.test(src), false, filePath);
  assert.equal(/1x2-odds-v1\.json/.test(src), false, filePath);
  assert.equal(/schedule-v1\.json/.test(src), false, filePath);
  assert.equal(/GOOD PICK|STRONG PICK/.test(src), false, filePath);
}

async function main() {
  const schedule12 = path.join(
    process.cwd(),
    "data/research/football/2026-08-12-schedule-v1.json",
  );
  const schedule14 = path.join(
    process.cwd(),
    "data/research/football/2026-08-14-schedule-v1.json",
  );
  const odds12 = path.join(
    process.cwd(),
    "data/research/football/2026-08-12-1x2-odds-v1.json",
  );
  const odds14 = path.join(
    process.cwd(),
    "data/research/football/2026-08-14-1x2-odds-v1.json",
  );
  const snapshot14 = path.join(
    process.cwd(),
    "data/research/football/2026-08-14-prediction-snapshot-v0.json",
  );
  const baseline14 = path.join(
    process.cwd(),
    "data/research/football/2026-08-14-market-baseline-prediction-v0.json",
  );
  const hash12S = shaFile(schedule12);
  const hash14S = shaFile(schedule14);
  const hash12O = shaFile(odds12);
  const hash14O = shaFile(odds14);
  const hash14Snap = shaFile(snapshot14);
  const hash14Base = shaFile(baseline14);

  const valid = frozenSnapshot();
  assert.equal(valid.matches[0]!.snapshotStatus, "FROZEN");

  // 1. valid Snapshot loads
  const loaded = parseFootballPredictionSnapshotArtifact(valid, {
    dateKst: "2026-08-20",
  });
  assert.equal(loaded.meta.snapshotHash, valid.meta.snapshotHash);

  // 2. corrupt JSON
  assert.throws(
    () => parseFootballPredictionSnapshotJsonText("{not-json"),
    /FOOTBALL_PREDICTION_SNAPSHOT_JSON_INVALID/,
  );

  // 3. wrong schema
  const badSchema = structuredClone(valid);
  (badSchema.meta as { schemaVersion: string }).schemaVersion = "nope";
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(badSchema),
    /FOOTBALL_PREDICTION_SNAPSHOT_SCHEMA_MISMATCH/,
  );

  // 4. wrong snapshotHash
  const badHash = structuredClone(valid);
  badHash.meta.snapshotHash = "0".repeat(64);
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(badHash),
    /FOOTBALL_PREDICTION_SNAPSHOT_HASH_MISMATCH/,
  );

  // 5. wrong date
  assert.throws(
    () =>
      parseFootballPredictionSnapshotArtifact(valid, { dateKst: "2026-01-01" }),
    /FOOTBALL_PREDICTION_SNAPSHOT_DATE_MISMATCH/,
  );

  // 6. duplicate matchId
  const dup = structuredClone(valid);
  dup.matches.push(structuredClone(dup.matches[0]!));
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(rehashSnapshot(dup)),
    /FOOTBALL_PREDICTION_SNAPSHOT_DUPLICATE_MATCH_ID/,
  );

  // 7. researchOnly != true
  const notResearch = structuredClone(valid);
  (notResearch.meta as { researchOnly: boolean }).researchOnly = false;
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(rehashSnapshot(notResearch)),
    /FOOTBALL_PREDICTION_SNAPSHOT_RESEARCH_ONLY_REQUIRED/,
  );

  // 8. prediction != NONE
  const notPredNone = structuredClone(valid);
  (notPredNone.meta as { prediction: string }).prediction = "MARKET";
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(rehashSnapshot(notPredNone)),
    /FOOTBALL_PREDICTION_SNAPSHOT_PREDICTION_NOT_NONE/,
  );

  // 9. engine != NONE
  const notEngineNone = structuredClone(valid);
  (notEngineNone.meta as { engine: string }).engine = "V1";
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(rehashSnapshot(notEngineNone)),
    /FOOTBALL_PREDICTION_SNAPSHOT_ENGINE_NOT_NONE/,
  );

  // 10. FROZEN without frozenOddsObservation
  const missingObs = structuredClone(valid);
  missingObs.matches[0]!.frozenOddsObservation = null;
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(rehashSnapshot(missingObs)),
    /FOOTBALL_PREDICTION_SNAPSHOT_FROZEN_ODDS_MISSING/,
  );

  // 11. selected observationId mismatch
  const idMismatch = structuredClone(valid);
  idMismatch.matches[0]!.selectedOddsObservationId = "wrong-id";
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(rehashSnapshot(idMismatch)),
    /FOOTBALL_PREDICTION_SNAPSHOT_OBSERVATION_ID_MISMATCH/,
  );

  // 12. selected observationHash mismatch
  const obsHashMismatch = structuredClone(valid);
  obsHashMismatch.matches[0]!.selectedOddsObservationHash = "0".repeat(64);
  assert.throws(
    () =>
      parseFootballPredictionSnapshotArtifact(rehashSnapshot(obsHashMismatch)),
    /FOOTBALL_PREDICTION_SNAPSHOT_OBSERVATION_HASH_MISMATCH/,
  );

  // 13. FROZEN internal homeTeam mismatch
  const homeMismatch = structuredClone(valid);
  homeMismatch.matches[0]!.frozenOddsObservation!.homeTeamId =
    "fb-team-v1-api-football-0000";
  homeMismatch.matches[0]!.selectedOddsObservationHash =
    computeFootball1x2OddsObservationHash(
      homeMismatch.matches[0]!.frozenOddsObservation!,
    );
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(rehashSnapshot(homeMismatch)),
    /FOOTBALL_SNAPSHOT_ODDS_HOME_TEAM_MISMATCH/,
  );

  // 14. awayTeam mismatch
  const awayMismatch = structuredClone(valid);
  awayMismatch.matches[0]!.frozenOddsObservation!.awayTeamId =
    "fb-team-v1-api-football-0000";
  awayMismatch.matches[0]!.selectedOddsObservationHash =
    computeFootball1x2OddsObservationHash(
      awayMismatch.matches[0]!.frozenOddsObservation!,
    );
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(rehashSnapshot(awayMismatch)),
    /FOOTBALL_SNAPSHOT_ODDS_AWAY_TEAM_MISMATCH/,
  );

  // 15. competition mismatch
  const compMismatch = structuredClone(valid);
  compMismatch.matches[0]!.frozenOddsObservation!.competitionId =
    "fb-comp-api-football-000";
  compMismatch.matches[0]!.selectedOddsObservationHash =
    computeFootball1x2OddsObservationHash(
      compMismatch.matches[0]!.frozenOddsObservation!,
    );
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(rehashSnapshot(compMismatch)),
    /FOOTBALL_SNAPSHOT_ODDS_COMPETITION_MISMATCH/,
  );

  // 16. kickoff mismatch
  const kickMismatch = structuredClone(valid);
  kickMismatch.matches[0]!.frozenOddsObservation!.scheduleKickoffTimeUtc =
    "2026-08-20T15:00:00.000Z";
  kickMismatch.matches[0]!.selectedOddsObservationHash =
    computeFootball1x2OddsObservationHash(
      kickMismatch.matches[0]!.frozenOddsObservation!,
    );
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(rehashSnapshot(kickMismatch)),
    /FOOTBALL_SNAPSHOT_ODDS_KICKOFF_MISMATCH/,
  );

  // 17. source Schedule hash mismatch
  const schedHashMismatch = structuredClone(valid);
  schedHashMismatch.matches[0]!.frozenOddsObservation!.sourceScheduleArtifactHash =
    "0".repeat(64);
  schedHashMismatch.matches[0]!.selectedOddsObservationHash =
    computeFootball1x2OddsObservationHash(
      schedHashMismatch.matches[0]!.frozenOddsObservation!,
    );
  assert.throws(
    () =>
      parseFootballPredictionSnapshotArtifact(rehashSnapshot(schedHashMismatch)),
    /FOOTBALL_SNAPSHOT_ODDS_SCHEDULE_HASH_MISMATCH/,
  );

  // wrapper matchId != frozenScheduleRow.matchId
  const wrapMismatch = structuredClone(valid);
  wrapMismatch.matches[0]!.matchId = "soccer-api-football-other";
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(rehashSnapshot(wrapMismatch)),
    /FOOTBALL_PREDICTION_SNAPSHOT_MATCH_ID_MISMATCH/,
  );

  // unknown snapshotStatus
  const badStatus = structuredClone(valid);
  (badStatus.matches[0] as { snapshotStatus: string }).snapshotStatus = "WEIRD";
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(rehashSnapshot(badStatus)),
    /FOOTBALL_PREDICTION_SNAPSHOT_STATUS_INVALID/,
  );
  assert.throws(
    () => sourceStatusToBaseline("WEIRD"),
    /FOOTBALL_MARKET_BASELINE_SOURCE_STATUS_INVALID/,
  );

  // MISSED_SNAPSHOT_FREEZE_WINDOW → explicit SOURCE mapping
  const missedSnap = frozenSnapshot([eligibleRow()], [oddsEvent()], KICKOFF);
  assert.equal(
    missedSnap.matches[0]!.snapshotStatus,
    "MISSED_SNAPSHOT_FREEZE_WINDOW",
  );
  const missedBase = baselineOf(missedSnap);
  assert.equal(
    missedBase.matches[0]!.baselineStatus,
    "SOURCE_MISSED_SNAPSHOT_FREEZE_WINDOW",
  );
  assert.equal(missedBase.matches[0]!.baselineOutcome, null);
  assert.equal(
    sourceStatusToBaseline("MISSED_SNAPSHOT_FREEZE_WINDOW"),
    "SOURCE_MISSED_SNAPSHOT_FREEZE_WINDOW",
  );

  // invalid FROZEN kickoffTimeUtc
  const badKick = structuredClone(valid);
  badKick.matches[0]!.frozenScheduleRow.kickoffTimeUtc = "not-an-instant";
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(rehashSnapshot(badKick)),
    /FOOTBALL_PREDICTION_SNAPSHOT_FROZEN_KICKOFF_INVALID/,
  );

  // null FROZEN kickoffTimeUtc
  const nullKick = structuredClone(valid);
  nullKick.matches[0]!.frozenScheduleRow.kickoffTimeUtc = null;
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(rehashSnapshot(nullKick)),
    /FOOTBALL_PREDICTION_SNAPSHOT_FROZEN_KICKOFF_INVALID/,
  );

  // invalid meta.freezeAt
  const badFreeze = structuredClone(valid);
  badFreeze.meta.freezeAt = "not-an-instant";
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(rehashSnapshot(badFreeze)),
    /FOOTBALL_PREDICTION_SNAPSHOT_FREEZE_AT_INVALID/,
  );

  // freezeAt == kickoff
  const freezeEq = structuredClone(valid);
  freezeEq.meta.freezeAt = KICKOFF;
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(rehashSnapshot(freezeEq)),
    /FOOTBALL_PREDICTION_SNAPSHOT_FREEZE_NOT_BEFORE_KICKOFF/,
  );

  // freezeAt > kickoff
  const freezeAfter = structuredClone(valid);
  freezeAfter.meta.freezeAt = "2026-08-20T15:00:00.000Z";
  assert.throws(
    () => parseFootballPredictionSnapshotArtifact(rehashSnapshot(freezeAfter)),
    /FOOTBALL_PREDICTION_SNAPSHOT_FREEZE_NOT_BEFORE_KICKOFF/,
  );

  // valid freezeAt < kickoff
  assert.ok(Date.parse(loaded.meta.freezeAt) < Date.parse(KICKOFF));
  assert.equal(loaded.matches[0]!.matchId, loaded.matches[0]!.frozenScheduleRow.matchId);

  // 18. valid FROZEN → MARKET_BASELINE_PREDICTED
  const predicted = predictedMatch(valid);
  assert.equal(predicted.baselineStatus, "MARKET_BASELINE_PREDICTED");
  assert.ok(predicted.baselineOutcome === "HOME" || predicted.baselineOutcome === "DRAW" || predicted.baselineOutcome === "AWAY");

  // 19–21. highest HOME / DRAW / AWAY
  assert.equal(predictedMatch(setFrozenProbs(valid, 0.5, 0.3, 0.2)).baselineOutcome, "HOME");
  assert.equal(predictedMatch(setFrozenProbs(valid, 0.2, 0.5, 0.3)).baselineOutcome, "DRAW");
  assert.equal(predictedMatch(setFrozenProbs(valid, 0.2, 0.3, 0.5)).baselineOutcome, "AWAY");

  // 22. max under 0.5 still selected
  const underHalf = predictedMatch(setFrozenProbs(valid, 0.3, 0.31, 0.39));
  assert.equal(underHalf.baselineStatus, "MARKET_BASELINE_PREDICTED");
  assert.equal(underHalf.baselineOutcome, "AWAY");

  // 23–25. renormalize, sum ~ 1, raw preserved
  const rawHome = 0.2;
  const rawDraw = 0.3;
  const rawAway = 0.4;
  const renormalized = predictedMatch(
    setFrozenProbs(valid, rawHome, rawDraw, rawAway),
  );
  assert.equal(renormalized.rawMedianDevigHome, rawHome);
  assert.equal(renormalized.rawMedianDevigDraw, rawDraw);
  assert.equal(renormalized.rawMedianDevigAway, rawAway);
  assert.equal(renormalized.rawMedianSum, 0.9);
  assert.equal(renormalized.normalizedHome, rawHome / 0.9);
  assert.equal(renormalized.normalizedDraw, rawDraw / 0.9);
  assert.equal(renormalized.normalizedAway, rawAway / 0.9);
  const normSum =
    renormalized.normalizedHome! +
    renormalized.normalizedDraw! +
    renormalized.normalizedAway!;
  assert.ok(Math.abs(normSum - 1) < 1e-12);

  // 26. null probability
  assert.throws(
    () => baselineOf(setFrozenProbs(valid, null, 0.3, 0.4)),
    /FOOTBALL_MARKET_BASELINE_INVALID_FROZEN_PROBABILITIES/,
  );

  // 27. NaN / Infinity
  assert.throws(
    () => baselineOf(setFrozenProbs(valid, Number.NaN, 0.3, 0.4)),
    /FOOTBALL_MARKET_BASELINE_INVALID_FROZEN_PROBABILITIES/,
  );
  assert.throws(
    () => baselineOf(setFrozenProbs(valid, Number.POSITIVE_INFINITY, 0.3, 0.4)),
    /FOOTBALL_MARKET_BASELINE_INVALID_FROZEN_PROBABILITIES/,
  );

  // 28. <= 0 or >= 1
  assert.throws(
    () => baselineOf(setFrozenProbs(valid, 0, 0.4, 0.4)),
    /FOOTBALL_MARKET_BASELINE_INVALID_FROZEN_PROBABILITIES/,
  );
  assert.throws(
    () => baselineOf(setFrozenProbs(valid, 1, 0.3, 0.4)),
    /FOOTBALL_MARKET_BASELINE_INVALID_FROZEN_PROBABILITIES/,
  );

  // 29. exact max tie
  const tied = predictedMatch(setFrozenProbs(valid, 1 / 3, 1 / 3, 1 / 3));
  assert.equal(tied.baselineStatus, "AMBIGUOUS_MARKET_MAX");
  assert.equal(tied.baselineOutcome, null);
  assert.equal(tied.baselineProbability, null);

  // 30. predictionAt before kickoff
  const before = baselineOf(valid, "2026-08-20T13:59:59.999Z");
  assert.equal(before.matches[0]!.baselineStatus, "MARKET_BASELINE_PREDICTED");

  // 31. at kickoff → MISSED
  const atKick = baselineOf(valid, KICKOFF);
  assert.equal(atKick.matches[0]!.baselineStatus, "MISSED_MARKET_BASELINE_WINDOW");
  assert.equal(atKick.matches[0]!.baselineOutcome, null);

  // 32. after kickoff → MISSED
  const afterKick = baselineOf(valid, "2026-08-20T14:00:00.001Z");
  assert.equal(
    afterKick.matches[0]!.baselineStatus,
    "MISSED_MARKET_BASELINE_WINDOW",
  );

  // 34–39. non-FROZEN retained, no market prediction
  const mixedSnap = frozenSnapshot([
    eligibleRow({
      matchId: "soccer-api-football-ucl",
      providerMatchId: "1",
      predictionEligibility: "NOT_SUPPORTED_FORMAT",
      matchFormat: "KNOCKOUT",
    }),
    eligibleRow({
      matchId: "soccer-api-football-blocked",
      providerMatchId: "2",
      predictionEligibility: "COMPETITION_BLOCKED",
    }),
    eligibleRow({
      matchId: "soccer-api-football-ident",
      providerMatchId: "3",
      predictionEligibility: "IDENTITY_BLOCKED",
      identityStatus: "IDENTITY_BLOCKED",
    }),
    eligibleRow({
      matchId: "soccer-api-football-unknown",
      providerMatchId: "4",
      predictionEligibility: "UNKNOWN",
    }),
    eligibleRow(),
  ]);
  const noneOddsSnap = frozenSnapshot(
    [
      eligibleRow({
        matchId: "soccer-api-football-nousable",
        providerMatchId: "5",
      }),
    ],
    [],
  );
  const mixedDoc = baselineOf(mixedSnap);
  const byId = Object.fromEntries(
    mixedDoc.matches.map((m) => [m.matchId, m]),
  );
  assert.equal(byId["soccer-api-football-ucl"]!.baselineStatus, "SOURCE_NOT_ELIGIBLE_FORMAT");
  assert.equal(byId["soccer-api-football-blocked"]!.baselineStatus, "SOURCE_COMPETITION_BLOCKED");
  assert.equal(byId["soccer-api-football-ident"]!.baselineStatus, "SOURCE_IDENTITY_BLOCKED");
  assert.equal(byId["soccer-api-football-unknown"]!.baselineStatus, "SOURCE_UNKNOWN_ELIGIBILITY");
  assert.equal(byId["soccer-api-football-ucl"]!.baselineOutcome, null);
  assert.equal(noneOddsSnap.matches[0]!.snapshotStatus, "NO_USABLE_ODDS_BEFORE_FREEZE");
  const noneOddsDoc = baselineOf(noneOddsSnap);
  assert.equal(noneOddsDoc.matches[0]!.baselineStatus, "SOURCE_NO_USABLE_ODDS");
  assert.equal(noneOddsDoc.matches[0]!.baselineOutcome, null);

  // 47–51. predictionHash
  const hashA = baselineOf(valid, PREDICTION_AT, GENERATED);
  const hashB = baselineOf(valid, PREDICTION_AT, "2099-01-01T00:00:00.000Z");
  assert.equal(hashA.meta.predictionHash, hashB.meta.predictionHash);
  const hashC = baselineOf(valid, "2026-08-20T13:31:00.000Z", GENERATED);
  assert.notEqual(hashA.meta.predictionHash, hashC.meta.predictionHash);
  const { predictionHash: _ph, ...metaNoHash } = hashA.meta;
  void _ph;
  assert.equal(
    computeFootballMarketBaselinePredictionHash({
      meta: { ...metaNoHash, generatedAt: "x" },
      matches: hashA.matches,
    }),
    hashA.meta.predictionHash,
  );
  const sourceChanged = computeFootballMarketBaselinePredictionHash({
    meta: { ...metaNoHash, sourceSnapshotHash: "f".repeat(64) },
    matches: hashA.matches,
  });
  assert.notEqual(sourceChanged, hashA.meta.predictionHash);
  const probChanged = baselineOf(setFrozenProbs(valid, 0.5, 0.3, 0.2));
  assert.notEqual(probChanged.meta.predictionHash, hashA.meta.predictionHash);

  const baseDir = path.join(
    process.cwd(),
    "src/lib/football/market-baseline-prediction-v0",
  );
  for (const rel of readTree(baseDir)) {
    assertNoForbiddenBaselineImports(path.join(baseDir, rel));
  }
  const cliPath = path.join(
    process.cwd(),
    "scripts/build-football-market-baseline-prediction-v0.ts",
  );
  assertNoForbiddenBaselineImports(cliPath);
  const cliSrc = readFileSync(cliPath, "utf8");
  assert.equal(/--prediction-at/.test(cliSrc), false);
  assert.equal(/--freeze-at/.test(cliSrc), false);
  assert.equal(/--env-file/.test(cliSrc), false);

  const tmp = mkdtempSync(path.join(tmpdir(), "fb-mkt-base-v0-"));
  try {
    const relDir = path.join(tmp, "data/research/football");
    mkdirSync(relDir, { recursive: true });
    writeFileSync(
      path.join(relDir, "2026-08-20-prediction-snapshot-v0.json"),
      `${JSON.stringify(valid, null, 2)}\n`,
    );

    // 41. dry-run → zero writes
    const dry = await buildFootballMarketBaselinePredictionV0({
      dateKst: "2026-08-20",
      predictionAt: PREDICTION_AT,
      generatedAt: GENERATED,
      dryRun: true,
      rootDir: tmp,
    });
    assert.equal(dry.wrote, false);
    assert.equal(dry.document.meta.baselinePredictedGames, 1);
    const outPath = path.join(
      relDir,
      "2026-08-20-market-baseline-prediction-v0.json",
    );
    assert.equal(existsSync(outPath), false);

    const written = await buildFootballMarketBaselinePredictionV0({
      dateKst: "2026-08-20",
      predictionAt: PREDICTION_AT,
      generatedAt: GENERATED,
      dryRun: false,
      rootDir: tmp,
    });
    assert.equal(written.wrote, true);
    const beforeBytes = shaFile(outPath);

    // 40. existing → refuse overwrite
    await assert.rejects(
      () =>
        buildFootballMarketBaselinePredictionV0({
          dateKst: "2026-08-20",
          predictionAt: PREDICTION_AT,
          generatedAt: GENERATED,
          dryRun: false,
          rootDir: tmp,
        }),
      /FOOTBALL_MARKET_BASELINE_ALREADY_EXISTS/,
    );
    assert.equal(shaFile(outPath), beforeBytes);

    rmSync(outPath);
    // 33. all FROZEN after kickoff + predicted 0 → production write fail
    await assert.rejects(
      () =>
        buildFootballMarketBaselinePredictionV0({
          dateKst: "2026-08-20",
          predictionAt: "2026-08-20T15:00:00.000Z",
          generatedAt: GENERATED,
          dryRun: false,
          rootDir: tmp,
        }),
      /MISSED_MARKET_BASELINE_PREDICTION_WINDOW/,
    );
    assert.equal(existsSync(outPath), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  // 52–55. actual 08-14 Snapshot
  const actualSnap = parseFootballPredictionSnapshotJsonText(
    readFileSync(snapshot14, "utf8"),
    { dateKst: "2026-08-14" },
  );
  assert.equal(
    actualSnap.meta.snapshotHash,
    "33b290ba2d901ae4f5c572fc7e846e13512b9e8b6976265893638221933c52b5",
  );
  const actualBase = baselineOf(
    actualSnap,
    "2026-08-14T01:00:00.000Z",
    GENERATED,
  );
  const verdy = actualBase.matches.find(
    (m) => m.matchId === "soccer-api-football-1556021",
  );
  assert.ok(verdy);
  assert.equal(verdy.baselineStatus, "MARKET_BASELINE_PREDICTED");
  assert.equal(verdy.baselineOutcome, "AWAY");
  assert.equal(verdy.rawMedianDevigHome, 0.22790099425320962);
  assert.equal(verdy.rawMedianDevigDraw, 0.2888114701947581);
  assert.equal(verdy.rawMedianDevigAway, 0.48328753555203235);
  assert.equal(verdy.rawMedianSum, 1);
  assert.equal(verdy.normalizedHome, verdy.rawMedianDevigHome);
  assert.equal(verdy.normalizedDraw, verdy.rawMedianDevigDraw);
  assert.equal(verdy.normalizedAway, verdy.rawMedianDevigAway);
  assert.equal(verdy.baselineProbability, 0.48328753555203235);
  assert.equal(
    verdy.sourceSelectedOddsObservationId,
    "fb-1x2-obs-v1-soccer-api-football-1556021-THE_ODDS_API-2026-08-13T15:01:48.774Z",
  );
  assert.equal(
    verdy.sourceSelectedOddsObservationHash,
    "9f4f2d173be0b1783448cbf2bea0d3e97912e0f35ae0f6a3088b5d975de44ba2",
  );

  const actualFrozen = actualSnap.matches.find(
    (m) => m.matchId === "soccer-api-football-1556021",
  );
  assert.ok(actualFrozen);
  assert.equal(actualFrozen.matchId, actualFrozen.frozenScheduleRow.matchId);
  assert.ok(
    Date.parse(actualSnap.meta.freezeAt) <
      Date.parse(actualFrozen.frozenScheduleRow.kickoffTimeUtc!),
  );

  const actualBaselineDoc = JSON.parse(
    readFileSync(baseline14, "utf8"),
  ) as {
    meta: { predictionHash: string; predictionAt: string };
    matches: { matchId: string; baselineOutcome: string | null }[];
  };
  assert.equal(
    actualBaselineDoc.meta.predictionHash,
    "3d8863628440f433ed993c3e196dae2d86217c884115dcde8f48704ab40510cf",
  );
  assert.equal(actualBaselineDoc.meta.predictionAt, "2026-08-13T17:18:33.639Z");
  assert.equal(
    actualBaselineDoc.matches.find(
      (m) => m.matchId === "soccer-api-football-1556021",
    )?.baselineOutcome,
    "AWAY",
  );

  assert.equal(shaFile(schedule12), hash12S);
  assert.equal(shaFile(schedule14), hash14S);
  assert.equal(shaFile(odds12), hash12O);
  assert.equal(shaFile(odds14), hash14O);
  assert.equal(shaFile(snapshot14), hash14Snap);
  assert.equal(shaFile(baseline14), hash14Base);

  console.log("test:football-market-baseline-prediction-v0 PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
