/**
 * MLB SportsDataIO 보강 데이터 후보 타입.
 * Engine 입력으로 사용하지 않는다. 안전 계층·보고서 전용.
 */

export type MlbEnrichmentMatchStatus =
  | "MATCHED"
  | "UNMATCHED"
  | "AMBIGUOUS";

export type MlbEnrichmentWarning =
  | "STANDINGS_NOT_IMPLEMENTED"
  | "SCRAMBLED_STATUS_UNKNOWN"
  | "SCRAMBLED_DATA_CONFIRMED"
  | "MATCH_FAILED"
  | "MATCH_AMBIGUOUS"
  | "STARTING_PITCHER_MISSING"
  | "PROJECTED_LINEUP_MISSING"
  | "CONFIRMED_LINEUP_MISSING"
  | "INJURIES_MISSING"
  | "SOURCE_UNCLEAR"
  | "IDENTIFIERS_INVALID"
  | string;

export type MlbEnrichmentPitcherSide = {
  playerId: number | null;
  name: string | null;
  available: boolean;
};

export type MlbEnrichmentStartingPitchers = {
  home: MlbEnrichmentPitcherSide;
  away: MlbEnrichmentPitcherSide;
  available: boolean;
};

export type MlbEnrichmentLineupSummary = {
  available: boolean;
  teamCount: number;
  playerCount: number;
};

export type MlbEnrichmentInjuriesSummary = {
  available: boolean;
  count: number;
  homeCount: number;
  awayCount: number;
};

export type MlbEnrichmentCandidate = {
  gameId: string;
  sportsDataGameId: string | null;
  homeTeam: string;
  awayTeam: string;
  startTime: string | null;
  startingPitchers: MlbEnrichmentStartingPitchers | null;
  projectedLineup: MlbEnrichmentLineupSummary | null;
  confirmedLineup: MlbEnrichmentLineupSummary | null;
  injuries: MlbEnrichmentInjuriesSummary | null;
  standings: null;
  source: "sportsdataio";
  scrambled: boolean | null;
  usableForEngine: boolean;
  warnings: MlbEnrichmentWarning[];
  dataAvailability: number;
  /** 보고서용 부가 필드 */
  matchStatus: MlbEnrichmentMatchStatus;
  matchConfidence: number;
  scrambledEvidence: string[];
};

export type MlbBaselineMatchGame = {
  gameId: string;
  externalId?: string;
  homeTeam: string;
  awayTeam: string;
  commenceTimeUtc: string | null;
  startTimeKst?: string | null;
  dateKst?: string | null;
};

export type SportsDataMatchGame = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTimeUtc: string | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homePitcherId: number | null;
  awayPitcherId: number | null;
  homePitcherName: string | null;
  awayPitcherName: string | null;
  raw: Record<string, unknown>;
};
