import { computeOneXTwoDevig } from "../odds-foundation-v0/compute-devig-probabilities";
import type { Football1x2BookmakerQuote } from "../odds-1x2-v1/types";
import type { Football1x2ProbabilityGapV0, Football1x2ThreeWayMetrics } from "./types";

function finiteOrNull(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function threeWayMetricsFromDecimals(input: {
  leftOrHome: number | null;
  draw: number | null;
  rightOrAway: number | null;
}): Football1x2ThreeWayMetrics {
  const left = finiteOrNull(input.leftOrHome);
  const draw = finiteOrNull(input.draw);
  const right = finiteOrNull(input.rightOrAway);
  if (left == null || draw == null || right == null) {
    return {
      leftOrHomeDecimal: left,
      drawDecimal: draw,
      rightOrAwayDecimal: right,
      rawImpliedLeftOrHome: null,
      rawImpliedDraw: null,
      rawImpliedRightOrAway: null,
      overround: null,
      margin: null,
    };
  }
  const math = computeOneXTwoDevig({
    homeDecimal: left,
    drawDecimal: draw,
    awayDecimal: right,
  });
  return {
    leftOrHomeDecimal: left,
    drawDecimal: draw,
    rightOrAwayDecimal: right,
    rawImpliedLeftOrHome: finiteOrNull(math.rawHome),
    rawImpliedDraw: finiteOrNull(math.rawDraw),
    rawImpliedRightOrAway: finiteOrNull(math.rawAway),
    overround: finiteOrNull(math.overround),
    margin: finiteOrNull(math.margin),
  };
}

export function medianQuoteMetric(
  quotes: Football1x2BookmakerQuote[],
  field: "rawImpliedHome" | "rawImpliedDraw" | "rawImpliedAway" | "overround",
): number | null {
  const complete = quotes.filter((q) => q.marketStatus === "COMPLETE_1X2");
  return median(
    complete.map((q) => q[field]).filter((n): n is number => n != null),
  );
}

export function probabilityGap(input: {
  sideAlignment: "ALIGNED" | "REVERSED" | "UNRESOLVED";
  domestic: Football1x2ThreeWayMetrics;
  medianHome: number | null;
  medianDraw: number | null;
  medianAway: number | null;
}): Football1x2ProbabilityGapV0 {
  if (input.sideAlignment !== "ALIGNED") {
    return {
      computed: false,
      reason:
        input.sideAlignment === "REVERSED"
          ? "SIDE_REVERSED_GAP_NOT_COMPUTED"
          : "SIDE_UNRESOLVED_GAP_NOT_COMPUTED",
      home: null,
      draw: null,
      away: null,
    };
  }
  const dHome = input.domestic.rawImpliedLeftOrHome;
  const dDraw = input.domestic.rawImpliedDraw;
  const dAway = input.domestic.rawImpliedRightOrAway;
  if (
    dHome == null ||
    dDraw == null ||
    dAway == null ||
    input.medianHome == null ||
    input.medianDraw == null ||
    input.medianAway == null
  ) {
    return {
      computed: false,
      reason: "MISSING_IMPLIED_PROBABILITY",
      home: null,
      draw: null,
      away: null,
    };
  }
  return {
    computed: true,
    reason: null,
    home: dHome - input.medianHome,
    draw: dDraw - input.medianDraw,
    away: dAway - input.medianAway,
  };
}
