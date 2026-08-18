/**
 * Sample separation — never mix operational, research-valid, PASS, BLOCKED,
 * and Market Baseline into one Engine-performance denominator.
 */
import type { PipelineClass, SampleLane } from "./types";

export type SampleObservation = {
  sport: string;
  dateKst: string;
  matchKey: string;
  pipelineClass: PipelineClass | "MARKET_BASELINE";
  predictionClass?: string | null;
  model?: string | null;
  engine?: string | null;
  recommendation?: string | null;
  officialPickCount?: number | null;
  officialStatus?: string | null;
  inputStatus?: string | null;
  grade?: string | null;
};

export type ClassifiedSample = SampleObservation & {
  lane: SampleLane;
  inGoodAccuracyDenominator: boolean;
  inResearchValidSample: boolean;
  inMarketBaselineBenchmark: boolean;
};

export function isFootballMarketBaseline(obs: SampleObservation): boolean {
  return (
    obs.predictionClass === "MARKET_BASELINE" ||
    obs.pipelineClass === "MARKET_BASELINE" ||
    (obs.model === "NONE" &&
      obs.engine === "NONE" &&
      obs.recommendation === "NONE" &&
      obs.officialPickCount === 0 &&
      obs.predictionClass === "MARKET_BASELINE")
  );
}

export function classifySample(obs: SampleObservation): ClassifiedSample {
  if (isFootballMarketBaseline(obs)) {
    return {
      ...obs,
      lane: "MARKET_BASELINE_BENCHMARK",
      inGoodAccuracyDenominator: false,
      inResearchValidSample: false,
      inMarketBaselineBenchmark: true,
    };
  }

  const pipeline = obs.pipelineClass;
  const official = (obs.officialStatus ?? "").toUpperCase();
  const input = (obs.inputStatus ?? "").toUpperCase();

  if (pipeline === "BLOCKED" || official === "BLOCKED" || input === "BLOCKED") {
    return {
      ...obs,
      lane: "BLOCKED_EXCLUDED",
      inGoodAccuracyDenominator: false,
      inResearchValidSample: false,
      inMarketBaselineBenchmark: false,
    };
  }

  if (pipeline === "PASS" || official === "PASS") {
    return {
      ...obs,
      lane: "PASS_OUTCOME",
      inGoodAccuracyDenominator: false,
      inResearchValidSample: false,
      inMarketBaselineBenchmark: false,
    };
  }

  if (
    pipeline === "MISSING" ||
    pipeline === "JOIN_FAILED" ||
    pipeline === "NOT_COLLECTED"
  ) {
    return {
      ...obs,
      lane: "INVALID_EXCLUDED",
      inGoodAccuracyDenominator: false,
      inResearchValidSample: false,
      inMarketBaselineBenchmark: false,
    };
  }

  if (pipeline === "GOOD" || official === "ELIGIBLE") {
    return {
      ...obs,
      lane: "RESEARCH_VALID_PREDICTION",
      inGoodAccuracyDenominator: true,
      inResearchValidSample: true,
      inMarketBaselineBenchmark: false,
    };
  }

  return {
    ...obs,
    lane: "OPERATIONAL_OBSERVATION",
    inGoodAccuracyDenominator: false,
    inResearchValidSample: false,
    inMarketBaselineBenchmark: false,
  };
}

export function summarizeSamples(rows: ClassifiedSample[]): {
  operationalObservation: number;
  researchValidSample: number;
  invalidExcludedSample: number;
  passOutcome: number;
  blockedExcluded: number;
  marketBaselineBenchmark: number;
  goodAccuracyDenominator: number;
} {
  return {
    operationalObservation: rows.filter(
      (r) => r.lane === "OPERATIONAL_OBSERVATION",
    ).length,
    researchValidSample: rows.filter((r) => r.inResearchValidSample).length,
    invalidExcludedSample: rows.filter((r) => r.lane === "INVALID_EXCLUDED")
      .length,
    passOutcome: rows.filter((r) => r.lane === "PASS_OUTCOME").length,
    blockedExcluded: rows.filter((r) => r.lane === "BLOCKED_EXCLUDED").length,
    marketBaselineBenchmark: rows.filter((r) => r.inMarketBaselineBenchmark)
      .length,
    goodAccuracyDenominator: rows.filter((r) => r.inGoodAccuracyDenominator)
      .length,
  };
}
