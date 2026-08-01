/** Scorecard v0 config — agreement thresholds; does not change prediction weights. */

export const SCORECARD_V0_CONFIG = {
  supportedMarkets: ["MONEYLINE_2WAY"] as const,
  nearEvenAbsFromHalf: 0.02,
  minCalibrationSamples: 5,
  minAgreementSamples: 5,
  componentNeutralAbs: 1e-9,
  disabledComponents: ["bullpen", "lineup"] as const,
  activeComponents: ["starter", "marketPrior", "homeAdvantage"] as const,
  probabilitySumTolerance: 1e-4,
  limitations: [
    "Single-day scorecards are observational only; do not change weights from one date.",
    "Component scorecards are DIRECTIONAL_ASSOCIATION_ONLY, not causal effects.",
    "Value realizedReturn requires settled market prices; placeholder null in v0.",
    "Unsupported markets excluded from denominators (TOTALS, RUN_LINE, FIRST_5, DOMESTIC_THREE_WAY_SPECIAL, SUM).",
    "BLOCKED games excluded from researchBaseline accuracy; counterfactual is diagnostic only.",
    "Confidence is not a win-rate calibration proxy; keep separate from probability buckets.",
  ],
} as const;
