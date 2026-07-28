import type {
  BetmanAnalysisLevel,
  BetmanIdentityMatchStatus,
} from "../../betman/daily-slate/betman-daily-slate-types";

export type MinimumAnalysisInput = {
  sport: "BASEBALL" | "SOCCER" | "BASKETBALL" | "VOLLEYBALL";
  identityStatus: BetmanIdentityMatchStatus;
  predictionSnapshotPresent: boolean;
  predictionPartial: boolean;
  requiredDatasetsMissing: string[];
  domesticOddsVerified: boolean;
  overseasOddsPresent: boolean;
  marketRuleVerified: boolean;
  operatorInputVerified: boolean;
  legalBlocked: boolean;
  identityConflict: boolean;
};

export type MinimumAnalysisResult = {
  analysisLevel: BetmanAnalysisLevel;
  missingReasons: string[];
  blockingReasons: string[];
  predictionStatus: string;
};

export function resolveMinimumAnalysisLevel(
  input: MinimumAnalysisInput,
): MinimumAnalysisResult {
  const missingReasons: string[] = [];
  const blockingReasons: string[] = [];

  if (input.legalBlocked) {
    blockingReasons.push("LEGAL_CLEARANCE_PENDING");
    return {
      analysisLevel: "BLOCKED",
      missingReasons,
      blockingReasons,
      predictionStatus: "BLOCKED",
    };
  }

  if (input.identityConflict) {
    blockingReasons.push("IDENTITY_CONFLICT");
    return {
      analysisLevel: "BLOCKED",
      missingReasons,
      blockingReasons,
      predictionStatus: "BLOCKED",
    };
  }

  if (!input.operatorInputVerified) {
    missingReasons.push("OPERATOR_INPUT_NOT_VERIFIED");
  }

  if (input.identityStatus === "PROVIDER_NOT_IMPLEMENTED") {
    missingReasons.push("IDENTITY_PROVIDER_NOT_IMPLEMENTED");
  }
  if (input.identityStatus === "PROVIDER_GAME_MISSING") {
    missingReasons.push("PROVIDER_GAME_MISSING");
  }
  if (input.identityStatus === "TEAM_MAPPING_MISSING") {
    missingReasons.push("TEAM_MAPPING_MISSING");
  }
  if (input.identityStatus === "TIME_MISMATCH") {
    missingReasons.push("START_TIME_MISMATCH");
  }
  if (input.identityStatus === "AMBIGUOUS") {
    blockingReasons.push("IDENTITY_AMBIGUOUS");
  }

  if (
    input.identityStatus === "AMBIGUOUS" ||
    input.identityStatus === "TIME_MISMATCH" ||
    input.identityConflict
  ) {
    return {
      analysisLevel: "BLOCKED",
      missingReasons,
      blockingReasons,
      predictionStatus: "BLOCKED",
    };
  }

  if (input.predictionSnapshotPresent) {
    if (input.requiredDatasetsMissing.length > 0) {
      missingReasons.push("REQUIRED_DATASET_MISSING");
      return {
        analysisLevel: "PARTIAL_ANALYSIS",
        missingReasons,
        blockingReasons,
        predictionStatus: "PARTIAL",
      };
    }
    return {
      analysisLevel: "FULL_ANALYSIS",
      missingReasons,
      blockingReasons,
      predictionStatus: "GENERATED",
    };
  }

  if (input.sport === "BASEBALL") {
    missingReasons.push("PREDICTION_PIPELINE_NOT_IMPLEMENTED");
    if (
      input.identityStatus === "MATCHED" &&
      (input.domesticOddsVerified ||
        (input.overseasOddsPresent && input.marketRuleVerified))
    ) {
      if (!input.marketRuleVerified) {
        missingReasons.push("MARKET_RULE_UNVERIFIED");
      }
      return {
        analysisLevel: "MARKET_BASELINE_ONLY",
        missingReasons,
        blockingReasons,
        predictionStatus: "NOT_IMPLEMENTED",
      };
    }
    if (input.identityStatus === "MATCHED") {
      return {
        analysisLevel: "IDENTITY_ONLY",
        missingReasons: [...missingReasons, "ODDS_NOT_ENTERED"],
        blockingReasons,
        predictionStatus: "NOT_IMPLEMENTED",
      };
    }
  }

  if (input.sport === "SOCCER") {
    missingReasons.push("PREDICTION_PIPELINE_NOT_IMPLEMENTED");
    if (
      input.identityStatus === "MATCHED" &&
      input.domesticOddsVerified &&
      input.marketRuleVerified
    ) {
      return {
        analysisLevel: "MARKET_BASELINE_ONLY",
        missingReasons,
        blockingReasons,
        predictionStatus: "NOT_IMPLEMENTED",
      };
    }
    if (input.identityStatus === "MATCHED") {
      return {
        analysisLevel: "IDENTITY_ONLY",
        missingReasons: [...missingReasons, "ODDS_NOT_ENTERED"],
        blockingReasons,
        predictionStatus: "NOT_IMPLEMENTED",
      };
    }
  }

  if (input.sport === "BASKETBALL" || input.sport === "VOLLEYBALL") {
    missingReasons.push("PREDICTION_PIPELINE_NOT_IMPLEMENTED");
    if (
      input.identityStatus === "MATCHED" &&
      input.domesticOddsVerified &&
      input.marketRuleVerified
    ) {
      return {
        analysisLevel: "MARKET_BASELINE_ONLY",
        missingReasons,
        blockingReasons,
        predictionStatus: "NOT_IMPLEMENTED",
      };
    }
    if (input.identityStatus === "MATCHED") {
      return {
        analysisLevel: "IDENTITY_ONLY",
        missingReasons,
        blockingReasons,
        predictionStatus: "NOT_IMPLEMENTED",
      };
    }
  }

  missingReasons.push("IDENTITY_NOT_MATCHED");
  return {
    analysisLevel: input.identityStatus === "UNMATCHED" ? "IDENTITY_ONLY" : "BLOCKED",
    missingReasons,
    blockingReasons,
    predictionStatus: "NOT_IMPLEMENTED",
  };
}

export function computeImpliedProbability(oddsDecimal: number): number | null {
  if (!(oddsDecimal > 1)) return null;
  return Number((1 / oddsDecimal).toFixed(6));
}

export function findLowestOddsSelection(
  selections: Array<{ selectionCode: string; oddsDecimal: number | null }>,
): string | null {
  const valid = selections.filter(
    (s) => s.oddsDecimal != null && s.oddsDecimal > 1,
  );
  if (valid.length === 0) return null;
  valid.sort((a, b) => (a.oddsDecimal ?? 999) - (b.oddsDecimal ?? 999));
  return valid[0]?.selectionCode ?? null;
}
