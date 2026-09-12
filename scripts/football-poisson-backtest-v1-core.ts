/** Offline research adapter. No production wiring, provider clients or file IO. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { POLICY, predictFootball, type HistoricalMatch } from "../src/lib/football/poisson-research-v1/index";

export const PROTOCOL_SHA = "5388a9fa829ef7f4aad181a464d60daf6ab2e60de4de1d046701ffc666e91b75";
export const ARCHIVE_SHA = "df77d7b146f4784fd4021282a6566fcfb36bdd574e1ab46ad8140a24e7585e76";
export const FREEZE_COMMIT = "e138db1fb8b4e90c4eda746e35a5c96419c385cf";
export type Protocol = {
  protocolVersion: string; archiveSha256: string;
  model: { version: string; policy: Omit<typeof POLICY, "version">; sourceSha256: Record<string, string>; passReasons: string[] };
  dataContract: { provider: string; leagueId: number; primarySeason: number; contextSeasons: number[]; archiveMatchCount: number; targetMatchCount: number };
  temporal: { resultLagMs: number; cutoffOffsetMs: number };
  output: { probabilitySumTolerance: number };
  metrics: { logLossFloor: number };
  calibration: { edges: number[]; lowSampleBelow: number };
  classification: { minimumPredictedMatches: number; minimumActualCountPerClass: number };
};
export const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}
export function verifyProtocol(bytes: string): Protocol {
  const p: Protocol = JSON.parse(bytes);
  assert.equal(sha(canonical(p)), PROTOCOL_SHA, "PROTOCOL_HASH_MISMATCH");
  assert.equal(p.archiveSha256, ARCHIVE_SHA);
  assert.deepEqual(POLICY, { version: p.model.version, ...p.model.policy });
  return p;
}
export type Match = {
  provider: string; providerFixtureId: number; leagueId: number; leagueName: string; season: number;
  kickoffUtc: string; homeTeamId: number; awayTeamId: number; homeTeamName: string; awayTeamName: string;
  fixtureStatus: string; fullTimeHomeGoals: number; fullTimeAwayGoals: number;
  strictReplayEligible: boolean; resultCompletedAt: null; strictAsOfProvenance: string;
};
export type Target = Pick<Match, "providerFixtureId" | "leagueId" | "kickoffUtc" | "homeTeamId" | "awayTeamId" | "homeTeamName" | "awayTeamName">;
export const classes = ["HOME", "DRAW", "AWAY"] as const;
export type Outcome = typeof classes[number];
export type Prob = [number, number, number];
const epoch = (s: string) => { const n = Date.parse(s); assert.ok(Number.isFinite(n) && new Date(n).toISOString() === s, "NONCANONICAL_UTC"); return n; };
const id = (n: number) => `API_FOOTBALL:${n}`;
const resultClass = (h: number, a: number): Outcome => h > a ? "HOME" : h === a ? "DRAW" : "AWAY";
export const order = <T extends { kickoffUtc: string; providerFixtureId: number }>(rows: T[]) => [...rows].sort((a, b) => epoch(a.kickoffUtc) - epoch(b.kickoffUtc) || a.providerFixtureId - b.providerFixtureId);
export function validateArchive(value: unknown, p: Protocol): Match[] {
  const a = value as { schemaVersion: string; strictReplayEligible: boolean; matches: Match[] };
  assert.equal(a.schemaVersion, "football-epl-historical-archive-v1");
  assert.equal(a.strictReplayEligible, false);
  assert.ok(Array.isArray(a.matches)); assert.equal(a.matches.length, p.dataContract.archiveMatchCount);
  const seen = new Set<number>(), names = new Map<number, string>();
  for (const r of a.matches) {
    assert.equal(r.provider, p.dataContract.provider); assert.equal(r.leagueId, p.dataContract.leagueId);
    assert.equal(r.leagueName, "Premier League"); assert.ok(p.dataContract.contextSeasons.includes(r.season));
    assert.ok(Number.isSafeInteger(r.providerFixtureId) && r.providerFixtureId > 0 && !seen.has(r.providerFixtureId), "DUPLICATE_OR_INVALID_FIXTURE"); seen.add(r.providerFixtureId);
    epoch(r.kickoffUtc); assert.equal(r.fixtureStatus, "FT");
    assert.ok([r.fullTimeHomeGoals, r.fullTimeAwayGoals].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 100));
    assert.notEqual(r.homeTeamId, r.awayTeamId);
    for (const [team, name] of [[r.homeTeamId, r.homeTeamName], [r.awayTeamId, r.awayTeamName]] as const) {
      assert.ok(Number.isSafeInteger(team) && team > 0 && typeof name === "string" && name.trim().length > 0);
      if (names.has(team)) assert.equal(names.get(team), name, "TEAM_IDENTITY_MISMATCH");
      names.set(team, name);
    }
    assert.equal(r.strictReplayEligible, false); assert.equal(r.resultCompletedAt, null); assert.equal(r.strictAsOfProvenance, "UNAVAILABLE");
    assert.ok(!("observedAt" in r) && !("resultObservedAt" in r), "FABRICATED_OBSERVATION");
  }
  for (const season of p.dataContract.contextSeasons) {
    const rows = a.matches.filter(r => r.season === season);
    assert.equal(rows.length, 380);
    assert.equal(new Set(rows.flatMap(r => [r.homeTeamId, r.awayTeamId])).size, 20);
    assert.equal(new Set(rows.map(r => `${r.homeTeamId}:${r.awayTeamId}`)).size, 380);
  }
  return a.matches;
}
export function verifyArchive(bytes: Buffer, p: Protocol) {
  assert.equal(sha(bytes), ARCHIVE_SHA, "ARCHIVE_HASH_MISMATCH");
  return validateArchive(JSON.parse(bytes.toString("utf8")), p);
}
export function targetMetadata(matches: Match[], p: Protocol): Target[] {
  const ts = order(matches.filter(r => r.season === p.dataContract.primarySeason && r.leagueId === p.dataContract.leagueId)).map(r => Object.freeze({
    providerFixtureId: r.providerFixtureId, leagueId: r.leagueId, kickoffUtc: r.kickoffUtc,
    homeTeamId: r.homeTeamId, awayTeamId: r.awayTeamId, homeTeamName: r.homeTeamName, awayTeamName: r.awayTeamName,
  }));
  assert.equal(ts.length, p.dataContract.targetMatchCount, "TARGET_COUNT_MISMATCH");
  return ts;
}
export function eligibleHistory(matches: Match[], t: Target, p: Protocol) {
  const cutoff = epoch(t.kickoffUtc) - p.temporal.cutoffOffsetMs;
  return order(matches.filter(r => r.providerFixtureId !== t.providerFixtureId && r.leagueId === t.leagueId &&
    p.dataContract.contextSeasons.includes(r.season) && epoch(r.kickoffUtc) < cutoff &&
    epoch(r.kickoffUtc) + p.temporal.resultLagMs < cutoff && epoch(r.kickoffUtc) >= cutoff - p.model.policy.lookbackDays * 86400000));
}
export function validateProbability(prob: Prob, p: Protocol) {
  assert.ok(prob.every(n => Number.isFinite(n) && n >= 0 && n <= 1), "INVALID_PROBABILITY");
  assert.ok(Math.abs(prob.reduce((a, b) => a + b, 0) - 1) <= p.output.probabilitySumTolerance, "INVALID_PROBABILITY_SUM");
}
const winner = (prob: Prob): Outcome => classes[prob.indexOf(Math.max(...prob))];
export function empirical(history: Match[]): Prob | null {
  return history.length ? classes.map(c => history.filter(r => resultClass(r.fullTimeHomeGoals, r.fullTimeAwayGoals) === c).length / history.length) as Prob : null;
}
export function predictOne(t: Target, history: Match[], p: Protocol, predictor = predictFootball) {
  const cutoffAt = new Date(epoch(t.kickoffUtc) - p.temporal.cutoffOffsetMs).toISOString();
  assert.deepEqual(eligibleHistory(history, t, p).map(r => r.providerFixtureId), history.map(r => r.providerFixtureId), "INELIGIBLE_HISTORY");
  const provenance = history.map(r => ({ providerFixtureId: r.providerFixtureId,
    derivedResearchAvailableAt: new Date(epoch(r.kickoffUtc) + p.temporal.resultLagMs).toISOString(),
    IS_ACTUAL_OBSERVED_AT: false, STRICT_REPLAY_PROVENANCE: false }));
  // Legacy slot exists only for this call. Serialized output retains canonical derived field, never observedAt.
  const legacy: HistoricalMatch[] = history.map((r, i) => ({ matchId: id(r.providerFixtureId), competitionId: String(r.leagueId),
    homeTeamId: String(r.homeTeamId), awayTeamId: String(r.awayTeamId), kickoffAt: r.kickoffUtc,
    resultObservedAt: provenance[i].derivedResearchAvailableAt, regulationHomeGoals: r.fullTimeHomeGoals, regulationAwayGoals: r.fullTimeAwayGoals }));
  const model = predictor({ target: { matchId: id(t.providerFixtureId), competitionId: String(t.leagueId),
    homeTeamId: String(t.homeTeamId), awayTeamId: String(t.awayTeamId), kickoffAt: t.kickoffUtc }, cutoffAt, history: legacy });
  assert.equal(model.modelVersion, p.model.version);
  assert.equal(model.evidence.competitionMatches, history.length);
  assert.deepEqual([...model.evidence.sourceMatchIds].sort(), history.map(r => id(r.providerFixtureId)).sort());
  assert.equal(model.evidence.homeVenueMatches, history.filter(r => r.homeTeamId === t.homeTeamId).length);
  assert.equal(model.evidence.awayVenueMatches, history.filter(r => r.awayTeamId === t.awayTeamId).length);
  const prob: Prob | null = model.probabilities ? [model.probabilities.home, model.probabilities.draw, model.probabilities.away] : null;
  if (prob) { assert.equal(model.status, "RESEARCH_PREDICTED"); validateProbability(prob, p); }
  else { assert.equal(model.status, "INSUFFICIENT_DATA"); assert.ok(model.reasons.length > 0 && model.reasons.every(r => p.model.passReasons.includes(r))); }
  const comp = empirical(history); if (comp) validateProbability(comp, p);
  if (prob) assert.ok(comp, "UNPAIRED_COMPARATOR");
  return { providerFixtureId: t.providerFixtureId, kickoffUtc: t.kickoffUtc, homeTeam: t.homeTeamName, awayTeam: t.awayTeamName,
    homeTeamId: t.homeTeamId, awayTeamId: t.awayTeamId, cutoffAt,
    trainingMatchCount: model.evidence.competitionMatches, homeRelevantSampleCount: model.evidence.homeVenueMatches,
    awayRelevantSampleCount: model.evidence.awayVenueMatches, latestEligibleTrainingKickoff: history.at(-1)?.kickoffUtc ?? null,
    eligibleTrainingFixtureIds: history.map(r => r.providerFixtureId), trainingAvailability: provenance,
    status: prob ? "PREDICTED" as const : "PASS" as const, modelStatus: model.status, passReason: model.reasons,
    pHome: prob?.[0] ?? null, pDraw: prob?.[1] ?? null, pAway: prob?.[2] ?? null, predictedClass: prob ? winner(prob) : null,
    comparatorProbabilities: comp, modelVersion: model.modelVersion, archiveSha256: ARCHIVE_SHA, protocolSha256: PROTOCOL_SHA,
    backtestProtocolVersion: p.protocolVersion, marketUsed: false, strictReplay: false,
    IS_ACTUAL_OBSERVED_AT: false, STRICT_REPLAY_PROVENANCE: false };
}
export type Prediction = ReturnType<typeof predictOne>;
export function predictionPhase(matches: Match[], p: Protocol, predictor = predictFootball): Prediction[] {
  const targets = targetMetadata(matches, p), output: Prediction[] = [];
  for (let i = 0; i < targets.length;) {
    let end = i + 1; while (end < targets.length && targets[end].kickoffUtc === targets[i].kickoffUtc) end++;
    const history = eligibleHistory(matches, targets[i], p);
    const before = sha(canonical(history));
    for (const t of targets.slice(i, end)) output.push(predictOne(t, history, p, predictor));
    assert.equal(sha(canonical(history)), before, "GROUP_HISTORY_MUTATED");
    i = end;
  }
  return output;
}
export type Scored = { probabilities: Prob; actualClass: Outcome };
export function score(rows: Scored[], p: Protocol) {
  const n = rows.length, mean = (x: number) => n ? x / n : null;
  const matrix = Array.from({ length: 3 }, () => [0, 0, 0]);
  const sums = [0, 0, 0]; let correct = 0, log = 0, brier = 0, floorCount = 0;
  for (const r of rows) {
    validateProbability(r.probabilities, p);
    const actual = classes.indexOf(r.actualClass), predicted = classes.indexOf(winner(r.probabilities));
    assert.ok(actual >= 0); matrix[actual][predicted]++; correct += Number(actual === predicted);
    log -= Math.log(Math.max(r.probabilities[actual], p.metrics.logLossFloor)); floorCount += Number(r.probabilities[actual] < p.metrics.logLossFloor);
    for (let k = 0; k < 3; k++) { sums[k] += r.probabilities[k]; brier += (r.probabilities[k] - Number(actual === k)) ** 2; }
  }
  const classMetrics = classes.map((name, k) => ({ outcome: name, predicted: matrix.reduce((s, r) => s + r[k], 0), actual: matrix[k].reduce((a, b) => a + b, 0), correct: matrix[k][k] }));
  const calibration = classes.flatMap((outcome, k) => p.calibration.edges.slice(0, -1).map((lower, i) => {
    const upper = p.calibration.edges[i + 1], final = i === p.calibration.edges.length - 2;
    const rs = rows.filter(r => r.probabilities[k] >= lower && (final ? r.probabilities[k] <= upper : r.probabilities[k] < upper));
    return { outcome, lower, upper, upperInclusive: final, predictionCount: rs.length,
      meanPredictedProbability: rs.length ? rs.reduce((s, r) => s + r.probabilities[k], 0) / rs.length : null,
      observedFrequency: rs.length ? rs.filter(r => r.actualClass === outcome).length / rs.length : null, lowSample: rs.length < p.calibration.lowSampleBelow };
  }));
  assert.equal(calibration.length, 30);
  return { count: n, accuracy: mean(correct), logLoss: mean(log), brier: mean(brier), logLossFloorCount: floorCount,
    classMetrics, drawRecall: classMetrics[1].actual ? classMetrics[1].correct / classMetrics[1].actual : null,
    meanPHome: mean(sums[0]), meanPDraw: mean(sums[1]), meanPAway: mean(sums[2]),
    confusionMatrix: { rows: classes, columns: classes, values: matrix }, calibration };
}
export function classification(predicted: number, actualCounts: number[], p: Protocol) {
  return predicted < p.classification.minimumPredictedMatches || actualCounts.some(n => n < p.classification.minimumActualCountPerClass)
    ? "INSUFFICIENT_EVALUATION" : "BASELINE_MEASURED";
}
/** Writer must return exact bytes read back after durable prediction persistence. No labels joined before it returns. */
export function execute(matches: Match[], p: Protocol, persistPredictions: (text: string) => string, predictor = predictFootball) {
  const predictions = predictionPhase(matches, p, predictor);
  const bytes = JSON.stringify(predictions, null, 2) + "\n";
  const persisted = persistPredictions(bytes);
  assert.equal(sha(persisted), sha(bytes), "PREDICTION_PERSISTENCE_MISMATCH");
  const frozen: Prediction[] = JSON.parse(persisted);
  const labels = new Map(matches.map(r => [r.providerFixtureId, r]));
  const records = frozen.map(r => {
    const actual = labels.get(r.providerFixtureId)!; assert.ok(actual);
    const actualClass = resultClass(actual.fullTimeHomeGoals, actual.fullTimeAwayGoals);
    return { ...r, actualHomeGoals: actual.fullTimeHomeGoals, actualAwayGoals: actual.fullTimeAwayGoals, actualClass,
      correct1X2: r.status === "PASS" ? null : r.predictedClass === actualClass };
  });
  const cohort = records.filter(r => r.status === "PREDICTED");
  const poisson = score(cohort.map(r => ({ probabilities: [r.pHome!, r.pDraw!, r.pAway!], actualClass: r.actualClass })), p);
  const comparator = score(cohort.map(r => { assert.ok(r.comparatorProbabilities); return { probabilities: r.comparatorProbabilities, actualClass: r.actualClass }; }), p);
  assert.equal(poisson.count, comparator.count);
  return { summary: { TOTAL_TARGET_MATCHES: records.length, PREDICTED_MATCHES: cohort.length, PASS_MATCHES: records.length - cohort.length,
    COVERAGE: cohort.length / records.length, BACKTEST_CLASSIFICATION: classification(cohort.length, poisson.classMetrics.map(r => r.actual), p), VALIDATED_MODEL: false },
    poisson, comparator: { name: "ELIGIBLE_HISTORY_EMPIRICAL_1X2", ...comparator }, records,
    predictionSha256: sha(persisted), pairedFixtureIds: cohort.map(r => r.providerFixtureId) };
}
