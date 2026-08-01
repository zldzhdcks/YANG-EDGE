/**
 * Deterministic moneyline probability + confidence + status.
 */
import {
  MLB_PREDICTION_V0_CALIBRATION as C,
  MLB_PREDICTION_V0_OFFICIAL,
  MLB_PREDICTION_V0_WEIGHTS as W,
} from "./config";
import { starterEdge } from "./features-starter";
import { clamp, logit, round6, sigmoid } from "./math";
import type {
  BullpenFeature,
  InputQuality,
  LineupFeature,
  LogitComponents,
  MarketFeature,
  MarketPredictionV0,
  OfficialStatus,
  StarterFeature,
} from "./types";

export function classifyInputQuality(args: {
  homeStarter: StarterFeature;
  awayStarter: StarterFeature;
  market: MarketFeature;
  lineup: LineupFeature;
}): InputQuality {
  const startersOk =
    args.homeStarter.quality !== "MISSING" &&
    args.awayStarter.quality !== "MISSING" &&
    args.homeStarter.playerName != null &&
    args.awayStarter.playerName != null;
  const startersGood =
    startersOk &&
    (args.homeStarter.quality === "GOOD" ||
      args.homeStarter.quality === "PARTIAL") &&
    (args.awayStarter.quality === "GOOD" ||
      args.awayStarter.quality === "PARTIAL");
  const marketOk = args.market.oddsQuality === "GOOD";
  const lineupOk = args.lineup.confirmed && args.lineup.completeness >= 1;

  if (startersGood && marketOk && lineupOk) return "FULL_INPUT";
  if (startersGood && marketOk) return "LIMITED_INPUT";
  if (startersOk && !marketOk) return "STARTER_ONLY";
  if (!startersOk && marketOk) return "MARKET_ONLY";
  return "INSUFFICIENT";
}

function shrinkStrength(q: InputQuality): number {
  switch (q) {
    case "FULL_INPUT":
      return C.shrinkFull;
    case "LIMITED_INPUT":
      return C.shrinkLimited;
    case "STARTER_ONLY":
      return C.shrinkStarterOnly;
    case "MARKET_ONLY":
      return C.shrinkMarketOnly;
    default:
      return 0.7;
  }
}

export function computeConfidence(args: {
  inputQuality: InputQuality;
  homeStarter: StarterFeature;
  awayStarter: StarterFeature;
  market: MarketFeature;
  lineup: LineupFeature;
  leakageBlocked: boolean;
  warningCount: number;
  cutoffMarginMinutes: number | null;
}): number {
  if (args.leakageBlocked) return 0;
  let score = 20;
  switch (args.inputQuality) {
    case "FULL_INPUT":
      score += 40;
      break;
    case "LIMITED_INPUT":
      score += 28;
      break;
    case "STARTER_ONLY":
      score += 18;
      break;
    case "MARKET_ONLY":
      score += 12;
      break;
    default:
      score += 0;
  }
  if (args.homeStarter.quality === "GOOD") score += 8;
  if (args.awayStarter.quality === "GOOD") score += 8;
  if (args.market.oddsQuality === "GOOD") score += 10;
  if (args.lineup.confirmed) score += 6;
  if (args.cutoffMarginMinutes != null && args.cutoffMarginMinutes > 30) {
    score += 5;
  }
  score -= Math.min(25, args.warningCount * 3);
  return clamp(Math.round(score), 0, 100);
}

