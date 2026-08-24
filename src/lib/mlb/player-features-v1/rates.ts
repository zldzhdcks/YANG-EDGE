import type { DerivedRate } from "./types";

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function divideRate(input: {
  numerator: number | null;
  denominator: number | null;
  formula: string;
  numeratorField: string;
  denominatorField: string;
}): DerivedRate {
  const parentAvailable = input.numerator != null && input.denominator != null;
  if (
    input.numerator == null ||
    input.denominator == null ||
    input.denominator === 0
  ) {
    return {
      value: null,
      formula: input.formula,
      numerator: input.numerator,
      denominator: input.denominator,
      numeratorField: input.numeratorField,
      denominatorField: input.denominatorField,
      sampleSize: input.denominator,
      parentAvailable,
    };
  }
  return {
    value: round4(input.numerator / input.denominator),
    formula: input.formula,
    numerator: input.numerator,
    denominator: input.denominator,
    numeratorField: input.numeratorField,
    denominatorField: input.denominatorField,
    sampleSize: input.denominator,
    parentAvailable: true,
  };
}

export function kRate(so: number | null, pa: number | null): DerivedRate {
  return divideRate({
    numerator: so,
    denominator: pa,
    formula: "SO / PA",
    numeratorField: "so",
    denominatorField: "pa",
  });
}

export function bbRate(bb: number | null, pa: number | null): DerivedRate {
  return divideRate({
    numerator: bb,
    denominator: pa,
    formula: "BB / PA",
    numeratorField: "bb",
    denominatorField: "pa",
  });
}

export function hrRate(hr: number | null, pa: number | null): DerivedRate {
  return divideRate({
    numerator: hr,
    denominator: pa,
    formula: "HR / PA",
    numeratorField: "hr",
    denominatorField: "pa",
  });
}

/** ISO = SLG - AVG only when both parents are from the same window. */
export function isoFromSlgAvg(
  slg: number | null,
  avg: number | null,
): DerivedRate {
  const parentAvailable = slg != null && avg != null;
  if (slg == null || avg == null) {
    return {
      value: null,
      formula: "SLG - AVG",
      numerator: slg,
      denominator: avg,
      numeratorField: "slg",
      denominatorField: "avg",
      sampleSize: null,
      parentAvailable,
    };
  }
  return {
    value: round4(slg - avg),
    formula: "SLG - AVG",
    numerator: slg,
    denominator: avg,
    numeratorField: "slg",
    denominatorField: "avg",
    sampleSize: null,
    parentAvailable: true,
  };
}

export function kMinusBbRate(
  k: DerivedRate,
  bb: DerivedRate,
): DerivedRate {
  if (k.value == null || bb.value == null) {
    return {
      value: null,
      formula: "K_RATE - BB_RATE",
      numerator: k.value,
      denominator: bb.value,
      numeratorField: "kRate",
      denominatorField: "bbRate",
      sampleSize: k.sampleSize,
      parentAvailable: k.parentAvailable && bb.parentAvailable,
    };
  }
  return {
    value: round4(k.value - bb.value),
    formula: "K_RATE - BB_RATE",
    numerator: k.value,
    denominator: bb.value,
    numeratorField: "kRate",
    denominatorField: "bbRate",
    sampleSize: k.sampleSize,
    parentAvailable: true,
  };
}

export function hr9(hr: number | null, ip: number | null): DerivedRate {
  if (hr == null || ip == null || ip === 0) {
    return divideRate({
      numerator: hr == null ? null : hr * 9,
      denominator: ip,
      formula: "(HR * 9) / IP",
      numeratorField: "hr",
      denominatorField: "ip",
    });
  }
  return divideRate({
    numerator: hr * 9,
    denominator: ip,
    formula: "(HR * 9) / IP",
    numeratorField: "hr",
    denominatorField: "ip",
  });
}
