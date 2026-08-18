/**
 * 2026-08-19 Pregame Input close audit.
 * Reads sealed schedules/observations and collected starter/odds/lineup.
 * Does not run Prediction / Snapshot / Postgame / Engine.
 *
 *   npx tsx scripts/audit-2026-08-19-pregame-input-close-v1.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const DATE_KST = "2026-08-19";
export const CLOSE_REL = "data/audits/2026-08-19-pregame-input-close-v1.json";
export const OBS_REL =
  "data/operator-observations/structured/2026-08-18/batch-2253-next-pregame-v0.json";
export const LOCK_REL = "data/audits/2026-08-19-daily-scope-lock-v1.json";
export const JOIN_REL = "data/audits/2026-08-19-operator-scope-join-v1.json";
export const MLB_SCHEDULE_REL = `data/research/mlb/${DATE_KST}-schedule-v1.json`;
export const FB_SCHEDULE_REL = `data/research/football/${DATE_KST}-schedule-v1.json`;
export const EXPECTED_REL =
  `data/operator-input/mlb/${DATE_KST}-expected-lineup-observation-v0.json`;
export const KOREAN_REL =
  `data/operator-input/mlb/${DATE_KST}-korean-market-odds-observation-v0.json`;
export const STARTER_REL = `data/research/mlb/${DATE_KST}-starter-dataset-v1.json`;
export const STARTER_AUDIT_REL = `data/audits/${DATE_KST}-starter-dataset-v1-audit.json`;
export const ODDS_REL = `data/research/mlb/${DATE_KST}-odds-history-dataset-v1.json`;
export const ODDS_AUDIT_REL = `data/audits/${DATE_KST}-odds-history-dataset-v1-audit.json`;
export const LINEUP_REL = `data/research/mlb/${DATE_KST}-lineup-dataset-v1.json`;
export const LINEUP_AUDIT_REL = `data/audits/${DATE_KST}-lineup-dataset-v1-audit.json`;
export const PREDICTION_REL = `data/predictions/mlb/${DATE_KST}.json`;
export const SNAPSHOT_REL = `data/research/football/${DATE_KST}-prediction-snapshot-v0.json`;

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function readJson(cwd: string, rel: string): unknown {
  return JSON.parse(readFileSync(path.join(cwd, rel), "utf8"));
}

export async function auditPregameInputClose(cwd = process.cwd()) {
  const generatedAt = new Date().toISOString();
  const required = [
    LOCK_REL,
    JOIN_REL,
    OBS_REL,
    MLB_SCHEDULE_REL,
    FB_SCHEDULE_REL,
    EXPECTED_REL,
    KOREAN_REL,
    STARTER_REL,
    STARTER_AUDIT_REL,
    ODDS_REL,
    ODDS_AUDIT_REL,
    LINEUP_REL,
    LINEUP_AUDIT_REL,
  ];
  for (const rel of required) {
    if (!existsSync(path.join(cwd, rel))) throw new Error(`MISSING:${rel}`);
  }
  if (existsSync(path.join(cwd, PREDICTION_REL))) {
    throw new Error("PREDICTION_PRESENT");
  }
  if (existsSync(path.join(cwd, SNAPSHOT_REL))) {
    throw new Error("FOOTBALL_SNAPSHOT_PRESENT");
  }

  const lock = readJson(cwd, LOCK_REL) as {
    scopeLockedAt: string;
    sourceOperatorObservationHash: string;
    observedScope: { MLB: number; FOOTBALL: number; total: number };
  };
  const obsHash = sha256File(path.join(cwd, OBS_REL));
  if (obsHash !== lock.sourceOperatorObservationHash) {
    throw new Error("OPERATOR_OBSERVATION_MUTATED");
  }
  if (lock.observedScope.total !== 21) {
    throw new Error("SCOPE_SHRINK_FORBIDDEN");
  }

  const join = readJson(cwd, JOIN_REL) as {
    mlb: { uniqueGamePkJoined: number; matched: number; ambiguous: number; missing: number };
    football: {
      joins: Array<{
        fixture: string;
        rawLeagueLabel: string;
        status: string;
        reason: string;
      }>;
    };
  };
  const expected = readJson(cwd, EXPECTED_REL) as {
    observedAt: string;
    lineupStatus: string;
    summary: {
      scheduleGames: number;
      matchedGames: number;
      teamLineups: number;
      expectedBattingSlots: number;
      confirmedGames: number;
      preGameObservations: number;
      lateObservations: number;
    };
    games: Array<{ gamePk: number; lineupStatus: string; observationStatus?: string }>;
  };
  const korean = readJson(cwd, KOREAN_REL) as {
    observedAt: string;
    marketContext: string;
    marketType: string;
    sourceType: string;
    summary: {
      scheduleGames: number;
      matchedGames: number;
      observedGames: number;
      preGameObservations: number;
      lateGames: number;
    };
    games: Array<{
      gamePk: number;
      awayOdds: number | null;
      homeOdds: number | null;
      observationStatus: string | null;
    }>;
  };
  const starterAudit = readJson(cwd, STARTER_AUDIT_REL) as {
    totals: { gameCount: number; rowCount: number; probableAvailable: number; probableMissing: number };
    meta: { engineConnected: boolean; predictionOptional: boolean };
  };
  const oddsAudit = readJson(cwd, ODDS_AUDIT_REL) as {
    independentIntake: {
      provider: string;
      scheduleGames: number;
      gamesMatched: number;
      collected: number;
      partial: number;
      notCollected: number;
    };
    meta: { resultHashSha256: string; engineConnected: boolean };
    provider?: { id?: string; displayName?: string };
    cacheUsage?: { firstRun?: { networkCalls?: number } };
  };
  const lineupAudit = readJson(cwd, LINEUP_AUDIT_REL) as {
    independentIntake: {
      scheduleGames: number;
      confirmed: number;
      partial: number;
      notReleased: number;
      notCollected: number;
    };
    meta: { engineConnected: boolean; predictionRead: boolean };
  };

  if (expected.observedAt !== "2026-08-18T13:53:44.000Z") {
    throw new Error("EXPECTED_LINEUP_OBSERVED_AT_REWRITTEN");
  }
  if (korean.observedAt !== "2026-08-18T13:53:44.000Z") {
    throw new Error("KOREAN_OBSERVED_AT_REWRITTEN");
  }
  if (expected.lineupStatus !== "EXPECTED" || expected.summary.confirmedGames !== 0) {
    throw new Error("EXPECTED_PROMOTED_TO_CONFIRMED");
  }
  if (expected.games.some((g) => g.lineupStatus !== "EXPECTED")) {
    throw new Error("NON_EXPECTED_GAME");
  }

  const football = join.football.joins.map((row) => {
    let pregameInputStatus = "VALID_BLOCKED_IDENTITY";
    if (row.status === "UNREGISTERED_COMPETITION") {
      pregameInputStatus = "VALID_BLOCKED_UNREGISTERED_COMPETITION";
    } else if (row.status === "MATCHED_BUT_UNSUPPORTED_FORMAT") {
      pregameInputStatus = "VALID_BLOCKED_UNSUPPORTED_FORMAT";
    } else if (row.status === "IDENTITY_BLOCKED") {
      pregameInputStatus = "VALID_BLOCKED_IDENTITY";
    } else {
      throw new Error(`FOOTBALL_UNEXPECTED_STATUS:${row.status}`);
    }
    return {
      fixture: row.fixture,
      rawLeagueLabel: row.rawLeagueLabel,
      joinStatus: row.status,
      pregameInputStatus,
      reason: row.reason,
    };
  });
  if (football.length !== 6) throw new Error(`FOOTBALL_COUNT:${football.length}`);

  const unexplainedMissing =
    (join.mlb.missing ?? 0) +
    football.filter((r) => r.pregameInputStatus === "NOT_FOUND").length;
  const stageDone =
    join.mlb.uniqueGamePkJoined === 15 &&
    expected.summary.matchedGames === 15 &&
    expected.summary.expectedBattingSlots === 270 &&
    korean.summary.observedGames === 15 &&
    korean.summary.preGameObservations === 15 &&
    starterAudit.totals.gameCount === 15 &&
    oddsAudit.independentIntake.collected === 15 &&
    lineupAudit.independentIntake.scheduleGames === 15 &&
    football.length === 6 &&
    unexplainedMissing === 0;

  const document = {
    schemaVersion: "yang-edge-pregame-input-close-v1",
    dateKst: DATE_KST,
    generatedAt,
    artifactGeneratedAt: generatedAt,
    observedAt: "2026-08-18T13:53:44.000Z",
    researchOnly: true,
    sourceScopeLock: LOCK_REL,
    sourceMlbSchedule: MLB_SCHEDULE_REL,
    sourceFootballSchedule: FB_SCHEDULE_REL,
    sourceOperatorObservation: OBS_REL,
    sourceOperatorObservationHash: obsHash,
    scopeLockedAt: lock.scopeLockedAt,
    MLB: {
      scheduleGames: 15,
      gamePkUnique: join.mlb.uniqueGamePkJoined,
      starter: {
        games: starterAudit.totals.gameCount,
        rows: starterAudit.totals.rowCount,
        probableAvailable: starterAudit.totals.probableAvailable,
        probableMissing: starterAudit.totals.probableMissing,
        rel: STARTER_REL,
        auditRel: STARTER_AUDIT_REL,
      },
      providerOdds: {
        games: oddsAudit.independentIntake.scheduleGames,
        matched: oddsAudit.independentIntake.gamesMatched,
        collected: oddsAudit.independentIntake.collected,
        partial: oddsAudit.independentIntake.partial,
        notCollected: oddsAudit.independentIntake.notCollected,
        provider: oddsAudit.independentIntake.provider,
        resultHash: oddsAudit.meta.resultHashSha256,
        networkCalls: oddsAudit.cacheUsage?.firstRun?.networkCalls ?? null,
        rel: ODDS_REL,
        auditRel: ODDS_AUDIT_REL,
      },
      officialLineup: {
        games: lineupAudit.independentIntake.scheduleGames,
        confirmed: lineupAudit.independentIntake.confirmed,
        partial: lineupAudit.independentIntake.partial,
        notReleased: lineupAudit.independentIntake.notReleased,
        notCollected: lineupAudit.independentIntake.notCollected,
        rel: LINEUP_REL,
        auditRel: LINEUP_AUDIT_REL,
      },
      expectedLineupObservation: {
        games: expected.summary.scheduleGames,
        matched: expected.summary.matchedGames,
        teamLineups: expected.summary.teamLineups,
        slots: expected.summary.expectedBattingSlots,
        expected: expected.summary.matchedGames,
        confirmed: expected.summary.confirmedGames,
        preGameObservations: expected.summary.preGameObservations,
        late: expected.summary.lateObservations,
        observedAt: expected.observedAt,
        rel: EXPECTED_REL,
      },
      koreanMarketOddsObservation: {
        games: korean.summary.scheduleGames,
        matched: korean.summary.matchedGames,
        observed: korean.summary.observedGames,
        pregame: korean.summary.preGameObservations,
        late: korean.summary.lateGames,
        market: korean.marketContext,
        marketType: korean.marketType,
        sourceType: korean.sourceType,
        observedAt: korean.observedAt,
        rel: KOREAN_REL,
      },
    },
    FOOTBALL: {
      scopeGames: 6,
      accounted: football.length,
      blocked: football.length,
      unexplainedMissing: 0,
      rows: football,
    },
    timing: {
      screenshotObservedAt: "2026-08-18T13:53:44.000Z",
      artifactGeneratedAt: generatedAt,
      allEvidencePreKickoff: true,
    },
    predictionRun: false,
    snapshotRun: false,
    postgameAccess: false,
    engineConnected: false,
    unexplainedMissing,
    stageStatus: stageDone ? "B_PREGAME_INPUT_DONE" : "B_PREGAME_INPUT_INCOMPLETE",
    leakage: {
      predictionCalls: 0,
      snapshotCalls: 0,
      resultCalls: 0,
      gradeCalls: 0,
      reviewCalls: 0,
      postgameCalls: 0,
      engineCalls: 0,
      recommendationCalls: 0,
      frozenArtifactsModified: false,
    },
  };

  if (!stageDone) {
    throw new Error("STAGE_B_INCOMPLETE");
  }

  const abs = path.join(cwd, CLOSE_REL);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  return document;
}

async function main() {
  const doc = await auditPregameInputClose();
  console.log(
    [
      `wrote ${CLOSE_REL}`,
      `stage=${doc.stageStatus}`,
      `mlbPk=${doc.MLB.gamePkUnique}`,
      `expected=${doc.MLB.expectedLineupObservation.matched}/${doc.MLB.expectedLineupObservation.slots}`,
      `korean=${doc.MLB.koreanMarketOddsObservation.observed}`,
      `football=${doc.FOOTBALL.accounted}`,
      `unexplainedMissing=${doc.unexplainedMissing}`,
    ].join(" "),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
