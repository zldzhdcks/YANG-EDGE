/** Synthetic tests only. Never reads the historical archive or executes the CLI. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { predictFootball } from "../src/lib/football/poisson-research-v1/index";
import { verifyProtocol, verifyArchive, validateArchive, targetMetadata, eligibleHistory, predictOne, execute, score, classification, order, sha, empirical, validateProbability, type Match, type Protocol } from "./football-poisson-backtest-v1-core";
import { denyNetwork } from "./run-football-poisson-chronological-backtest-v1";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const configText = read("docs/FOOTBALL_POISSON_CHRONOLOGICAL_BACKTEST_V1.json");
const p = verifyProtocol(configText), day = 86400000;
function match(id: number, kickoff: string, home = 1, away = 2, season = 2024): Match {
  return { provider: "API_FOOTBALL", providerFixtureId: id, leagueId: 39, leagueName: "Premier League", season, kickoffUtc: kickoff,
    homeTeamId: home, awayTeamId: away, homeTeamName: `Team ${home}`, awayTeamName: `Team ${away}`, fixtureStatus: "FT",
    fullTimeHomeGoals: 2, fullTimeAwayGoals: 1, strictReplayEligible: false, resultCompletedAt: null, strictAsOfProvenance: "UNAVAILABLE" };
}
const t = match(999, "2024-08-20T15:00:00.000Z");
const ms = Date.parse(t.kickoffUtc), iso = (n: number) => new Date(n).toISOString();
function syntheticArchive() {
  const matches: Match[] = []; let id = 1;
  for (const season of [2023, 2024]) {
    let n = 0;
    for (let home = 1; home <= 20; home++) for (let away = 1; away <= 20; away++) if (home !== away) {
      matches.push(match(id++, iso(Date.parse(`${season}-08-01T15:00:00.000Z`) + Math.floor(n++ / 10) * 7 * day), home, away, season));
    }
  }
  return { schemaVersion: "football-epl-historical-archive-v1", strictReplayEligible: false, matches };
}
test("frozen protocol and archive hashes fail closed", () => {
  assert.throws(() => verifyProtocol(configText.replace('172800000', '172800001')), /PROTOCOL_HASH_MISMATCH/);
  assert.throws(() => verifyArchive(Buffer.from('{}'), p), /ARCHIVE_HASH_MISMATCH/);
  assert.equal(p.temporal.resultLagMs, 48 * 60 * 60 * 1000); assert.equal(p.model.policy.lookbackDays, 365);
});
test("760 canonical synthetic archive yields exactly 380 ordered 2024 targets", () => {
  const a = syntheticArchive(); const rows = validateArchive(a, p);
  const targets = targetMetadata(rows, p);
  assert.equal(targets.length, 380); assert.equal(targets[0].providerFixtureId, 381);
  assert.deepEqual(targetMetadata([...rows].reverse(), p), targets);
  assert.deepEqual(order([match(10, t.kickoffUtc), match(2, t.kickoffUtc)]).map(r => r.providerFixtureId), [2, 10]);
  assert.throws(() => targetMetadata(rows.slice(1, -1), p), /TARGET_COUNT_MISMATCH/);
  assert.ok(targets.every(r => !('fullTimeHomeGoals' in r) && !('fullTimeAwayGoals' in r)));
});
test("duplicate, non-FT, scores, identity and fabricated timestamps invalid", () => {
  for (const mutate of [
    (a: ReturnType<typeof syntheticArchive>) => { a.matches[1].providerFixtureId = a.matches[0].providerFixtureId; },
    (a: ReturnType<typeof syntheticArchive>) => { a.matches[1].fixtureStatus = "AET"; },
    (a: ReturnType<typeof syntheticArchive>) => { a.matches[1].fullTimeHomeGoals = -1; },
    (a: ReturnType<typeof syntheticArchive>) => { a.matches[1].homeTeamName = "Wrong"; },
    (a: ReturnType<typeof syntheticArchive>) => { Object.assign(a.matches[1], { observedAt: t.kickoffUtc }); },
  ]) { const a = syntheticArchive(); mutate(a); assert.throws(() => validateArchive(a, p)); }
});
test("48h strict boundary, 365d inclusive boundary, future, self and group exclusion", () => {
  const c = ms - 1;
  const rows = [t, match(1, iso(ms + day)), match(2, t.kickoffUtc), match(3, iso(c - 2 * day)),
    match(4, iso(c - 2 * day - 1)), match(5, iso(c - 365 * day), 1, 2, 2023), match(6, iso(c - 365 * day - 1), 1, 2, 2023)];
  assert.deepEqual(eligibleHistory(rows, t, p).map(r => r.providerFixtureId), [5, 4]);
  assert.throws(() => predictOne(t, [rows[2]], p), /INELIGIBLE_HISTORY/);
});
test("prediction persisted before labels read, PASS null and no synthetic observedAt serialized", () => {
  let persisted = false, calls = 0;
  const target = match(1, t.kickoffUtc);
  for (const name of ["fullTimeHomeGoals", "fullTimeAwayGoals"]) Object.defineProperty(target, name, { get() { assert.ok(persisted, "LABEL_READ_BEFORE_PERSISTENCE"); return 1; } });
  const protocol: Protocol = { ...p, dataContract: { ...p.dataContract, targetMatchCount: 1 } };
  const output = execute([target], protocol, text => {
    const rows = JSON.parse(text); assert.equal(rows.length, 1);
    for (const key of ["actualHomeGoals", "actualAwayGoals", "actualClass", "correct1X2"]) assert.ok(!(key in rows[0]));
    assert.doesNotMatch(text, /"resultObservedAt"|"observedAt"/); persisted = true; return text;
  }, input => {
    calls++; assert.deepEqual(Object.keys(input.target).sort(), ["awayTeamId", "competitionId", "homeTeamId", "kickoffAt", "matchId"]);
    assert.equal(input.history.length, 0); return predictFootball(input);
  });
  assert.equal(calls, 1); assert.equal(output.records[0].status, "PASS");
  for (const key of ["pHome", "pDraw", "pAway", "predictedClass", "correct1X2"] as const) assert.equal(output.records[0][key], null);
  assert.equal(output.records[0].IS_ACTUAL_OBSERVED_AT, false);
});
test("failed/tampered prediction persistence prevents result join", () => {
  const protocol = { ...p, dataContract: { ...p.dataContract, targetMatchCount: 1 } };
  const target = match(1, t.kickoffUtc);
  Object.defineProperty(target, "fullTimeHomeGoals", { get() { throw new Error("LABEL_SHOULD_NOT_BE_READ"); } });
  assert.throws(() => execute([target], protocol, () => { throw new Error("DISK_FAILURE"); }), /DISK_FAILURE/);
  assert.throws(() => execute([target], protocol, () => "[]"), /PREDICTION_PERSISTENCE_MISMATCH/);
});
test("same kickoff targets use identical history and paired comparator", () => {
  const history = Array.from({ length: 40 }, (_, i) => match(i + 1, iso(ms - (i + 3) * day), 1, 2, 2023));
  const ts = [match(100, t.kickoffUtc), match(99, t.kickoffUtc)];
  const protocol = { ...p, dataContract: { ...p.dataContract, targetMatchCount: 2 } };
  const r = execute([...history, ...ts], protocol, text => text);
  assert.equal(r.summary.PREDICTED_MATCHES, 2); assert.deepEqual(r.pairedFixtureIds, [99, 100]);
  assert.deepEqual(r.records[0].eligibleTrainingFixtureIds, r.records[1].eligibleTrainingFixtureIds);
  assert.ok(!r.records[0].eligibleTrainingFixtureIds.some(id => id === 99 || id === 100));
  assert.equal(r.poisson.count, r.comparator.count); assert.equal(r.poisson.calibration.length, 30); assert.equal(r.comparator.calibration.length, 30);
  assert.equal(r.records[0].trainingAvailability[0].IS_ACTUAL_OBSERVED_AT, false);
});
test("independent metric oracles, deterministic tie, zero floor and null denominators", () => {
  const m = score(["HOME", "DRAW", "AWAY"].map(actualClass => ({ probabilities: [1 / 3, 1 / 3, 1 / 3] as [number, number, number], actualClass: actualClass as "HOME" | "DRAW" | "AWAY" })), p);
  assert.equal(m.accuracy, 1 / 3); assert.ok(Math.abs(m.logLoss! - Math.log(3)) < 1e-14); assert.ok(Math.abs(m.brier! - 2 / 3) < 1e-14);
  assert.deepEqual(m.confusionMatrix.values, [[1, 0, 0], [1, 0, 0], [1, 0, 0]]); assert.equal(m.drawRecall, 0);
  const worst = score([{ probabilities: [1, 0, 0], actualClass: "DRAW" }], p);
  assert.equal(worst.brier, 2); assert.equal(worst.logLoss, -Math.log(1e-15)); assert.equal(worst.logLossFloorCount, 1);
  assert.equal(score([], p).accuracy, null); assert.equal(score([], p).drawRecall, null);
  assert.throws(() => validateProbability([0.5, 0.5, 0.5], p)); assert.throws(() => validateProbability([NaN, 0, 1], p));
});
test("calibration retains empty bins and edge 0.1 and 1; empirical comparator unsmoothed", () => {
  const bins = score([{ probabilities: [0.1, 0.9, 0], actualClass: "DRAW" }, { probabilities: [1, 0, 0], actualClass: "HOME" }], p).calibration;
  assert.equal(bins.length, 30); assert.equal(bins[0].predictionCount, 0); assert.equal(bins[0].observedFrequency, null);
  assert.equal(bins[1].predictionCount, 1); assert.equal(bins[9].predictionCount, 1); assert.equal(bins[9].observedFrequency, 1);
  assert.ok(bins.every(b => b.lowSample)); assert.deepEqual(empirical([t]), [1, 0, 0]); assert.equal(empirical([]), null);
});
test("classification uses preregistered sample floors only", () => {
  assert.equal(classification(199, [100, 40, 59], p), "INSUFFICIENT_EVALUATION");
  assert.equal(classification(200, [100, 19, 81], p), "INSUFFICIENT_EVALUATION");
  assert.equal(classification(200, [100, 20, 80], p), "BASELINE_MEASURED");
});
test("synthetic full cohort executes offline with all 380 records and persistence seal", () => {
  const a = syntheticArchive(); let persisted = "";
  const r = execute(a.matches, p, text => { persisted = text; return text; });
  assert.equal(r.records.length, 380); assert.equal(r.predictionSha256, sha(persisted));
  assert.equal(r.summary.PREDICTED_MATCHES + r.summary.PASS_MATCHES, 380);
  assert.equal(r.comparator.count, r.summary.PREDICTED_MATCHES);
  assert.ok(r.records.every(r => !r.eligibleTrainingFixtureIds.includes(r.providerFixtureId)));
});
test("no network calls on actual computation path; guard denies attempts", () => {
  const attempts = denyNetwork();
  execute([t], { ...p, dataContract: { ...p.dataContract, targetMatchCount: 1 } }, text => text);
  assert.equal(attempts(), 0);
  assert.throws(() => globalThis.fetch("https://example.invalid"), /NETWORK_FORBIDDEN/); assert.equal(attempts(), 1);
  const source = read("scripts/football-poisson-backtest-v1-core.ts");
  assert.doesNotMatch(source, /\bfetch\s*\(|node:http|node:fs|owner-risk|providerPrediction/);
});
