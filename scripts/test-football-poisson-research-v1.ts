import assert from "node:assert/strict";
import { predictFootball, scoreProbabilities, type PredictionInput, type HistoricalMatch } from "../src/lib/football/poisson-research-v1";

const history: HistoricalMatch[] = Array.from({ length: 40 }, (_, i) => ({
  matchId: `fixture-${i}`, competitionId: "league", homeTeamId: i < 10 ? "home" : `h-${i}`,
  awayTeamId: i >= 10 && i < 20 ? "away" : `a-${i}`, kickoffAt: "2026-08-01T12:00:00Z",
  resultObservedAt: "2026-08-01T15:00:00Z", regulationHomeGoals: 2, regulationAwayGoals: 1,
}));
const input: PredictionInput = { target: { matchId: "target", competitionId: "league", homeTeamId: "home", awayTeamId: "away", kickoffAt: "2026-09-10T12:00:00Z" }, cutoffAt: "2026-09-10T11:00:00Z", history };
const p = predictFootball(input);
assert.equal(p.status, "RESEARCH_PREDICTED");
assert.deepEqual(p.expectedGoals, { home: 2, away: 1 });
assert.ok(p.probabilities && p.probabilities.home > p.probabilities.away);
assert.equal(p.officialPick, null);
const symmetric = scoreProbabilities(1, 1);
assert.ok(Math.abs(symmetric.home - symmetric.away) < 1e-12);
// Analytic P(draw) for independent Poisson(1): exp(-2) * sum(1/(k!)^2).
assert.ok(Math.abs(symmetric.draw - 0.308508322553671) < 1e-10);
const high = scoreProbabilities(10, 10);
assert.ok(high.excludedMass < 2e-12);
assert.ok(Math.abs(high.home + high.draw + high.away - 1) < 1e-12);
assert.deepEqual(predictFootball({ ...input, history: [...history].reverse() }), p);
assert.equal(predictFootball({ ...input, history: [] }).status, "INSUFFICIENT_DATA");
assert.throws(() => predictFootball({ ...input, cutoffAt: input.target.kickoffAt }), /CUTOFF_NOT_PREGAME/);
assert.throws(() => predictFootball({ ...input, history: [...history, history[0]] }), /DUPLICATE/);
assert.throws(() => predictFootball({ ...input, history: [{ ...history[0], regulationHomeGoals: -1 }] }), /INVALID_REGULATION_SCORE/);
assert.throws(() => predictFootball({ ...input, cutoffAt: "not-a-date" }), /INVALID_TIMESTAMP/);
for (const row of [
  { ...history[0], matchId: "future", resultObservedAt: input.cutoffAt },
  { ...history[0], matchId: "target" },
  { ...history[0], matchId: "other-league", competitionId: "other" },
  { ...history[0], matchId: "old", kickoffAt: "2024-01-01T12:00:00Z", resultObservedAt: "2024-01-01T15:00:00Z" },
]) {
  const guarded = predictFootball({ ...input, history: [...history, row] });
  assert.deepEqual(guarded.probabilities, p.probabilities);
  assert.equal(guarded.evidence.excludedMatches, 1);
}
assert.throws(() => scoreProbabilities(NaN, 1), /INVALID_GOAL_RATE/);
console.log("PASS football-poisson-research-v1: numerical oracle, temporal exclusion, identity, sample gates, determinism");
