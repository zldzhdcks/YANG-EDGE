/**
 * Football 2026-27 opening readiness audit tests.
 * Run: npm run test:football-opening-readiness-v1
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import {
  AUDIT_REL,
  SCHEMA,
  buildFootballOpeningReadinessAudit,
} from "./audit-football-opening-readiness-v1";

const FROZEN_REL = [
  "data/predictions/mlb/2026-08-20.json",
  "data/audits/2026-08-20-pregame-freeze-close-v1.json",
  "data/audits/2026-08-20-pregame-input-close-v1.json",
  "data/audits/2026-08-20-daily-scope-lock-v1.json",
  "data/research/football/2026-08-20-schedule-v1.json",
] as const;

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function main() {
  const cwd = process.cwd();
  const before = Object.fromEntries(
    FROZEN_REL.map((rel) => [rel, sha256File(path.join(cwd, rel))]),
  );

  const { document } = buildFootballOpeningReadinessAudit(cwd);
  assert.equal(document.schemaVersion, SCHEMA);
  assert.equal(document.targets.length, 5);
  assert.equal(document.leagues.length, 5);
  assert.equal(document.network.providerCalls, 0);
  assert.equal(document.network.apiFootball, 0);
  assert.equal(document.network.theOddsApi, 0);
  assert.equal(document.predictionCalls, 0);
  assert.equal(document.frozenArtifactMutations, 0);
  assert.equal(document.mandatoryCompletion.total, "60%");

  const gateIds = [
    "config",
    "schedule",
    "identity",
    "odds",
    "freeze",
    "prediction",
    "result",
    "gradeReview",
  ] as const;

  for (const league of document.leagues) {
    const gates = league.gates;
    for (const id of gateIds) {
      assert.ok(gates[id], `${league.league} missing gate ${id}`);
      assert.ok(gates[id].score >= 0);
      assert.ok(gates[id].score <= gates[id].max);
    }
    const sum = gateIds.reduce((s, id) => s + gates[id].score, 0);
    assert.equal(sum, league.total);
    assert.ok(league.total >= 0 && league.total <= 100);
    assert.ok(
      league.status === "READY" ||
        league.status === "PARTIAL" ||
        league.status === "BLOCKED" ||
        league.status === "NOT_PROVEN",
    );
  }

  assert.equal(document.openingReadinessTable.length, 5);
  assert.equal(document.leakage.predictionSnapshotProviderCall, false);
  assert.equal(document.leakage.marketBaselineProviderCall, false);
  assert.equal(document.leakage.predictionReadsResult, false);
  assert.equal(document.operatorSlate2026_08_20.observed, 23);
  assert.equal(document.operatorSlate2026_08_20.matchedRegistered, 0);
  assert.equal(document.p0BlockerCount, document.blockers.P0.length);

  const after = Object.fromEntries(
    FROZEN_REL.map((rel) => [rel, sha256File(path.join(cwd, rel))]),
  );
  assert.deepEqual(after, before);

  const gitDiff = execSync(`git diff --name-only -- ${FROZEN_REL.join(" ")}`, {
    cwd,
    encoding: "utf8",
  }).trim();
  assert.equal(gitDiff, "");

  assert.equal(existsSync(path.join(cwd, AUDIT_REL)), true);
  console.log("PASS football-opening-readiness-v1");
}

main();
