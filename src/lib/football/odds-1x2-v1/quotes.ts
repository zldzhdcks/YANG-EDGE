import { classifyH2hOutcome } from "@/lib/odds/odds-provider-classify";
import type { OddsBookmaker, OddsData } from "@/lib/odds/types";
import { computeOneXTwoDevig } from "../odds-foundation-v0/compute-devig-probabilities";
import type {
  Football1x2BookmakerQuote,
  Football1x2MarketStatus,
} from "./types";

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

export function extractBookmaker1x2Quote(input: {
  bookmaker: OddsBookmaker;
  homeTeam: string;
  awayTeam: string;
}): Football1x2BookmakerQuote {
  const h2h = input.bookmaker.markets.find((m) => m.key === "h2h");
  const lastUpdate = input.bookmaker.lastUpdate?.trim() || null;
  const base = {
    bookmakerKey: input.bookmaker.key,
    bookmakerTitle: input.bookmaker.title,
    lastUpdate,
  };

  if (!h2h) {
    return {
      ...base,
      homeDecimal: null,
      drawDecimal: null,
      awayDecimal: null,
      marketStatus: "NOT_COLLECTED",
      rawImpliedHome: null,
      rawImpliedDraw: null,
      rawImpliedAway: null,
      overround: null,
      margin: null,
      devigHome: null,
      devigDraw: null,
      devigAway: null,
      overroundLevel: null,
      reasonCodes: ["NO_H2H_MARKET"],
    };
  }

  let homeDecimal: number | null = null;
  let drawDecimal: number | null = null;
  let awayDecimal: number | null = null;
  const reasonCodes: string[] = [];
  const seen = new Set<string>();

  for (const outcome of h2h.outcomes) {
    const side = classifyH2hOutcome(
      outcome.name,
      input.homeTeam,
      input.awayTeam,
    );
    if (side === "unknown") {
      reasonCodes.push(`UNKNOWN_OUTCOME:${outcome.name}`);
      continue;
    }
    if (seen.has(side)) {
      reasonCodes.push(`DUPLICATE_SIDE:${side}`);
      continue;
    }
    seen.add(side);
    const price = outcome.price;
    if (side === "home") homeDecimal = price;
    if (side === "draw") drawDecimal = price;
    if (side === "away") awayDecimal = price;
  }

  const hasDuplicateSide = reasonCodes.some((c) =>
    c.startsWith("DUPLICATE_SIDE:"),
  );
  const homeOk = homeDecimal != null && homeDecimal > 1 && Number.isFinite(homeDecimal);
  const drawOk = drawDecimal != null && drawDecimal > 1 && Number.isFinite(drawDecimal);
  const awayOk = awayDecimal != null && awayDecimal > 1 && Number.isFinite(awayDecimal);

  let marketStatus: Football1x2MarketStatus;
  if (hasDuplicateSide) {
    marketStatus = "INVALID_MARKET";
  } else if (homeOk && drawOk && awayOk) {
    marketStatus = "COMPLETE_1X2";
  } else if (
    (homeDecimal != null || awayDecimal != null) &&
    drawDecimal == null
  ) {
    marketStatus = "PARTIAL_1X2";
    reasonCodes.push("MISSING_DRAW");
  } else {
    marketStatus = "INVALID_MARKET";
    if (!homeOk) reasonCodes.push("INVALID_OR_MISSING_HOME");
    if (!drawOk && drawDecimal != null) reasonCodes.push("INVALID_DRAW");
    if (!awayOk) reasonCodes.push("INVALID_OR_MISSING_AWAY");
    if (homeDecimal != null && !(homeDecimal > 1)) {
      reasonCodes.push("INVALID_DECIMAL_HOME");
    }
    if (drawDecimal != null && !(drawDecimal > 1)) {
      reasonCodes.push("INVALID_DECIMAL_DRAW");
    }
    if (awayDecimal != null && !(awayDecimal > 1)) {
      reasonCodes.push("INVALID_DECIMAL_AWAY");
    }
  }

  if (marketStatus !== "COMPLETE_1X2") {
    return {
      ...base,
      homeDecimal: finiteOrNull(homeDecimal),
      drawDecimal: finiteOrNull(drawDecimal),
      awayDecimal: finiteOrNull(awayDecimal),
      marketStatus,
      rawImpliedHome: null,
      rawImpliedDraw: null,
      rawImpliedAway: null,
      overround: null,
      margin: null,
      devigHome: null,
      devigDraw: null,
      devigAway: null,
      overroundLevel: null,
      reasonCodes,
    };
  }

  const math = computeOneXTwoDevig({
    homeDecimal: homeDecimal!,
    drawDecimal: drawDecimal!,
    awayDecimal: awayDecimal!,
  });

  return {
    ...base,
    homeDecimal: homeDecimal!,
    drawDecimal: drawDecimal!,
    awayDecimal: awayDecimal!,
    marketStatus,
    rawImpliedHome: finiteOrNull(math.rawHome),
    rawImpliedDraw: finiteOrNull(math.rawDraw),
    rawImpliedAway: finiteOrNull(math.rawAway),
    overround: finiteOrNull(math.overround),
    margin: finiteOrNull(math.margin),
    devigHome: finiteOrNull(math.devigHome),
    devigDraw: finiteOrNull(math.devigDraw),
    devigAway: finiteOrNull(math.devigAway),
    overroundLevel: math.overroundLevel,
    reasonCodes: [...reasonCodes, ...math.reasonCodes],
  };
}

export function extractEventBookmakerQuotes(
  event: OddsData,
): Football1x2BookmakerQuote[] {
  return event.bookmakers.map((bookmaker) =>
    extractBookmaker1x2Quote({
      bookmaker,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
    }),
  );
}

export function summarizeMarketStatus(
  quotes: Football1x2BookmakerQuote[],
): Football1x2MarketStatus {
  if (quotes.some((q) => q.marketStatus === "COMPLETE_1X2")) {
    return "COMPLETE_1X2";
  }
  if (quotes.some((q) => q.marketStatus === "PARTIAL_1X2")) {
    return "PARTIAL_1X2";
  }
  if (quotes.length === 0) return "NOT_COLLECTED";
  return "INVALID_MARKET";
}

export function medianDevigFromQuotes(quotes: Football1x2BookmakerQuote[]): {
  medianDevigHome: number | null;
  medianDevigDraw: number | null;
  medianDevigAway: number | null;
} {
  const complete = quotes.filter((q) => q.marketStatus === "COMPLETE_1X2");
  return {
    medianDevigHome: median(
      complete.map((q) => q.devigHome).filter((n): n is number => n != null),
    ),
    medianDevigDraw: median(
      complete.map((q) => q.devigDraw).filter((n): n is number => n != null),
    ),
    medianDevigAway: median(
      complete.map((q) => q.devigAway).filter((n): n is number => n != null),
    ),
  };
}