export function computeMoneylinePrediction(args: {
  homeStarter: StarterFeature;
  awayStarter: StarterFeature;
  market: MarketFeature;
  lineup: LineupFeature;
  homeBullpen: BullpenFeature;
  awayBullpen: BullpenFeature;
  useMarketPrior: boolean;
  observationOnly: boolean;
  leakageBlocked: boolean;
  leakageReasons: string[];
  afterCutoff: boolean;
  identityMismatch: boolean;
  cutoffMarginMinutes: number | null;
}): MarketPredictionV0 {
  const missingInputs: string[] = [];
  const warnings: string[] = [];
  const explanations: string[] = [];

  if (args.homeStarter.quality === "MISSING") missingInputs.push("HOME_STARTER");
  if (args.awayStarter.quality === "MISSING") missingInputs.push("AWAY_STARTER");
  if (args.market.oddsQuality !== "GOOD") missingInputs.push("MONEYLINE_2WAY");
  if (!args.lineup.confirmed) missingInputs.push("CONFIRMED_LINEUP");

  warnings.push(
    ...args.homeStarter.provenance.warning,
    ...args.awayStarter.provenance.warning,
    ...args.market.provenance.warning,
    ...args.lineup.provenance.warning,
    ...args.homeBullpen.provenance.warning,
  );

  const inputQuality = classifyInputQuality({
    homeStarter: args.homeStarter,
    awayStarter: args.awayStarter,
    market: args.market,
    lineup: args.lineup,
  });

  const sEdge = starterEdge(args.homeStarter, args.awayStarter);
  const starterContribution = sEdge * W.starter.value;
  const bullpenContribution = 0; // DISABLED
  const lineupContribution = 0; // DISABLED
  const homeAdvantageContribution = W.homeAdvantage.value;

  let marketPriorContribution = 0;
  if (
    args.useMarketPrior &&
    args.market.marketProbabilityHome != null &&
    W.marketPrior.status !== "DISABLED"
  ) {
    marketPriorContribution =
      logit(args.market.marketProbabilityHome) * W.marketPrior.value;
    explanations.push(
      args.market.marketProbabilityHome >= 0.5
        ? "MARKET_SUPPORTS_HOME"
        : "MARKET_SUPPORTS_AWAY",
    );
  }

  if (sEdge > 0.05) explanations.push("HOME_STARTER_EDGE");
  if (sEdge < -0.05) explanations.push("AWAY_STARTER_EDGE");
  if (!args.lineup.confirmed) explanations.push("LINEUP_NOT_CONFIRMED");
  if (
    args.homeStarter.quality === "INSUFFICIENT" ||
    args.awayStarter.quality === "INSUFFICIENT" ||
    args.homeStarter.quality === "PARTIAL" ||
    args.awayStarter.quality === "PARTIAL"
  ) {
    explanations.push("LOW_SAMPLE_SHRINK_APPLIED");
  }

  const components: LogitComponents = {
    base: 0,
    starter: round6(starterContribution),
    bullpen: round6(bullpenContribution),
    lineup: round6(lineupContribution),
    homeAdvantage: round6(homeAdvantageContribution),
    marketPrior: round6(marketPriorContribution),
  };

  const logitSum =
    components.base +
    components.starter +
    components.bullpen +
    components.lineup +
    components.homeAdvantage +
    components.marketPrior;

  const rawHome = sigmoid(logitSum);
  const shrink = shrinkStrength(inputQuality);
  const shrunkHome = 0.5 + (rawHome - 0.5) * (1 - shrink);
  const clampedHome = clamp(shrunkHome, C.minProbability, C.maxProbability);
  const homeProbability = round6(clampedHome);
  const awayProbability = round6(1 - homeProbability);

  if (Math.abs(rawHome - clampedHome) > 1e-9) {
    explanations.push("PROBABILITY_CLAMP_APPLIED");
  }

  const marketHome = args.market.marketProbabilityHome;
  const marketAway = args.market.marketProbabilityAway;
  const modelEdgeHome =
    marketHome != null ? round6(homeProbability - marketHome) : null;
  const modelEdgeAway =
    marketAway != null ? round6(awayProbability - marketAway) : null;

  if (
    modelEdgeHome != null &&
    Math.abs(modelEdgeHome) >= 0.03 &&
    ((modelEdgeHome > 0 && homeProbability >= 0.5) ||
      (modelEdgeHome < 0 && homeProbability < 0.5))
  ) {
    explanations.push("MARKET_DISAGREEMENT");
  }

  const confidence = computeConfidence({
    inputQuality,
    homeStarter: args.homeStarter,
    awayStarter: args.awayStarter,
    market: args.market,
    lineup: args.lineup,
    leakageBlocked: args.leakageBlocked,
    warningCount: new Set(warnings).size,
    cutoffMarginMinutes: args.cutoffMarginMinutes,
  });

  let officialStatus: OfficialStatus = "PASS";
  const passReasons: string[] = [];

  if (args.leakageBlocked) {
    officialStatus = "BLOCKED";
    warnings.push("BLOCKED_LEAKAGE_RISK", ...args.leakageReasons);
  } else if (args.afterCutoff) {
    officialStatus = "BLOCKED";
    warnings.push("AFTER_CUTOFF");
  } else if (args.identityMismatch) {
    officialStatus = "BLOCKED";
    warnings.push("IDENTITY_MISMATCH");
  } else if (args.market.oddsQuality === "INVALID") {
    officialStatus = "BLOCKED";
    warnings.push("MALFORMED_ODDS");
  } else if (
    args.homeStarter.playerName == null &&
    args.awayStarter.playerName == null
  ) {
    officialStatus = "BLOCKED";
    warnings.push("STARTERS_MISSING_BOTH_SIDES");
  } else if (inputQuality === "INSUFFICIENT") {
    officialStatus = "BLOCKED";
    warnings.push("INSUFFICIENT_INPUT");
  } else if (args.observationOnly || inputQuality === "MARKET_ONLY") {
    officialStatus = "PASS";
    passReasons.push(
      args.observationOnly ? "OBSERVATION_ONLY" : "MARKET_ONLY_NO_OFFICIAL",
    );
  } else if (
    inputQuality === "FULL_INPUT" &&
    !args.observationOnly &&
    MLB_PREDICTION_V0_OFFICIAL.enableOfficialPick === false
  ) {
    // Conservative default: research baseline only
    officialStatus = "PASS";
    passReasons.push("OFFICIAL_PICK_DISABLED_V0");
    if (confidence < MLB_PREDICTION_V0_OFFICIAL.minConfidence) {
      passReasons.push("CONFIDENCE_BELOW_THRESHOLD");
    }
  } else if (inputQuality === "FULL_INPUT") {
    officialStatus = "ELIGIBLE";
  } else {
    officialStatus = "PASS";
    passReasons.push(`INPUT_QUALITY_${inputQuality}`);
  }

  // Official pick remains null by default in v0
  let officialPick: "HOME" | "AWAY" | null = null;
  if (
    officialStatus === "ELIGIBLE" &&
    MLB_PREDICTION_V0_OFFICIAL.enableOfficialPick &&
    !args.observationOnly &&
    confidence >= MLB_PREDICTION_V0_OFFICIAL.minConfidence &&
    modelEdgeHome != null &&
    Math.abs(modelEdgeHome) >= MLB_PREDICTION_V0_OFFICIAL.minModelMarketEdge
  ) {
    if (homeProbability >= MLB_PREDICTION_V0_OFFICIAL.minProbabilityForPick) {
      officialPick = "HOME";
    } else if (
      homeProbability <= MLB_PREDICTION_V0_OFFICIAL.maxProbabilityForAwayPick
    ) {
      officialPick = "AWAY";
    }
  }

  const selection: "HOME" | "AWAY" =
    homeProbability >= 0.5 ? "HOME" : "AWAY";

  warnings.push(...passReasons);

  return {
    marketType: "MONEYLINE_2WAY",
    line: null,
    homeProbability,
    awayProbability,
    marketHomeProbability: marketHome,
    marketAwayProbability: marketAway,
    modelEdgeHome,
    modelEdgeAway,
    confidence,
    officialStatus,
    officialPick,
    researchBaseline: {
      selection,
      probability: selection === "HOME" ? homeProbability : awayProbability,
      researchOnly: true,
    },
    components,
    missingInputs: [...new Set(missingInputs)].sort(),
    warnings: [...new Set(warnings)].sort(),
    explanations: [...new Set(explanations)].sort(),
    inputQuality,
    calibration: {
      rawHomeProbability: round6(rawHome),
      clampedHomeProbability: homeProbability,
      shrinkStrength: shrink,
      clampMin: C.minProbability,
      clampMax: C.maxProbability,
    },
  };
}
