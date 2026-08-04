/**
 * Validate MONEYLINE_3WAY_1X2 decimal odds for Football.
 * Does not connect to Prediction Engine.
 */
import {
  FOOTBALL_COLLECT_ONLY_MARKETS,
  FOOTBALL_PREDICTION_MARKET,
  type FootballCollectOnlyMarket,
  type FootballCollectOnlyOddsRow,
  type FootballOneXTwoOddsRow,
  type FootballOneXTwoRowStatus,
} from "./types";

export type OneXTwoValidationResult = {
  ok: boolean;
  status: FootballOneXTwoRowStatus;
  reasonCodes: string[];
  predictionEligible: boolean;
};

function isValidDecimal(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 1;
}

export function validateOneXTwoOddsRow(
  row: FootballOneXTwoOddsRow,
): OneXTwoValidationResult {
  const reasonCodes: string[] = [];

  if (row.marketType !== FOOTBALL_PREDICTION_MARKET) {
    reasonCodes.push("UNSUPPORTED_MARKET");
    return {
      ok: false,
      status: "INVALID_ODDS",
      reasonCodes,
      predictionEligible: false,
    };
  }

  if (row.format !== "DECIMAL") {
    reasonCodes.push("INVALID_FORMAT");
    return {
      ok: false,
      status: "INVALID_ODDS",
      reasonCodes,
      predictionEligible: false,
    };
  }

  const homeOk = isValidDecimal(row.homeDecimal);
  const drawOk = isValidDecimal(row.drawDecimal);
  const awayOk = isValidDecimal(row.awayDecimal);

  if (!homeOk && row.homeDecimal != null) {
    reasonCodes.push("HOME_ODDS_LTE_1_OR_NONFINITE");
  }
  if (!drawOk && row.drawDecimal != null) {
    reasonCodes.push("DRAW_ODDS_LTE_1_OR_NONFINITE");
  }
  if (!awayOk && row.awayDecimal != null) {
    reasonCodes.push("AWAY_ODDS_LTE_1_OR_NONFINITE");
  }

  if (row.homeDecimal == null) reasonCodes.push("HOME_ODDS_MISSING");
  if (row.drawDecimal == null) reasonCodes.push("DRAW_ODDS_MISSING");
  if (row.awayDecimal == null) reasonCodes.push("AWAY_ODDS_MISSING");

  const captured = Date.parse(row.capturedAt);
  const commence = Date.parse(row.commenceTime);
  if (Number.isNaN(captured) || Number.isNaN(commence)) {
    reasonCodes.push("TIMESTAMP_INVALID");
  } else if (captured >= commence) {
    reasonCodes.push("CAPTURED_AFTER_OR_AT_KICKOFF");
  }

  if (!row.matchId || !row.identityHash || !row.fixtureId) {
    reasonCodes.push("IDENTITY_FIELDS_MISSING");
  }

  const presentCount = [homeOk, drawOk, awayOk].filter(Boolean).length;

  if (reasonCodes.includes("CAPTURED_AFTER_OR_AT_KICKOFF")) {
    return {
      ok: false,
      status: "AFTER_CUTOFF",
      reasonCodes,
      predictionEligible: false,
    };
  }

  if (presentCount === 0) {
    return {
      ok: false,
      status: "NOT_COLLECTED",
      reasonCodes: [...reasonCodes, "NO_DECIMAL_VALUES"],
      predictionEligible: false,
    };
  }

  if (presentCount < 3 || reasonCodes.some((c) => c.includes("LTE_1"))) {
    return {
      ok: false,
      status: "PARTIAL",
      reasonCodes,
      predictionEligible: false,
    };
  }

  if (reasonCodes.length > 0) {
    return {
      ok: false,
      status: "INVALID_ODDS",
      reasonCodes,
      predictionEligible: false,
    };
  }

  return {
    ok: true,
    status: "COLLECTED",
    reasonCodes: [],
    predictionEligible: true,
  };
}

export function isCollectOnlyMarket(
  market: string,
): market is FootballCollectOnlyMarket {
  return (FOOTBALL_COLLECT_ONLY_MARKETS as string[]).includes(market);
}

/** Collect-only rows are never Prediction-eligible. */
export function validateCollectOnlyRow(
  row: FootballCollectOnlyOddsRow,
): { predictionEligible: false; ok: true } {
  if (row.status !== "COLLECT_ONLY" || row.predictionEligible !== false) {
    throw new Error("COLLECT_ONLY_CONTRACT_VIOLATION");
  }
  if (!isCollectOnlyMarket(row.marketType)) {
    throw new Error("COLLECT_ONLY_MARKET_UNKNOWN");
  }
  return { predictionEligible: false, ok: true };
}
