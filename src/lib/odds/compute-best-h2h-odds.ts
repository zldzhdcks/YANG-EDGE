/**
 * Best h2h odds with explicit format contract (internal DECIMAL).
 */
import type { OddsBookmaker } from "./types";
import {
  inspectBookmakersFormat,
  normalizeOddsPrice,
  type OddsFormatValidationStatus,
  type OddsPriceFormat,
} from "./normalize-odds-price";
import { classifyH2hOutcome } from "./odds-provider-classify";

export type ComputeBestH2hOddsResult = {
  bestHomeOdds: number | null;
  bestDrawOdds: number | null;
  bestAwayOdds: number | null;
  formatValidationStatus: OddsFormatValidationStatus;
  declaredFormat: OddsPriceFormat;
  effectiveFormat: OddsPriceFormat;
  partialReasons: string[];
  warnings: string[];
  homeOutcomePresent: boolean;
  awayOutcomePresent: boolean;
};

export type ComputeBestH2hOddsOptions = {
  /** Declared provider request/response format. Default: decimal. */
  sourceFormat?: OddsPriceFormat;
};

export function computeBestH2hOddsWithFormat(
  bookmakers: OddsBookmaker[],
  homeTeam: string,
  awayTeam: string,
  options: ComputeBestH2hOddsOptions = {},
): ComputeBestH2hOddsResult {
  const declaredFormat = options.sourceFormat ?? "decimal";
  const inspection = inspectBookmakersFormat(bookmakers, declaredFormat);
  const warnings = [...inspection.warnings];
  const partialReasons: string[] = [];

  if (
    inspection.formatValidationStatus === "FORMAT_MISMATCH" ||
    inspection.formatValidationStatus === "FORMAT_UNKNOWN"
  ) {
    partialReasons.push(
      inspection.formatValidationStatus === "FORMAT_MISMATCH"
        ? "FORMAT_MISMATCH"
        : "FORMAT_UNKNOWN",
    );
    return {
      bestHomeOdds: null,
      bestDrawOdds: null,
      bestAwayOdds: null,
      formatValidationStatus: inspection.formatValidationStatus,
      declaredFormat: inspection.declaredFormat,
      effectiveFormat: inspection.effectiveFormat,
      partialReasons,
      warnings,
      homeOutcomePresent: false,
      awayOutcomePresent: false,
    };
  }

  const priceFormat: OddsPriceFormat =
    inspection.formatValidationStatus === "FORMAT_CONVERTED_FROM_AMERICAN"
      ? "american"
      : "decimal";

  let bestHomeOdds: number | null = null;
  let bestDrawOdds: number | null = null;
  let bestAwayOdds: number | null = null;
  let homeOutcomePresent = false;
  let awayOutcomePresent = false;
  let h2hMarketSeen = false;

  for (const bm of bookmakers) {
    const h2h = bm.markets.find((m) => m.key === "h2h");
    if (!h2h) continue;
    h2hMarketSeen = true;

    for (const outcome of h2h.outcomes) {
      const side = classifyH2hOutcome(outcome.name, homeTeam, awayTeam);
      if (side === "unknown") {
        warnings.push(`TEAM_MAPPING_FAILED:${outcome.name}`);
        continue;
      }
      if (side === "home") homeOutcomePresent = true;
      if (side === "away") awayOutcomePresent = true;

      const norm = normalizeOddsPrice({
        price: outcome.price,
        sourceFormat: priceFormat,
      });
      warnings.push(...norm.warnings);
      if (norm.decimalPrice == null) {
        if (norm.conversionStatus === "FORMAT_MISMATCH") {
          partialReasons.push("FORMAT_MISMATCH");
        } else if (norm.conversionStatus === "INVALID_PRICE") {
          partialReasons.push("PRICE_INVALID");
        }
        continue;
      }
      const decimal = norm.decimalPrice;
      if (side === "home") {
        bestHomeOdds =
          bestHomeOdds == null ? decimal : Math.max(bestHomeOdds, decimal);
      } else if (side === "away") {
        bestAwayOdds =
          bestAwayOdds == null ? decimal : Math.max(bestAwayOdds, decimal);
      } else {
        bestDrawOdds =
          bestDrawOdds == null ? decimal : Math.max(bestDrawOdds, decimal);
      }
    }
  }

  if (!h2hMarketSeen) partialReasons.push("H2H_MARKET_MISSING");
  if (h2hMarketSeen && !homeOutcomePresent) {
    partialReasons.push("HOME_OUTCOME_MISSING");
  }
  if (h2hMarketSeen && !awayOutcomePresent) {
    partialReasons.push("AWAY_OUTCOME_MISSING");
  }
  if (homeOutcomePresent && bestHomeOdds == null) {
    partialReasons.push("PRICE_INVALID");
  }
  if (awayOutcomePresent && bestAwayOdds == null) {
    partialReasons.push("PRICE_INVALID");
  }

  return {
    bestHomeOdds,
    bestDrawOdds,
    bestAwayOdds,
    formatValidationStatus: inspection.formatValidationStatus,
    declaredFormat: inspection.declaredFormat,
    effectiveFormat: inspection.effectiveFormat,
    partialReasons: [...new Set(partialReasons)],
    warnings,
    homeOutcomePresent,
    awayOutcomePresent,
  };
}
