/**
 * 1X2 implied probability + multiplicative de-vig.
 * Mission overround := rawHome + rawDraw + rawAway (not margin).
 * Must NOT be wired into Prediction in this mission.
 */
import {
  FOOTBALL_1X2_OVERROUND_CONFIG,
  type FootballOneXTwoDevig,
} from "./types";

export function computeOneXTwoDevig(input: {
  homeDecimal: number;
  drawDecimal: number;
  awayDecimal: number;
}): FootballOneXTwoDevig {
  const reasonCodes: string[] = [];
  const { homeDecimal, drawDecimal, awayDecimal } = input;

  if (
    !(homeDecimal > 1) ||
    !(drawDecimal > 1) ||
    !(awayDecimal > 1) ||
    !Number.isFinite(homeDecimal) ||
    !Number.isFinite(drawDecimal) ||
    !Number.isFinite(awayDecimal)
  ) {
    return {
      rawHome: NaN,
      rawDraw: NaN,
      rawAway: NaN,
      overround: NaN,
      margin: NaN,
      devigHome: NaN,
      devigDraw: NaN,
      devigAway: NaN,
      devigSum: NaN,
      overroundLevel: "BLOCKED",
      reasonCodes: ["INVALID_DECIMAL_FOR_DEVIG"],
    };
  }

  const rawHome = 1 / homeDecimal;
  const rawDraw = 1 / drawDecimal;
  const rawAway = 1 / awayDecimal;
  const overround = rawHome + rawDraw + rawAway;
  const margin = overround - 1;

  if (!Number.isFinite(overround) || overround <= 0) {
    return {
      rawHome,
      rawDraw,
      rawAway,
      overround,
      margin,
      devigHome: NaN,
      devigDraw: NaN,
      devigAway: NaN,
      devigSum: NaN,
      overroundLevel: "BLOCKED",
      reasonCodes: ["OVERROUND_NONFINITE"],
    };
  }

  const devigHome = rawHome / overround;
  const devigDraw = rawDraw / overround;
  const devigAway = rawAway / overround;
  const devigSum = devigHome + devigDraw + devigAway;

  if (
    Math.abs(devigSum - 1) > FOOTBALL_1X2_OVERROUND_CONFIG.devigSumTolerance
  ) {
    reasonCodes.push("DEVIG_SUM_NOT_ONE");
  }

  let overroundLevel: FootballOneXTwoDevig["overroundLevel"] = "OK";
  if (
    overround < FOOTBALL_1X2_OVERROUND_CONFIG.blockBelow ||
    overround > FOOTBALL_1X2_OVERROUND_CONFIG.blockAbove
  ) {
    overroundLevel = "BLOCKED";
    reasonCodes.push("OVERROUND_OUT_OF_BLOCK_RANGE");
  } else if (
    overround < FOOTBALL_1X2_OVERROUND_CONFIG.warnBelow ||
    overround > FOOTBALL_1X2_OVERROUND_CONFIG.warnAbove
  ) {
    overroundLevel = "WARNING";
    reasonCodes.push("OVERROUND_OUT_OF_WARN_RANGE");
  }

  return {
    rawHome,
    rawDraw,
    rawAway,
    overround,
    margin,
    devigHome,
    devigDraw,
    devigAway,
    devigSum,
    overroundLevel,
    reasonCodes,
  };
}
