/**
 * 2026-08-25 daily scope lock — evidence-incomplete record.
 * Run: npm run test:2026-08-25-daily-scope-lock-v1
 *
 * No provider/network calls. Does not invent a denominator.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const LOCK_REL = "data/audits/2026-08-25-daily-scope-lock-v1.json";
const FOOTBALL_SCHEDULE_REL =
  "data/research/football/2026-08-25-schedule-v1.json";
const ODDS_REL = "data/research/football/2026-08-25-1x2-odds-v1.json";
const INTAKE_REL =
  "data/research/football/2026-08-25-odds-bridge-candidate-intake-v1.json";
const FOOTBALL_SCHEDULE_HASH =
  "071ce2f28755e944ab90a54ac853f32334fc0cb8a3054655b0b52e81a5c3dc16";
const ODDS_HASH =
  "617e29e4fbe397f0db73fe586bd452fa314153b7e699d60aeeb50f05d554d68f";
const INTAKE_HASH =
  "869ad8949c8f584a3528ec680d9e0bb343537e2f7bd85af214f1d80564da77c8";

const ISOLATION_PATHS = [
  "src/lib/engine",
  "src/lib/football/prediction-snapshot-v0",
  "src/lib/football/market-baseline-prediction-v0",
] as const;

type Category = {
  maxWeight: number;
  earnedWeight: number;
  status: string;
};

function main() {
  const cwd = process.cwd();
  const lockAbs = path.join(cwd, LOCK_REL);
  assert.equal(existsSync(lockAbs), true);
  const lock = JSON.parse(readFileSync(lockAbs, "utf8")) as {
    schemaVersion: string;
    dateKst: string;
    scopeLockStatus: string;
    scopeLockedAt: string | null;
    sports: string[];
    observedScope: unknown;
    scopeShrinkAfterLockForbidden: boolean;
    researchOnly: boolean;
    prediction: string;
    engine: string;
    recommendation: string;
    predictionInput: boolean;
    officialMandatoryCompletionPercentage: number | null;
    provable: Record<string, boolean>;
    missingEvidence: Record<string, boolean>;
    footballRegisteredCompetitionSchedule: {
      rel: string;
      artifactHash: string;
      scheduleGames: number;
      identityMatched: number;
      identityBlocked: number;
      blockedProviderMatchIds: string[];
    };
    relatedFootballResearch: {
      originalZeroEligibleOddsArtifactHash: string;
      candidateIntakeArtifactHash: string;
      doesNotEqualDailyOperatingScope: boolean;
    };
    mandatoryCompletion: {
      officialMandatoryCompletionPercentage: number | null;
      categories: Record<string, Category>;
    };
    note: string;
  };

  assert.equal(lock.schemaVersion, "yang-edge-daily-scope-lock-v1");
  assert.equal(lock.dateKst, "2026-08-25");
  assert.equal(lock.scopeLockStatus, "EVIDENCE_INCOMPLETE");
  assert.equal(lock.scopeLockedAt, null);
  assert.deepEqual(lock.sports, []);
  assert.equal(lock.observedScope, null);
  assert.equal(lock.scopeShrinkAfterLockForbidden, true);
  assert.equal(lock.researchOnly, true);
  assert.equal(lock.prediction, "NONE");
  assert.equal(lock.engine, "NONE");
  assert.equal(lock.recommendation, "NONE");
  assert.equal(lock.predictionInput, false);
  assert.equal(lock.officialMandatoryCompletionPercentage, null);
  assert.equal(
    lock.mandatoryCompletion.officialMandatoryCompletionPercentage,
    null,
  );
  assert.equal(lock.provable.fullDailyOperatingDenominator, false);
  assert.equal(lock.provable.mlbOperatingScope, false);
  assert.equal(lock.provable.operatorObservedScope, false);
  assert.equal(lock.provable.domesticOperatorScope, false);
  assert.equal(lock.provable.footballRegisteredCompetitionSchedule, true);
  assert.equal(lock.missingEvidence.operatorObservation20260825, true);
  assert.equal(lock.missingEvidence.mlbSchedule20260825, true);
  assert.ok(
    lock.note.includes(
      "not permission to invent or shrink the denominator",
    ),
  );

  assert.equal(existsSync(path.join(cwd, FOOTBALL_SCHEDULE_REL)), true);
  assert.equal(existsSync(path.join(cwd, ODDS_REL)), true);
  assert.equal(existsSync(path.join(cwd, INTAKE_REL)), true);
  assert.equal(
    existsSync(path.join(cwd, "data/research/mlb/2026-08-25-schedule-v1.json")),
    false,
  );
  assert.equal(
    existsSync(
      path.join(cwd, "data/operator-observations/structured/2026-08-25"),
    ),
    false,
  );
  assert.equal(
    existsSync(path.join(cwd, "data/operator-observations/raw/2026-08-25")),
    false,
  );

  const schedule = JSON.parse(
    readFileSync(path.join(cwd, FOOTBALL_SCHEDULE_REL), "utf8"),
  ) as {
    meta: {
      artifactHash: string;
      scheduleGames: number;
      identityMatched: number;
      identityBlocked: number;
    };
    rows: Array<{
      providerMatchId: string;
      identityStatus: string;
    }>;
  };
  assert.equal(schedule.meta.artifactHash, FOOTBALL_SCHEDULE_HASH);
  assert.equal(
    lock.footballRegisteredCompetitionSchedule.artifactHash,
    FOOTBALL_SCHEDULE_HASH,
  );
  assert.equal(lock.footballRegisteredCompetitionSchedule.rel, FOOTBALL_SCHEDULE_REL);
  assert.equal(schedule.meta.scheduleGames, 8);
  assert.equal(lock.footballRegisteredCompetitionSchedule.scheduleGames, 8);
  assert.equal(schedule.rows.length, 8);
  assert.equal(schedule.meta.identityMatched, 6);
  assert.equal(schedule.meta.identityBlocked, 2);
  assert.deepEqual(
    lock.footballRegisteredCompetitionSchedule.blockedProviderMatchIds,
    ["1507040", "1507041"],
  );
  const blocked = schedule.rows
    .filter((r) => r.identityStatus === "IDENTITY_REVIEW_REQUIRED")
    .map((r) => r.providerMatchId)
    .sort();
  assert.deepEqual(blocked, ["1507040", "1507041"]);

  const odds = JSON.parse(readFileSync(path.join(cwd, ODDS_REL), "utf8")) as {
    meta: { artifactHash: string };
  };
  const intake = JSON.parse(
    readFileSync(path.join(cwd, INTAKE_REL), "utf8"),
  ) as { meta: { artifactHash: string } };
  assert.equal(odds.meta.artifactHash, ODDS_HASH);
  assert.equal(
    lock.relatedFootballResearch.originalZeroEligibleOddsArtifactHash,
    ODDS_HASH,
  );
  assert.equal(intake.meta.artifactHash, INTAKE_HASH);
  assert.equal(
    lock.relatedFootballResearch.candidateIntakeArtifactHash,
    INTAKE_HASH,
  );
  assert.equal(
    lock.relatedFootballResearch.doesNotEqualDailyOperatingScope,
    true,
  );

  const cats = lock.mandatoryCompletion.categories;
  const weights = Object.values(cats);
  assert.equal(
    weights.reduce((sum, c) => sum + c.maxWeight, 0),
    100,
  );
  assert.equal(
    weights.reduce((sum, c) => sum + c.earnedWeight, 0),
    0,
  );
  assert.equal(cats.A_slateScheduleConfirmation.status, "NOT_PROVABLE");
  assert.equal(cats.B_pregameInputsIdentityOdds.status, "NOT_PROVABLE");
  assert.equal(cats.C_predictionSnapshotPassSeal.status, "NOT_STARTED");
  assert.equal(cats.D_pregameGitRemoteSeal.status, "NOT_PROVABLE");
  assert.equal(cats.E_resultGrade.status, "NOT_STARTED");
  assert.equal(cats.F_reviewScorecard.status, "NOT_STARTED");
  assert.equal(cats.G_dailyCloseAuditGitSync.status, "NOT_PROVABLE");

  const isolationDiff = execSync(
    `git diff --name-only -- ${ISOLATION_PATHS.join(" ")}`,
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(isolationDiff, "");

  console.log("PASS 2026-08-25 daily scope lock (EVIDENCE_INCOMPLETE)");
}

main();
