/**
 * Korean Market Baseline for MLB postgame — observation-only.
 * Never feeds Prediction / Engine / Recommendation.
 */
import {
  loadMlbKoreanMarketOddsObservation,
  type MlbKoreanMarketOddsObservationV0,
} from "@/lib/mlb/korean-market-odds-observation-v0";
import { mlbKoreanMarketOddsObservationRel } from "@/lib/mlb/korean-market-odds-observation-v0/paths";
import type { MlbOfficialResultsDocument } from "@/lib/mlb/mlb-prediction-review-types";

export type MlbKoreanMarketFavoriteSide =
  | "HOME"
  | "AWAY"
  | "TIE"
  | "NO_FAVORITE";

export type MlbKoreanMarketJoinStatus =
  | "MATCHED"
  | "RESULT_MISSING"
  | "RESULT_NOT_FINAL"
  | "MARKET_JOIN_FAILED"
  | "NO_OBSERVATION";

export type MlbKoreanMarketBaselineRow = {
  gamePk: number;
  internalGameId: string;
  awayOdds: number | null;
  homeOdds: number | null;
  marketFavorite: MlbKoreanMarketFavoriteSide;
  actualWinner: "HOME" | "AWAY" | "DRAW" | null;
  favoriteWon: "YES" | "NO" | "NOT_APPLICABLE";
  joinStatus: MlbKoreanMarketJoinStatus;
  resultStatus: string | null;
};

export type MlbKoreanMarketBaselineV0 = {
  kind: "KOREAN_MARKET_BASELINE";
  available: boolean;
  observationPath: string;
  observationHash: string | null;
  observedGames: number;
  preGameObservations: number;
  scheduleGames: number;
  rows: MlbKoreanMarketBaselineRow[];
  favoriteWon: number;
  favoriteLost: number;
  tieOrNoFavorite: number;
  pending: number;
  decided: number;
  /** Only when all decided games among observed have FINAL results. */
  accuracyFinalized: boolean;
  accuracyPercent: number | null;
  display: string;
  note: string;
};

function resolveFavorite(
  awayOdds: number | null,
  homeOdds: number | null,
): MlbKoreanMarketFavoriteSide {
  if (awayOdds == null || homeOdds == null) return "NO_FAVORITE";
  if (awayOdds === homeOdds) return "TIE";
  if (awayOdds < homeOdds) return "AWAY";
  if (homeOdds < awayOdds) return "HOME";
  return "TIE";
}

export function buildMlbKoreanMarketBaseline(input: {
  dateKst: string;
  observation: MlbKoreanMarketOddsObservationV0 | null;
  results: MlbOfficialResultsDocument | null;
}): MlbKoreanMarketBaselineV0 {
  const pathRel = mlbKoreanMarketOddsObservationRel(input.dateKst);
  if (!input.observation) {
    return {
      kind: "KOREAN_MARKET_BASELINE",
      available: false,
      observationPath: pathRel,
      observationHash: null,
      observedGames: 0,
      preGameObservations: 0,
      scheduleGames: 0,
      rows: [],
      favoriteWon: 0,
      favoriteLost: 0,
      tieOrNoFavorite: 0,
      pending: 0,
      decided: 0,
      accuracyFinalized: false,
      accuracyPercent: null,
      display: "MISSING",
      note: "Korean Market Observation absent — not a model feature.",
    };
  }

  const resultByPk = new Map(
    (input.results?.games ?? []).map((g) => [g.gamePk, g] as const),
  );

  const rows: MlbKoreanMarketBaselineRow[] = [];
  let favoriteWon = 0;
  let favoriteLost = 0;
  let tieOrNoFavorite = 0;
  let pending = 0;

  for (const g of input.observation.games) {
    const favorite = resolveFavorite(g.awayOdds, g.homeOdds);
    const result = resultByPk.get(g.gamePk) ?? null;

    let joinStatus: MlbKoreanMarketJoinStatus = "RESULT_MISSING";
    let actualWinner: "HOME" | "AWAY" | "DRAW" | null = null;
    let favoriteWonFlag: "YES" | "NO" | "NOT_APPLICABLE" = "NOT_APPLICABLE";
    let resultStatus: string | null = null;

    if (g.joinStatus !== "MATCHED") {
      joinStatus = "MARKET_JOIN_FAILED";
      pending += 1;
    } else if (!result) {
      joinStatus = input.results ? "MARKET_JOIN_FAILED" : "RESULT_MISSING";
      pending += 1;
    } else if (result.status !== "FINAL") {
      joinStatus = "RESULT_NOT_FINAL";
      resultStatus = result.status;
      pending += 1;
    } else {
      joinStatus = "MATCHED";
      resultStatus = result.status;
      actualWinner = result.winner;
      if (favorite === "TIE" || favorite === "NO_FAVORITE") {
        tieOrNoFavorite += 1;
        favoriteWonFlag = "NOT_APPLICABLE";
      } else if (actualWinner == null || actualWinner === "DRAW") {
        favoriteWonFlag = "NOT_APPLICABLE";
        tieOrNoFavorite += 1;
      } else if (favorite === actualWinner) {
        favoriteWon += 1;
        favoriteWonFlag = "YES";
      } else {
        favoriteLost += 1;
        favoriteWonFlag = "NO";
      }
    }

    rows.push({
      gamePk: g.gamePk,
      internalGameId: g.internalGameId,
      awayOdds: g.awayOdds,
      homeOdds: g.homeOdds,
      marketFavorite: favorite,
      actualWinner,
      favoriteWon: favoriteWonFlag,
      joinStatus,
      resultStatus,
    });
  }

  const decided = favoriteWon + favoriteLost;
  const accuracyFinalized =
    Boolean(input.results) &&
    pending === 0 &&
    input.observation.games.length > 0 &&
    decided + tieOrNoFavorite === input.observation.games.length;
  const accuracyPercent =
    decided > 0 ? Math.round((favoriteWon / decided) * 1000) / 10 : null;

  return {
    kind: "KOREAN_MARKET_BASELINE",
    available: true,
    observationPath: pathRel,
    observationHash: input.observation.koreanMarketOddsHash,
    observedGames: input.observation.summary.observedGames,
    preGameObservations: input.observation.summary.preGameObservations,
    scheduleGames: input.observation.summary.scheduleGames,
    rows,
    favoriteWon,
    favoriteLost,
    tieOrNoFavorite,
    pending,
    decided,
    accuracyFinalized,
    accuracyPercent,
    display: input.results
      ? `${favoriteWon} Won · ${favoriteLost} Lost · ${
          accuracyPercent == null ? "—" : `${accuracyPercent.toFixed(1)}%`
        }`
      : `✓ ${input.observation.summary.preGameObservations}/${input.observation.summary.scheduleGames} PRE-GAME OBSERVATIONS`,
    note: "KOREAN_MARKET_BASELINE — independent observation. Not Model Probability / Engine input.",
  };
}

export async function loadMlbKoreanMarketBaseline(input: {
  dateKst: string;
  cwd?: string;
  results: MlbOfficialResultsDocument | null;
}): Promise<MlbKoreanMarketBaselineV0> {
  const observation = await loadMlbKoreanMarketOddsObservation({
    dateKst: input.dateKst,
    cwd: input.cwd,
  });
  return buildMlbKoreanMarketBaseline({
    dateKst: input.dateKst,
    observation,
    results: input.results,
  });
}
