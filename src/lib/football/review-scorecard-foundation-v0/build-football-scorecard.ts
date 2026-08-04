/**
 * Football Scorecard framework — observation metrics only.
 * predictionFormulaConnected = false always.
 */
import { gradeFootballOneXTwo } from "./grade-one-x-two";
import {
  FOOTBALL_REVIEW_SCORECARD_FOUNDATION_VERSION,
  type FootballOneXTwoGradeInput,
  type FootballOneXTwoSide,
  type FootballSampleLane,
  type FootballScorecardRowV0,
  type FootballScorecardV0,
  type FootballThreeWayProbability,
} from "./types";

const CAL_BUCKETS = [
  { id: "0.00-0.20", lo: 0, hi: 0.2 },
  { id: "0.20-0.40", lo: 0.2, hi: 0.4 },
  { id: "0.40-0.60", lo: 0.4, hi: 0.6 },
  { id: "0.60-0.80", lo: 0.6, hi: 0.8 },
  { id: "0.80-1.00", lo: 0.8, hi: 1.0000001 },
] as const;

const CONF_BUCKETS = [
  { id: "LOW", lo: 0, hi: 0.4 },
  { id: "MID", lo: 0.4, hi: 0.7 },
  { id: "HIGH", lo: 0.7, hi: 1.0000001 },
] as const;

export function validateThreeWayProbabilities(
  p: FootballThreeWayProbability,
): boolean {
  const { home, draw, away } = p;
  if (
    ![home, draw, away].every(
      (x) => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1,
    )
  ) {
    return false;
  }
  const sum = home + draw + away;
  return Math.abs(sum - 1) < 1e-6;
}

/** Multiclass Brier: Σ (p_i - o_i)^2 */
export function brierThreeWay(
  p: FootballThreeWayProbability,
  actual: FootballOneXTwoSide,
): number {
  const o = {
    home: actual === "HOME" ? 1 : 0,
    draw: actual === "DRAW" ? 1 : 0,
    away: actual === "AWAY" ? 1 : 0,
  };
  return (
    (p.home - o.home) ** 2 + (p.draw - o.draw) ** 2 + (p.away - o.away) ** 2
  );
}

/** Multiclass log loss on actual side. */
export function logLossThreeWay(
  p: FootballThreeWayProbability,
  actual: FootballOneXTwoSide,
): number {
  const eps = 1e-15;
  const prob =
    actual === "HOME" ? p.home : actual === "DRAW" ? p.draw : p.away;
  return -Math.log(Math.max(eps, Math.min(1 - eps, prob)));
}

function maxProb(p: FootballThreeWayProbability): number {
  return Math.max(p.home, p.draw, p.away);
}

function calBucketId(predictedOnActual: number): string {
  for (const b of CAL_BUCKETS) {
    if (predictedOnActual >= b.lo && predictedOnActual < b.hi) return b.id;
  }
  return CAL_BUCKETS[CAL_BUCKETS.length - 1]!.id;
}

function confBucketId(maxP: number): string {
  for (const b of CONF_BUCKETS) {
    if (maxP >= b.lo && maxP < b.hi) return b.id;
  }
  return "HIGH";
}

export type ScorecardRowInput = {
  gradeInput: FootballOneXTwoGradeInput;
  /** Observation probabilities only — never from Football Engine in this mission */
  probabilities?: FootballThreeWayProbability | null;
};

export function buildFootballScorecard(input: {
  dateKst: string;
  sampleLane: FootballSampleLane;
  rows: ScorecardRowInput[];
  generatedAt?: string;
}): FootballScorecardV0 {
  for (const r of input.rows) {
    if (r.gradeInput.sampleLane !== input.sampleLane) {
      throw new Error("SCORECARD_SAMPLE_LANE_MISMATCH");
    }
  }

  const rows: FootballScorecardRowV0[] = [];
  const briers: number[] = [];
  const logLosses: number[] = [];
  let correct = 0;
  let graded = 0;
  let blocked = 0;

  const calAccum = new Map<
    string,
    { count: number; sumP: number; hits: number }
  >();
  for (const b of CAL_BUCKETS) {
    calAccum.set(b.id, { count: 0, sumP: 0, hits: 0 });
  }
  const confAccum = new Map<string, number>();
  for (const b of CONF_BUCKETS) confAccum.set(b.id, 0);

  for (const row of input.rows) {
    const grade = gradeFootballOneXTwo(row.gradeInput);
    let brier: number | null = null;
    let logLoss: number | null = null;
    let calibrationBucket: string | null = null;
    let confidenceBucket: string | null = null;
    let probs = row.probabilities ?? null;

    if (probs && !validateThreeWayProbabilities(probs)) {
      probs = null;
    }

    if (grade.verdict === "GRADING_BLOCKED") {
      blocked += 1;
    } else {
      graded += 1;
      if (grade.verdict === "CORRECT") correct += 1;
      if (
        probs &&
        grade.actualSide &&
        (grade.verdict === "CORRECT" || grade.verdict === "INCORRECT")
      ) {
        brier = brierThreeWay(probs, grade.actualSide);
        logLoss = logLossThreeWay(probs, grade.actualSide);
        briers.push(brier);
        logLosses.push(logLoss);
        const pActual =
          grade.actualSide === "HOME"
            ? probs.home
            : grade.actualSide === "DRAW"
              ? probs.draw
              : probs.away;
        calibrationBucket = calBucketId(pActual);
        const ca = calAccum.get(calibrationBucket)!;
        ca.count += 1;
        ca.sumP += pActual;
        if (grade.verdict === "CORRECT") ca.hits += 1;
        confidenceBucket = confBucketId(maxProb(probs));
        confAccum.set(
          confidenceBucket,
          (confAccum.get(confidenceBucket) ?? 0) + 1,
        );
      }
    }

    rows.push({
      matchId: grade.matchId,
      sampleLane: input.sampleLane,
      grade,
      probabilities: probs,
      brier,
      logLoss,
      calibrationBucket,
      confidenceBucket,
      componentAlignment: "NOT_APPLICABLE",
    });
  }

  const mean = (xs: number[]) =>
    xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;

  return {
    schemaVersion: "football-scorecard-v0",
    sampleLane: input.sampleLane,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dateKst: input.dateKst,
    foundationVersion: FOOTBALL_REVIEW_SCORECARD_FOUNDATION_VERSION,
    engineImpact: "NONE",
    predictionFormulaConnected: false,
    rows,
    metrics: {
      accuracy: graded > 0 ? correct / graded : null,
      meanBrier: mean(briers),
      meanLogLoss: mean(logLosses),
      gradedCount: graded,
      blockedCount: blocked,
    },
    calibration: {
      observationOnly: true,
      buckets: CAL_BUCKETS.map((b) => {
        const a = calAccum.get(b.id)!;
        return {
          id: b.id,
          count: a.count,
          meanPredicted: a.count > 0 ? a.sumP / a.count : null,
          hitRate: a.count > 0 ? a.hits / a.count : null,
        };
      }),
    },
    confidence: {
      predictionLayerConnected: false,
      buckets: CONF_BUCKETS.map((b) => ({
        id: b.id,
        count: confAccum.get(b.id) ?? 0,
      })),
    },
    component: {
      frameworkOnly: true,
      note: "Component alignment placeholder — Engine/Weight not connected.",
    },
    observationNote:
      input.sampleLane === "RESEARCH"
        ? "Scorecard metrics are research observations only — not Official KPI."
        : "Official scorecard lane — Research samples must not be merged here.",
  };
}
