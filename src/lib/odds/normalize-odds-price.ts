/**
 * Odds price format contract — internal standard is DECIMAL.
 * American/raw values must never be treated as decimal without explicit conversion.
 */

export type OddsPriceFormat = "american" | "decimal" | "fractional" | "unknown";

export type OddsPriceConversionStatus =
  | "CONVERTED"
  | "ALREADY_DECIMAL"
  | "INVALID_PRICE"
  | "UNKNOWN_FORMAT"
  | "FORMAT_MISMATCH";

export type OddsFormatValidationStatus =
  | "FORMAT_CONFIRMED_DECIMAL"
  | "FORMAT_CONVERTED_FROM_AMERICAN"
  | "FORMAT_MISMATCH"
  | "FORMAT_UNKNOWN";

export type NormalizeOddsPriceInput = {
  price: number | null | undefined;
  sourceFormat: OddsPriceFormat;
};

export type NormalizeOddsPriceResult = {
  rawPrice: number | null;
  rawFormat: OddsPriceFormat;
  decimalPrice: number | null;
  conversionStatus: OddsPriceConversionStatus;
  warnings: string[];
};

/** American → decimal. Positive: 1 + a/100; Negative: 1 + 100/|a|. */
export function americanToDecimal(american: number): number | null {
  if (!Number.isFinite(american) || american === 0) return null;
  if (american > 0) return 1 + american / 100;
  return 1 + 100 / Math.abs(american);
}

function isValidDecimal(price: number): boolean {
  return Number.isFinite(price) && price > 1;
}

/**
 * Heuristic: integer odds with |price| >= 100 (or any negative) look American
 * when the declared format is decimal — treat as FORMAT_MISMATCH, do not convert.
 */
export function looksLikeAmericanOdds(price: number): boolean {
  if (!Number.isFinite(price)) return false;
  if (price < 0) return true;
  if (Number.isInteger(price) && Math.abs(price) >= 100) return true;
  return false;
}

export function normalizeOddsPrice(
  input: NormalizeOddsPriceInput,
): NormalizeOddsPriceResult {
  const warnings: string[] = [];
  const rawFormat = input.sourceFormat;
  const rawPrice =
    typeof input.price === "number" && Number.isFinite(input.price)
      ? input.price
      : null;

  if (rawPrice == null) {
    return {
      rawPrice: null,
      rawFormat,
      decimalPrice: null,
      conversionStatus: "INVALID_PRICE",
      warnings: ["PRICE_MISSING"],
    };
  }

  if (rawFormat === "unknown") {
    warnings.push("ODDS_FORMAT_UNKNOWN");
    return {
      rawPrice,
      rawFormat,
      decimalPrice: null,
      conversionStatus: "UNKNOWN_FORMAT",
      warnings,
    };
  }

  if (rawFormat === "fractional") {
    warnings.push("FRACTIONAL_ODDS_NOT_SUPPORTED");
    return {
      rawPrice,
      rawFormat,
      decimalPrice: null,
      conversionStatus: "UNKNOWN_FORMAT",
      warnings,
    };
  }

  if (rawFormat === "decimal") {
    if (looksLikeAmericanOdds(rawPrice)) {
      warnings.push("DECLARED_DECIMAL_BUT_LOOKS_AMERICAN");
      return {
        rawPrice,
        rawFormat,
        decimalPrice: null,
        conversionStatus: "FORMAT_MISMATCH",
        warnings,
      };
    }
    if (!isValidDecimal(rawPrice)) {
      return {
        rawPrice,
        rawFormat,
        decimalPrice: null,
        conversionStatus: "INVALID_PRICE",
        warnings: ["DECIMAL_PRICE_NOT_GT_1"],
      };
    }
    return {
      rawPrice,
      rawFormat,
      decimalPrice: rawPrice,
      conversionStatus: "ALREADY_DECIMAL",
      warnings,
    };
  }

  // american
  const decimal = americanToDecimal(rawPrice);
  if (decimal == null || !isValidDecimal(decimal)) {
    return {
      rawPrice,
      rawFormat,
      decimalPrice: null,
      conversionStatus: "INVALID_PRICE",
      warnings: ["AMERICAN_CONVERSION_FAILED"],
    };
  }
  return {
    rawPrice,
    rawFormat,
    decimalPrice: decimal,
    conversionStatus: "CONVERTED",
    warnings,
  };
}

