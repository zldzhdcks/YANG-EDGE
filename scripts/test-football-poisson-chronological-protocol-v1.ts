/** Synthetic specification tests only. No archive read, network, or backtest runner. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { POLICY, predictFootball } from "../src/lib/football/poisson-research-v1/index";

const root = new URL("../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");
const config = JSON.parse(read("docs/FOOTBALL_POISSON_CHRONOLOGICAL_BACKTEST_V1.json"));
const seal = JSON.parse(read("docs/FOOTBALL_POISSON_CHRONOLOGICAL_BACKTEST_V1.seal.json"));
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
type Row = { id: number; kickoff: number; season: number; league: number };
const day = 86400000;
const T = Date.parse("2024-08-20T15:00:00.000Z");
const row = (id: number, kickoff: number, season = 2024, league = 39): Row => ({ id, kickoff, season, league });
const target = row(99, T);
function derived(r: Row) {
  return {
    derivedResearchAvailableAt: new Date(r.kickoff + config.temporal.resultLagMs).toISOString(),
    IS_ACTUAL_OBSERVED_AT: false,
    STRICT_REPLAY_PROVENANCE: false,
  };
}
function eligible(history: Row[], t: Row) {
  const cutoff = t.kickoff - config.temporal.cutoffOffsetMs;
  return history.filter(r => r.id !== t.id && r.league === t.league &&
    config.dataContract.contextSeasons.includes(r.season) && r.kickoff < cutoff &&
    Date.parse(derived(r).derivedResearchAvailableAt) < cutoff &&
    r.kickoff >= cutoff - config.model.policy.lookbackDays * day);
}
const order = (rows: Row[]) => [...rows].sort((a, b) => a.kickoff - b.kickoff || a.id - b.id);
const targets = (rows: Row[]) => order(rows.filter(r => r.league === config.dataContract.leagueId && r.season === config.dataContract.primarySeason));
type Probability = [number, number, number];
type Scored = { p: Probability; actual: number };
function validate(p: Probability) {
  assert.ok(p.every(n => Number.isFinite(n) && n >= 0 && n <= 1));
  assert.ok(Math.abs(p.reduce((a, b) => a + b, 0) - 1) <= config.output.probabilitySumTolerance);
}
function argmax(p: Probability) { validate(p); return p.indexOf(Math.max(...p)); }
function metrics(rows: Scored[], total: number) {
  assert.ok(total >= rows.length && total >= 0);
  const n = rows.length;
  const mean = (v: number) => n ? v / n : null;
  const confusion = Array.from({ length: 3 }, () => [0, 0, 0]);
  const sums = [0, 0, 0];
  let loss = 0, brier = 0, clipped = 0, correct = 0;
  for (const { p, actual } of rows) {
    assert.ok(Number.isInteger(actual) && actual >= 0 && actual < 3);
    const predicted = argmax(p);
    confusion[actual][predicted]++;
    correct += Number(predicted === actual);
    loss -= Math.log(Math.max(p[actual], config.metrics.logLossFloor));
    clipped += Number(p[actual] < config.metrics.logLossFloor);
    for (let k = 0; k < 3; k++) {
      sums[k] += p[k];
      brier += (p[k] - Number(actual === k)) ** 2;
    }
  }
  const classes = [0, 1, 2].map(k => ({
    predicted: confusion.reduce((s, r) => s + r[k], 0),
    actual: confusion[k].reduce((a, b) => a + b, 0), correct: confusion[k][k],
  }));
  return { total, predicted: n, pass: total - n, coverage: total ? n / total : null,
    accuracy: mean(correct), logLoss: mean(loss), brier: mean(brier), clipped,
    classes, drawRecall: classes[1].actual ? classes[1].correct / classes[1].actual : null,
    means: sums.map(mean), confusion };
}
function calibration(rows: Scored[], outcome: number) {
  const edges: number[] = config.calibration.edges;
  return edges.slice(0, -1).map((low, bin) => {
    const selected = rows.filter(r => r.p[outcome] >= low &&
      (bin === edges.length - 2 ? r.p[outcome] <= edges[bin + 1] : r.p[outcome] < edges[bin + 1]));
    return { count: selected.length,
      mean: selected.length ? selected.reduce((s, r) => s + r.p[outcome], 0) / selected.length : null,
      observed: selected.length ? selected.filter(r => r.actual === outcome).length / selected.length : null,
      lowSample: selected.length < config.calibration.lowSampleBelow };
  });
}
function comparator(actual: number[]): Probability | null {
  return actual.length ? [0, 1, 2].map(k => actual.filter(a => a === k).length / actual.length) as Probability : null;
}
function classify(valid: boolean, predicted: number, actualCounts: number[]) {
  if (!valid) return "INVALID";
  return predicted < config.classification.minimumPredictedMatches ||
    actualCounts.some(n => n < config.classification.minimumActualCountPerClass)
    ? "INSUFFICIENT_EVALUATION" : "BASELINE_MEASURED";
}

test("canonical protocol seal and model source hashes match", () => {
  assert.equal(hash(canonical(config)), seal.protocolSha256);
  assert.equal(canonical({ b: [2, 1], a: 0 }), '{"a":0,"b":[2,1]}');
  for (const [p, expected] of Object.entries(config.model.sourceSha256)) assert.equal(hash(read(p).replace(/\r\n/g, "\n")), expected);
  assert.equal(config.archiveSha256, "df77d7b146f4784fd4021282a6566fcfb36bdd574e1ab46ad8140a24e7585e76");
});
test("future, self and same kickoff cannot enter history", () => {
  assert.deepEqual(eligible([target, row(1, T + day), row(2, T), row(3, T - 3 * day)], target).map(r => r.id), [3]);
});
test("same kickoff groups share pre-group history regardless of numeric ID order", () => {
  const group = [row(10, T), row(2, T)];
  const pool = [row(1, T - 3 * day), ...group];
  assert.deepEqual(order(group).map(r => r.id), [2, 10]);
  assert.deepEqual(group.map(t => eligible(pool, t).map(r => r.id)), [[1], [1]]);
  assert.deepEqual(eligible(pool.reverse(), group[0]).map(r => r.id), [1]);
});
test("48-hour derived availability deterministic and strict boundary frozen", () => {
  assert.equal(config.temporal.resultLagMs, 48 * 60 * 60 * 1000);
  const c = T - 1;
  assert.deepEqual(derived(row(1, T)), derived(row(1, T)));
  assert.equal(derived(row(1, T)).derivedResearchAvailableAt, "2024-08-22T15:00:00.000Z");
  assert.deepEqual(eligible([row(1, c - 2 * day), row(2, c - 2 * day - 1), row(3, T - 2 * day)], target).map(r => r.id), [2]);
});
test("365-day lower boundary retained", () => {
  const low = T - 1 - 365 * day;
  assert.deepEqual(eligible([row(1, low, 2023), row(2, low - 1, 2023)], target).map(r => r.id), [1]);
});
test("derived records contain no fabricated observation or completion field", () => {
  const original = row(1, T); const before = JSON.stringify(original); const d = derived(original);
  assert.deepEqual(Object.keys(d).sort(), ["IS_ACTUAL_OBSERVED_AT", "STRICT_REPLAY_PROVENANCE", "derivedResearchAvailableAt"]);
  assert.equal(d.IS_ACTUAL_OBSERVED_AT, false); assert.equal(d.STRICT_REPLAY_PROVENANCE, false);
  assert.equal(JSON.stringify(original), before);
  assert.match(config.temporal.legacyAdapter, /in memory/);
});
test("only 2024 EPL targets; 2023 context eligible; other leagues/seasons excluded", () => {
  const pool = [row(1, T - 100 * day, 2023), target, row(3, T, 2025), row(4, T, 2024, 40)];
  assert.deepEqual(targets(pool), [target]);
  assert.deepEqual(eligible(pool, target).map(r => r.id), [1]);
  assert.equal(config.dataContract.targetMatchCount, 380);
});
test("actual frozen model keeps low-sample PASS and all probabilities null", () => {
  assert.deepEqual(POLICY, { version: config.model.version, ...config.model.policy });
  const result = predictFootball({ target: { matchId: "synthetic", competitionId: "39", homeTeamId: "h", awayTeamId: "a", kickoffAt: new Date(T).toISOString() }, cutoffAt: new Date(T - 1).toISOString(), history: [] });
  assert.equal(result.status, "INSUFFICIENT_DATA"); assert.equal(result.probabilities, null);
  assert.deepEqual(result.reasons, config.model.passReasons.slice(0, 3));
  assert.equal(result.officialPick, null);
});
test("uniform probabilities: exact definitions, class counts, ties and PASS denominator", () => {
  const rows: Scored[] = [0, 1, 2].map(actual => ({ actual, p: [1 / 3, 1 / 3, 1 / 3] }));
  const m = metrics(rows, 4);
  assert.equal(m.coverage, 0.75); assert.equal(m.pass, 1); assert.equal(m.accuracy, 1 / 3);
  assert.ok(Math.abs(m.logLoss! - Math.log(3)) < 1e-14);
  assert.ok(Math.abs(m.brier! - 2 / 3) < 1e-14);
  assert.deepEqual(m.classes, [{ predicted: 3, actual: 1, correct: 1 }, { predicted: 0, actual: 1, correct: 0 }, { predicted: 0, actual: 1, correct: 0 }]);
  assert.equal(m.drawRecall, 0); assert.deepEqual(m.means, [1 / 3, 1 / 3, 1 / 3]);
  assert.deepEqual(metrics(rows, 4), m);
});
test("perfect/zero/invalid probabilities and empty metrics", () => {
  assert.equal(metrics([{ actual: 0, p: [1, 0, 0] }], 1).brier, 0);
  const worst = metrics([{ actual: 1, p: [1, 0, 0] }], 1);
  assert.equal(worst.brier, 2); assert.equal(worst.clipped, 1);
  assert.equal(worst.logLoss, -Math.log(1e-15));
  assert.equal(metrics([], 380).accuracy, null); assert.equal(metrics([], 380).coverage, 0);
  assert.equal(metrics([], 380).drawRecall, null);
  assert.throws(() => argmax([0.4, 0.4, 0.4])); assert.throws(() => argmax([NaN, 0, 1]));
});
test("calibration edges, final one, empty and small bins remain visible", () => {
  const bins = calibration([{ p: [0.1, 0.9, 0], actual: 1 }, { p: [1, 0, 0], actual: 0 }], 0);
  assert.equal(bins.length, 10); assert.deepEqual(bins[0], { count: 0, mean: null, observed: null, lowSample: true });
  assert.deepEqual(bins[1], { count: 1, mean: 0.1, observed: 0, lowSample: true });
  assert.deepEqual(bins[9], { count: 1, mean: 1, observed: 1, lowSample: true });
});
test("one unsmoothed comparator from eligible history only", () => {
  const history = [row(1, T - 3 * day), row(2, T - 4 * day), row(3, T + day)];
  const actual = new Map([[1, 0], [2, 1], [3, 2]]);
  assert.deepEqual(comparator(eligible(history, target).map(r => actual.get(r.id)!)), [0.5, 0.5, 0]);
  assert.equal(comparator([]), null); assert.equal(config.comparator.count, 1);
});
test("classification floors do not auto-promote performance", () => {
  assert.equal(classify(false, 380, [150, 100, 130]), "INVALID");
  assert.equal(classify(true, 199, [100, 40, 59]), "INSUFFICIENT_EVALUATION");
  assert.equal(classify(true, 200, [100, 19, 81]), "INSUFFICIENT_EVALUATION");
  assert.equal(classify(true, 200, [100, 20, 80]), "BASELINE_MEASURED");
  assert.equal(config.classification.VALIDATED_MODEL, false);
});
test("no market/provider prediction inputs or network dependency in frozen model", () => {
  const source = read("src/lib/football/poisson-research-v1/index.ts");
  const imports = [...source.matchAll(/^import .*from "([^"]+)"/gm)].map(m => m[1]);
  assert.deepEqual(imports, ["../odds-1x2-v1/instant"]);
  assert.doesNotMatch(source + read("src/lib/football/odds-1x2-v1/instant.ts"), /\bfetch\s*\(|node:https|api-football|providerPrediction/);
  assert.equal(config.governance.ODDS_USED, false); assert.equal(config.governance.PROVIDER_PREDICTION_USED, false);
  assert.equal(config.governance.BACKTEST_EXECUTED, false); assert.equal(config.output.marketUsed, false);
  assert.ok(!config.dataContract.targetFieldsBeforePrediction.some((f: string) => /goal|odds|prediction/i.test(f)));
});
