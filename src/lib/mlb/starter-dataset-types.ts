/**
 * MLB Starter Dataset v1 types.
 * Pre-game probable starter freeze only. No Engine / Score / confirmed.
 */

export type StarterProbableStatus = "PROBABLE_ONLY" | "MISSING";

export type StarterJoinQuality = "MATCHED" | "AMBIGUOUS" | "UNLINKED";

export type StarterSide = "home" | "away";

export type StarterSeasonStats = {
  era: number | null;
  whip: number | null;
  inningsPitched: number | null;
  gamesPlayed: number | null;
  gamesStarted: number | null;
  wins: number | null;
  losses: number | null;
  strikeOuts: number | null;
  baseOnBalls: number | null;
  homeRuns: number | null;
};

export type StarterRecentStart = {
  date: string | null;
  gamePk: number | null;
  inningsPitched: number | null;
  earnedRuns: number | null;
  strikeOuts: number | null;
  baseOnBalls: number | null;
  hits: number | null;
  homeRuns: number | null;
  numberOfPitches: number | null;
  win: boolean | null;
  loss: boolean | null;
};

export type StarterPostGameReview = {
  status:
    | "STARTER_MATCHED"
    | "STARTER_CHANGED"
    | "STARTER_UNKNOWN"
    | "NOT_FINAL"
    | "AWAITING_RESULT";
  actualStarterId: number | null;
  actualStarterName: string | null;
  comparedAt: string;
  note: string;
};

export type StarterDatasetRow = {
  schemaVersion: string;
  builderVersion: string;
  predictionDate: string;
  gameId: string | null;
  gamePk: number | null;
  teamId: number | null;
  opponentTeamId: number | null;
  side: StarterSide;
  homeTeam: string | null;
  awayTeam: string | null;
  probablePitcherId: number | null;
  probablePitcherName: string | null;
  throws: "L" | "R" | null;
  probableStatus: StarterProbableStatus;
  /**
   * @deprecated Prefer fetchedAt. Kept as alias for cutoff consumers.
   */
  sourceTimestamp: string | null;
  /** When Stats schedule/person payloads were read for this build. */
  fetchedAt?: string | null;
  artifactGeneratedAt?: string | null;
  /** Season/recent-starts cutoff as-of (usually commenceTimeUtc). */
  statsAsOf?: string | null;
  cutoffTime: string | null;
  seasonStats: StarterSeasonStats | null;
  recentStarts: StarterRecentStart[];
  sampleSize: number | null;
  joinQuality: StarterJoinQuality;
  missingFields: string[];
  warnings: string[];
  researchOnly: true;
  legalStatus: "INTERNAL_RESEARCH_ONLY";
  /** Pre-game payload only — never overwritten by actual starter */
  preGameImmutable: true;
  postGameReview: StarterPostGameReview | null;
};

export type StarterDatasetDocument = {
  meta: {
    datasetId: "mlb-starter";
    schemaVersion: string;
    builderVersion: string;
    status: "COLLECTING";
    engineAdmission: "PROHIBITED";
    engineConnected: false;
    engineUseAllowed: false;
    researchOnly: true;
    dateKst: string;
    generatedAt: string;
    predictionHashSha256: string;
    predictionUnchanged: true;
    inputHashSha256: string;
    resultHashSha256: string;
    legal: {
      mlbStatsSource: "INTERNAL_RESEARCH_ONLY";
      publicRuntimeUseAllowed: false;
      commercialRuntimeUseAllowed: false;
      rawResponseInResearchCacheOnly: true;
      mlbHtmlCrawling: false;
      sportsDataIoScrambled: false;
    };
  };
  cacheUsage: {
    rawHit: number;
    rawMiss: number;
    derivedHit: number;
    derivedMiss: number;
    networkCalls: number;
  };
  summary: {
    totalGames: number;
    totalRows: number;
    probableRows: number;
    missingRows: number;
    homeRows: number;
    awayRows: number;
    seasonStatsAvailable: number;
    recentStartsAvailable: number;
    averageSampleSize: number | null;
    joinQuality: Record<StarterJoinQuality, number>;
    targetGameIncludedInStats: number;
    cutoffViolations: number;
    confirmedRows: number;
    starterChangedReviews: number;
  };
  rows: StarterDatasetRow[];
};
