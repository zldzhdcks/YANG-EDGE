import {
  MARKET_DISCLAIMER,
  MARKET_TYPE,
  ROUND_IDENTITY_CONFIRMED,
  TOTALS_RECOMMENDATION_ENABLED,
  HANDICAP_COMPARISON_ENABLED,
  type MarketComparisonView,
  type MarketSummary,
  type ModelDelta,
  type OwnerOnlyMarketRow,
} from "./contract-v1";
import {classifyMarketJoin, type SealedIdentity} from "./identity-v1";
import {fairOdds, normalize1x2, probabilityDifference} from "./normalize-v1";

export {MARKET_DISCLAIMER};

type ModelProbabilities = {
  status: "PREDICTED" | "PASS" | "INTEGRITY_BLOCKED";
  homePct: number | null;
  drawPct: number | null;
  awayPct: number | null;
};

const ABSENT: MarketComparisonView = {
  status: "MARKET_ABSENT",
  marketType: MARKET_TYPE,
  roundIdentityConfirmed: ROUND_IDENTITY_CONFIRMED,
  captureTimeUnverified: true,
  observedAt: null,
  homeOdds: null,
  drawOdds: null,
  awayOdds: null,
  impliedRaw: null,
  impliedNormalized: null,
  v1: null,
  h2: null,
  r1: null,
  totalsComparisonEnabled: TOTALS_RECOMMENDATION_ENABLED,
  handicapComparisonEnabled: HANDICAP_COMPARISON_ENABLED,
};

function deltas(model: ModelProbabilities, market: {home: number; draw: number; away: number}): ModelDelta | null {
  if (model.status !== "PREDICTED") return null;
  return {
    home: probabilityDifference(model.homePct, market.home),
    draw: probabilityDifference(model.drawPct, market.draw),
    away: probabilityDifference(model.awayPct, market.away),
    fairOdds: {
      home: fairOdds(model.homePct),
      draw: fairOdds(model.drawPct),
      away: fairOdds(model.awayPct),
    },
  };
}

export function compareSealedToMarket(
  sealed: SealedIdentity,
  models: {v1: ModelProbabilities; h2: ModelProbabilities; r1: ModelProbabilities},
  rows: OwnerOnlyMarketRow[],
): MarketComparisonView {
  const ones = rows.filter((row) => row.marketType === "1X2");
  const join = classifyMarketJoin(sealed, ones);
  if (join === "MARKET_ABSENT") return ABSENT;
  if (join === "MARKET_IDENTITY_UNCERTAIN") {
    return {...ABSENT, status: "MARKET_IDENTITY_UNCERTAIN"};
  }
  const row = ones.find((item) => item.fixtureId === sealed.fixtureId)!;
  const normalized = normalize1x2(row.odds.home, row.odds.draw, row.odds.away);
  if (normalized.status === "MISSING") {
    return {
      ...ABSENT,
      status: "MARKET_INCOMPLETE",
      observedAt: row.observedAt,
      homeOdds: row.odds.home,
      drawOdds: row.odds.draw,
      awayOdds: row.odds.away,
    };
  }
  if (normalized.status === "MALFORMED") {
    return {
      ...ABSENT,
      status: "MARKET_MALFORMED",
      observedAt: row.observedAt,
      homeOdds: row.odds.home,
      drawOdds: row.odds.draw,
      awayOdds: row.odds.away,
    };
  }
  return {
    status: "MATCHED",
    marketType: MARKET_TYPE,
    roundIdentityConfirmed: ROUND_IDENTITY_CONFIRMED,
    captureTimeUnverified: true,
    observedAt: row.observedAt,
    homeOdds: row.odds.home,
    drawOdds: row.odds.draw,
    awayOdds: row.odds.away,
    impliedRaw: normalized.raw,
    impliedNormalized: normalized.normalized,
    v1: deltas(models.v1, normalized.normalized),
    h2: deltas(models.h2, normalized.normalized),
    r1: deltas(models.r1, normalized.normalized),
    totalsComparisonEnabled: TOTALS_RECOMMENDATION_ENABLED,
    handicapComparisonEnabled: HANDICAP_COMPARISON_ENABLED,
  };
}

export function summarizeMarket(rows: MarketComparisonView[]): MarketSummary {
  return {
    matched: rows.filter((row) => row.status === "MATCHED").length,
    unmatched: rows.filter((row) => row.status === "MARKET_ABSENT").length,
    identityBlocked: rows.filter((row) => row.status === "MARKET_IDENTITY_UNCERTAIN").length,
  };
}
