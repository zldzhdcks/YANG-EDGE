/**
 * NPB Official Result Intake v0
 * Joins official final scores to immutable Pregame Evidence Snapshot.
 * No Prediction Engine / Accuracy / Good Pick / Confidence.
 */

export const NPB_OFFICIAL_RESULTS_SCHEMA = "npb-official-results-v0" as const;

export const NPB_MARKET_OBSERVATION_RESULT_KIND =
  "MARKET_OBSERVATION_RESULT" as const;

export type NpbOfficialResultStatus =
  | "FINAL"
  | "NOT_FINAL"
  | "CANCELLED"
  | "POSTPONED";

export type NpbResultJoinStatus = "MATCHED" | "NOT_MATCHED" | "AMBIGUOUS";

export type NpbResultWinner = "HOME" | "AWAY" | "DRAW";

export type NpbMarketFavoriteSide = "HOME" | "AWAY" | "EVEN" | "UNKNOWN";

export type NpbFavoriteWon = "YES" | "NO" | "NOT_APPLICABLE";

/** Collected official score in source (venue) home/away orientation. */
export type NpbCollectedOfficialGameV0 = {
  sourceGameKey: string;
  awayTeam: string;
  homeTeam: string;
  awayScore: number | null;
  homeScore: number | null;
  status: NpbOfficialResultStatus;
  sourceUrl: string;
};

export type NpbMarketObservationResultV0 = {
  kind: typeof NPB_MARKET_OBSERVATION_RESULT_KIND;
  pregameMoneyline: {
    awayOdds: number | null;
    homeOdds: number | null;
  };
  marketFavorite: NpbMarketFavoriteSide;
  actualWinner: NpbResultWinner | null;
  favoriteWon: NpbFavoriteWon;
};

export type NpbOfficialResultGameV0 = {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  awayScore: number | null;
  homeScore: number | null;
  /** Recorded only when status === FINAL; otherwise null. */
  winner: NpbResultWinner | null;
  status: NpbOfficialResultStatus;
  resultCollectedAt: string;
  joinStatus: NpbResultJoinStatus;
  modelGrade: "NOT_APPLICABLE";
  predictionAccuracy: "NOT_APPLICABLE";
  marketObservation: NpbMarketObservationResultV0;
  /** Pregame lineup status — never backfilled postgame. */
  lineupStatus: "NOT_RELEASED" | "MISSING";
  source: {
    provider: string;
    sourceGameKey: string | null;
    sourceUrl: string | null;
  };
};

export type NpbOfficialResultsDocumentV0 = {
  schemaVersion: typeof NPB_OFFICIAL_RESULTS_SCHEMA;
  sport: "baseball";
  league: "NPB";
  date: string;
  dateKst: string;
  collectedAt: string;
  sourceProvider: string;
  pregameSnapshotPath: string;
  pregameSnapshotHashSha256: string;
  note: string;
  summary: {
    games: number;
    FINAL: number;
    NOT_FINAL: number;
    CANCELLED: number;
    POSTPONED: number;
    joinMatched: number;
    joinNotMatched: number;
    joinAmbiguous: number;
    marketFavoriteWon: number;
    marketFavoriteLost: number;
    marketFavoriteNotApplicable: number;
  };
  games: NpbOfficialResultGameV0[];
};

export type NpbOfficialResultGameViewV0 = {
  gameId: string;
  matchup: string;
  awayTeam: string;
  homeTeam: string;
  beforeGame: {
    starterAway: string | null;
    starterHome: string | null;
    moneylineAway: number | null;
    moneylineHome: number | null;
    lineupStatus: string;
  };
  afterGame: {
    status: NpbOfficialResultStatus | "MISSING";
    awayScore: number | null;
    homeScore: number | null;
    winner: NpbResultWinner | null;
    marketFavorite: NpbMarketFavoriteSide | null;
    favoriteWon: NpbFavoriteWon | null;
    joinStatus: NpbResultJoinStatus | null;
  };
};
