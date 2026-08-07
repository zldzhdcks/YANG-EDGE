import type { NpbEvidenceMarketSide } from "@/lib/npb/pregame-evidence-snapshot-v0";
import {
  NPB_MARKET_OBSERVATION_RESULT_KIND,
  type NpbFavoriteWon,
  type NpbMarketFavoriteSide,
  type NpbMarketObservationResultV0,
  type NpbResultWinner,
} from "./types";

export function resolveWinner(
  awayScore: number | null,
  homeScore: number | null,
): NpbResultWinner | null {
  if (awayScore == null || homeScore == null) return null;
  if (homeScore > awayScore) return "HOME";
  if (awayScore > homeScore) return "AWAY";
  return "DRAW";
}

export function resolveMarketFavorite(
  market: Pick<NpbEvidenceMarketSide, "awayOdds" | "homeOdds"> | null,
): NpbMarketFavoriteSide {
  if (!market) return "UNKNOWN";
  const { awayOdds, homeOdds } = market;
  if (awayOdds == null || homeOdds == null) return "UNKNOWN";
  if (awayOdds < homeOdds) return "AWAY";
  if (homeOdds < awayOdds) return "HOME";
  return "EVEN";
}

export function resolveFavoriteWon(
  favorite: NpbMarketFavoriteSide,
  actualWinner: NpbResultWinner | null,
): NpbFavoriteWon {
  if (actualWinner == null) return "NOT_APPLICABLE";
  if (favorite === "UNKNOWN" || favorite === "EVEN") return "NOT_APPLICABLE";
  if (actualWinner === "DRAW") return "NO";
  return favorite === actualWinner ? "YES" : "NO";
}

/** Market observation only — never framed as engine / model performance. */
export function buildMarketObservation(input: {
  market: Pick<NpbEvidenceMarketSide, "awayOdds" | "homeOdds"> | null;
  actualWinner: NpbResultWinner | null;
}): NpbMarketObservationResultV0 {
  const marketFavorite = resolveMarketFavorite(input.market);
  return {
    kind: NPB_MARKET_OBSERVATION_RESULT_KIND,
    pregameMoneyline: {
      awayOdds: input.market?.awayOdds ?? null,
      homeOdds: input.market?.homeOdds ?? null,
    },
    marketFavorite,
    actualWinner: input.actualWinner,
    favoriteWon: resolveFavoriteWon(marketFavorite, input.actualWinner),
  };
}
