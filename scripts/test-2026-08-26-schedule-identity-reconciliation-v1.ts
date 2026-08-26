/**
 * 2026-08-26 B1 schedule + identity reconciliation tests.
 * Run: npm run test:2026-08-26-schedule-identity-reconciliation-v1
 *
 * No Prediction / Engine / result / postgame calls.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS,
  resolveProviderTeam,
} from "../src/lib/football/core";
import {
  DATE_KST,
  FROZEN_OBS_HASH,
  LOCK_REL,
  SOURCE_OBS_REL,
  TOTAL_OBSERVED,
  sha256File,
} from "./lock-2026-08-26-daily-scope-v1";
import {
  FOOTBALL_HISTORICAL_UNSAFE_PROVIDER_TEAM_IDS,
  FOOTBALL_SCHEDULE_REL,
  KBO_SCHEDULE_REL,
  NPB_SCHEDULE_REL,
  RECONCILIATION_REL,
} from "./audit-2026-08-26-schedule-identity-reconciliation-v1";

const ISOLATION_PATHS = [
  "src/lib/engine",
  "src/lib/football/prediction-snapshot-v0",
  "src/lib/football/market-baseline-prediction-v0",
] as const;

const B1_STATES = [
  "MATCHED",
  "IDENTITY_REVIEW_REQUIRED",
  "PROVIDER_NOT_SUPPORTED",
  "PROVIDER_NOT_FOUND",
  "FORMAT_UNSUPPORTED",
  "PASS",
] as const;

type RecDoc = {
  schemaVersion: string;
  dateKst: string;
  sourceDailyScopeLockRel: string;
  sourceOperatorObservationHash: string;
  lockedScope: number;
  accountedFor: number;
  statusCounts: Record<(typeof B1_STATES)[number], number>;
  missedPreGameWindowCount: number;
  researchOnly: boolean;
  predictionInput: boolean;
  engineConnected: boolean;
  leakage: {
    predictionCalls: number;
    engineCalls: number;
    resultCalls: number;
    postgameCalls: number;
    unauthorizedCrawling: number;
    oddsUsedAsModelFeatures: boolean;
    denominatorChanged: boolean;
    gamesDropped: boolean;
    gamesInvented: boolean;
  };
  footballConflictGatesPreserved: {
    blockedProviderTeamIds: string[];
    historicalUnsafeIds: string[];
    autoMatchedUnsafeIds: number;
  };
  providerUtilization: {
    API_FOOTBALL: { calledInB1ScheduleIdentityPhase: boolean };
    API_BASEBALL: { calledInB1ScheduleIdentityPhase: boolean };
    THESPORTSDB: { calledInB1ScheduleIdentityPhase: boolean };
    THE_ODDS_API: string;
  };
  providerCalls: unknown[];
  games: Array<{
    operatorGameId: string;
    sport: string;
    rawHome: string;
    rawAway: string;
    rawLeagueLabel: string;
    status: string;
    missedPreGameWindow: boolean;
    classifiedAsPreGame: boolean;
    providerFixtureId?: string | null;
    providerHomeTeamId?: string | null;
    providerAwayTeamId?: string | null;
    reasons: string[];
  }>;
};

async function main() {
  const cwd = process.cwd();
  const recAbs = path.join(cwd, RECONCILIATION_REL);
  const lockAbs = path.join(cwd, LOCK_REL);
  const obsAbs = path.join(cwd, SOURCE_OBS_REL);

  assert.equal(existsSync(recAbs), true, "reconciliation artifact missing");
  assert.equal(existsSync(lockAbs), true);
  assert.equal(existsSync(obsAbs), true);
  assert.equal(existsSync(path.join(cwd, KBO_SCHEDULE_REL)), true);
  assert.equal(existsSync(path.join(cwd, NPB_SCHEDULE_REL)), true);
  assert.equal(existsSync(path.join(cwd, FOOTBALL_SCHEDULE_REL)), true);

  const rec = JSON.parse(readFileSync(recAbs, "utf8")) as RecDoc;
  const lock = JSON.parse(readFileSync(lockAbs, "utf8")) as {
    officialDenominator: number;
    sourceOperatorObservationHash: string;
  };

  assert.equal(rec.schemaVersion, "yang-edge-schedule-identity-reconciliation-v1");
  assert.equal(rec.dateKst, DATE_KST);
  assert.equal(rec.sourceDailyScopeLockRel, LOCK_REL);
  assert.equal(sha256File(obsAbs), FROZEN_OBS_HASH);
  assert.equal(rec.sourceOperatorObservationHash, FROZEN_OBS_HASH);
  assert.equal(lock.sourceOperatorObservationHash, FROZEN_OBS_HASH);
  assert.equal(lock.officialDenominator, 26);
  assert.equal(rec.lockedScope, 26);
  assert.equal(rec.accountedFor, 26);
  assert.equal(TOTAL_OBSERVED, 26);

  const statusSum = B1_STATES.reduce(
    (sum, key) => sum + rec.statusCounts[key],
    0,
  );
  assert.equal(statusSum, 26);
  assert.equal(rec.games.length, 26);

  const ids = rec.games.map((g) => g.operatorGameId);
  assert.equal(new Set(ids).size, 26, "duplicate operator game");

  for (const row of rec.games) {
    assert.equal(B1_STATES.includes(row.status as (typeof B1_STATES)[number]), true);
    if (row.missedPreGameWindow) {
      assert.equal(
        row.classifiedAsPreGame,
        false,
        `fake PRE_GAME: ${row.operatorGameId}`,
      );
    }
  }

  assert.equal(rec.researchOnly, true);
  assert.equal(rec.predictionInput, false);
  assert.equal(rec.engineConnected, false);
  assert.equal(rec.leakage.predictionCalls, 0);
  assert.equal(rec.leakage.engineCalls, 0);
  assert.equal(rec.leakage.resultCalls, 0);
  assert.equal(rec.leakage.postgameCalls, 0);
  assert.equal(rec.leakage.unauthorizedCrawling, 0);
  assert.equal(rec.leakage.oddsUsedAsModelFeatures, false);
  assert.equal(rec.leakage.denominatorChanged, false);
  assert.equal(rec.leakage.gamesDropped, false);
  assert.equal(rec.leakage.gamesInvented, false);

  assert.ok(Array.isArray(rec.providerCalls));
  assert.ok(rec.providerCalls.length >= 4);

  const volleyball = rec.games.filter((g) => g.sport === "VOLLEYBALL");
  assert.equal(volleyball.length, 1);
  assert.equal(volleyball[0]!.status, "PROVIDER_NOT_SUPPORTED");

  const npb = rec.games.filter((g) => g.sport === "NPB");
  const kbo = rec.games.filter((g) => g.sport === "KBO");
  const football = rec.games.filter((g) => g.sport === "FOOTBALL");
  assert.equal(npb.length, 6);
  assert.equal(kbo.length, 5);
  assert.equal(football.length, 14);

  for (const id of ["2761", "2762", "2764"]) {
    assert.equal(FOOTBALL_HISTORICAL_UNSAFE_PROVIDER_TEAM_IDS.has(id), true);
  }
  assert.equal(FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS.has("2764"), true);
  assert.equal(FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS.has("275"), true);
  assert.equal(FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS.has("276"), true);
  assert.equal(FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS.has("2769"), true);

  const blocked2764 = resolveProviderTeam("api-football", "2764");
  assert.equal(blocked2764.status, "IDENTITY_REVIEW_REQUIRED");
  assert.ok(blocked2764.reasons.includes("K_LEAGUE_PROVIDER_ID_CONFLICT"));

  const jejuOnIncheon = resolveProviderTeam(
    "api-football",
    "2761",
    "Jeju United FC",
  );
  assert.equal(jejuOnIncheon.status, "IDENTITY_REVIEW_REQUIRED");
  assert.ok(jejuOnIncheon.reasons.includes("PROVIDER_TEAM_NAME_CONFLICT"));

  const jeonbukOnJeju = resolveProviderTeam(
    "api-football",
    "2762",
    "Jeonbuk Motors",
  );
  assert.equal(jeonbukOnJeju.status, "IDENTITY_REVIEW_REQUIRED");
  assert.ok(jeonbukOnJeju.reasons.includes("PROVIDER_TEAM_NAME_CONFLICT"));

  assert.equal(rec.footballConflictGatesPreserved.autoMatchedUnsafeIds, 0);
  assert.equal(
    rec.providerUtilization.THE_ODDS_API,
    "NOT_CALLED_IN_B1_SCHEDULE_IDENTITY_PHASE",
  );
  assert.equal(rec.providerUtilization.API_FOOTBALL.calledInB1ScheduleIdentityPhase, true);
  assert.equal(rec.providerUtilization.API_BASEBALL.calledInB1ScheduleIdentityPhase, true);
  assert.equal(rec.providerUtilization.THESPORTSDB.calledInB1ScheduleIdentityPhase, true);

  const npbHiro = rec.games.find((g) => g.rawHome === "히로카프" && g.rawAway === "요코베이");
  const npbLotte = rec.games.find((g) => g.rawHome === "지바롯데" && g.rawAway === "소프트뱅");
  assert.equal(npbHiro?.status, "MATCHED");
  assert.equal(npbLotte?.status, "MATCHED");

  const kLeague = rec.games.filter((g) => g.rawLeagueLabel === "K리그1");
  assert.equal(kLeague.length, 3);
  assert.equal(
    kLeague.every((g) => g.status === "IDENTITY_REVIEW_REQUIRED"),
    true,
  );

  const aseanRow = rec.games.find((g) => g.rawLeagueLabel === "축ASEA챔");
  assert.equal(aseanRow?.status, "IDENTITY_REVIEW_REQUIRED");
  assert.equal(aseanRow?.providerFixtureId, "1630226");

  const emperor = rec.games.filter((g) => g.rawLeagueLabel === "일본FA컵");
  assert.equal(emperor.length, 8);
  assert.equal(
    emperor.every((g) =>
      g.reasons.includes("UNREGISTERED_COMPETITION"),
    ),
    true,
  );

  for (const row of rec.games) {
    if (row.status !== "MATCHED") continue;
    for (const id of [
      row.providerHomeTeamId,
      row.providerAwayTeamId,
    ]) {
      if (!id) continue;
      assert.equal(
        FOOTBALL_HISTORICAL_UNSAFE_PROVIDER_TEAM_IDS.has(id),
        false,
        `MATCHED used unsafe id ${id} on ${row.operatorGameId}`,
      );
      assert.equal(
        FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS.has(id),
        false,
        `MATCHED used blocked id ${id} on ${row.operatorGameId}`,
      );
    }
  }

  assert.equal(
    existsSync(path.join(cwd, "data/predictions/npb/2026-08-26.json")),
    false,
    "NPB prediction snapshot must not exist",
  );
  assert.equal(
    existsSync(path.join(cwd, "data/predictions/kbo/2026-08-26.json")),
    false,
  );
  assert.equal(
    existsSync(
      path.join(cwd, "data/research/football/2026-08-26-prediction-snapshot-v0.json"),
    ),
    false,
  );

  const npbDoc = JSON.parse(
    readFileSync(path.join(cwd, NPB_SCHEDULE_REL), "utf8"),
  ) as {
    predictionInput?: boolean;
    engineConnected?: boolean;
    researchOnly?: boolean;
    schemaVersion: string;
  };
  assert.equal(npbDoc.schemaVersion, "npb-schedule-v1");
  assert.equal(npbDoc.researchOnly, true);
  assert.equal(npbDoc.predictionInput, false);
  assert.equal(npbDoc.engineConnected, false);

  const isolationDiff = execSync(
    `git diff --name-only -- ${ISOLATION_PATHS.join(" ")}`,
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(isolationDiff, "");

  console.log("test:2026-08-26-schedule-identity-reconciliation-v1 OK", {
    lockedScope: rec.lockedScope,
    accountedFor: rec.accountedFor,
    statusCounts: rec.statusCounts,
    missedPreGameWindowCount: rec.missedPreGameWindowCount,
  });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
