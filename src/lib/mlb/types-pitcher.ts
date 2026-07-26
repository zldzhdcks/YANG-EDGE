/**
 * MLB probable pitcher 성적 커버리지 타입.
 * Engine 미연결. 추정값 생성 금지.
 */

export type PitcherStatCoverageStatus =
  | "READY_FOR_BACKTEST"
  | "PARTIAL"
  | "LEAKAGE_RISK"
  | "UNAVAILABLE"
  | "AMBIGUOUS";

export type PitcherIdentity = {
  providerPlayerId: string | null;
  fullName: string | null;
  teamName: string | null;
  throws: "L" | "R" | null;
  mlbGamePk: number | null;
  baselineGameId: string | null;
  source: string;
};

export type RecentPitcherOuting = {
  date: string | null;
  gamePk: number | null;
  inningsPitched: number | null;
  earnedRuns: number | null;
  strikeOuts: number | null;
  baseOnBalls: number | null;
  hits: number | null;
  homeRuns: number | null;
  numberOfPitches: number | null;
  gamesStarted: number | null;
  win: boolean | null;
  loss: boolean | null;
};

export type PitcherStatCandidate = {
  identity: PitcherIdentity;
  seasonEra: number | null;
  seasonWhip: number | null;
  gamesPlayed: number | null;
  gamesStarted: number | null;
  inningsPitched: number | null;
  wins: number | null;
  losses: number | null;
  strikeOuts: number | null;
  baseOnBalls: number | null;
  homeRuns: number | null;
  recentOutings: RecentPitcherOuting[];
  lastOutingDate: string | null;
  numberOfPitchesTotal: number | null;
  qualityStarts: number | null;
  cutoffTime: string;
  statsSource: string | null;
  status: PitcherStatCoverageStatus;
  missingFields: string[];
  warnings: string[];
  coreStatCount: number;
};

export type MlbPitcherGameCoverage = {
  gamePk: number;
  baselineGameId: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  commenceTimeUtc: string | null;
  startTimeKst: string | null;
  home: PitcherStatCandidate;
  away: PitcherStatCandidate;
  gameStatus: PitcherStatCoverageStatus;
  warnings: string[];
};