export type InspectBookmakersFormatResult = {
  declaredFormat: OddsPriceFormat;
  effectiveFormat: OddsPriceFormat;
  formatValidationStatus: OddsFormatValidationStatus;
  evidence: {
    negativePriceCount: number;
    largeIntegerPriceCount: number;
    samplePrices: number[];
  };
  warnings: string[];
};

/**
 * Validate payload against declared request format.
 * Policy: declared american → convert OK; declared decimal + american-shaped → FORMAT_MISMATCH.
 */
export function inspectBookmakersFormat(
  bookmakers: Array<{ markets: Array<{ key: string; outcomes: Array<{ price: number }> }> }>,
  declaredFormat: OddsPriceFormat,
): InspectBookmakersFormatResult {
  const warnings: string[] = [];
  let negativePriceCount = 0;
  let largeIntegerPriceCount = 0;
  const samplePrices: number[] = [];

  for (const bm of bookmakers) {
    for (const m of bm.markets) {
      if (m.key !== "h2h" && m.key !== "h2h_lay") continue;
      for (const o of m.outcomes) {
        if (!Number.isFinite(o.price)) continue;
        if (samplePrices.length < 8) samplePrices.push(o.price);
        if (o.price < 0) negativePriceCount += 1;
        if (Number.isInteger(o.price) && Math.abs(o.price) >= 100) {
          largeIntegerPriceCount += 1;
        }
      }
    }
  }

  const evidence = { negativePriceCount, largeIntegerPriceCount, samplePrices };

  if (declaredFormat === "unknown") {
    return {
      declaredFormat,
      effectiveFormat: "unknown",
      formatValidationStatus: "FORMAT_UNKNOWN",
      evidence,
      warnings: ["ODDS_FORMAT_UNKNOWN"],
    };
  }

  if (declaredFormat === "american") {
    return {
      declaredFormat,
      effectiveFormat: "american",
      formatValidationStatus: "FORMAT_CONVERTED_FROM_AMERICAN",
      evidence,
      warnings,
    };
  }

  if (declaredFormat === "decimal") {
    if (negativePriceCount > 0 || largeIntegerPriceCount > 0) {
      warnings.push("ODDS_FORMAT_MISMATCH");
      return {
        declaredFormat,
        effectiveFormat: "unknown",
        formatValidationStatus: "FORMAT_MISMATCH",
        evidence,
        warnings,
      };
    }
    return {
      declaredFormat,
      effectiveFormat: "decimal",
      formatValidationStatus: "FORMAT_CONFIRMED_DECIMAL",
      evidence,
      warnings,
    };
  }

  return {
    declaredFormat,
    effectiveFormat: "unknown",
    formatValidationStatus: "FORMAT_UNKNOWN",
    evidence,
    warnings: ["ODDS_FORMAT_UNSUPPORTED"],
  };
}

export function marketProbabilityFromDecimalPair(
  homeDecimal: number | null,
  awayDecimal: number | null,
): { homePct: number | null; awayPct: number | null; usable: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (
    homeDecimal == null ||
    awayDecimal == null ||
    !isValidDecimal(homeDecimal) ||
    !isValidDecimal(awayDecimal)
  ) {
    warnings.push("MARKET_PROBABILITY_REQUIRES_BOTH_DECIMAL_ODDS");
    return { homePct: null, awayPct: null, usable: false, warnings };
  }
  const ih = 1 / homeDecimal;
  const ia = 1 / awayDecimal;
  const sum = ih + ia;
  if (!(sum > 0) || !Number.isFinite(sum)) {
    warnings.push("MARKET_PROBABILITY_INVALID_SUM");
    return { homePct: null, awayPct: null, usable: false, warnings };
  }
  const homePct = (ih / sum) * 100;
  const awayPct = (ia / sum) * 100;
  if (homePct > 100 || awayPct > 100 || homePct < 0 || awayPct < 0) {
    warnings.push("MARKET_PROBABILITY_OUT_OF_RANGE");
    return { homePct: null, awayPct: null, usable: false, warnings };
  }
  return { homePct, awayPct, usable: true, warnings };
}
