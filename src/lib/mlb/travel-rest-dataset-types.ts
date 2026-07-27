/**
 * MLB Travel / Rest Dataset v1 — research-only schedule context.
 * Engine admission PROHIBITED. No Travel/Fatigue/Rest Score. No route inference.
 */

export const TRAVEL_REST_DATASET_ID = "mlb-travel";
export const TRAVEL_REST_SCHEMA_VERSION = "mlb-travel-rest-dataset-v1";
export const TRAVEL_REST_BUILDER_VERSION = "travel-rest-dataset-builder-v1";

export const TRAVEL_REST_COLLECTION_PHASE = "PRE_GAME_SCHEDULE_CONTEXT" as const;

export type TravelTransitionType =
  | "HOME_TO_HOME"
  | "HOME_TO_AWAY"
  | "AWAY_TO_AWAY"
  | "AWAY_TO_HOME";

export type DoubleheaderStatus = "SINGLE" | "GAME1" | "GAME2";

export type TravelRestJoinQuality = "MATCHED" | "MISSING_PREVIOUS";

export type TravelVenueSnapshot = {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  timezoneId: string | null;
  timezoneOffsetHours: number | null;
};

export type TravelTimezoneChange = {
  previousOffsetHours: number | null;
  currentOffsetHours: number | null;
  changeHours: number | null;
};

export type TravelSnapshot = {
  venueChanged: boolean | null;
  previousVenue: TravelVenueSnapshot | null;
  currentVenue: TravelVenueSnapshot | null;
  timezoneChange: TravelTimezoneChange | null;
  distanceKm: number | null;
  transitionType: TravelTransitionType | null;
};

export type RestSnapshot = {
  gamesLast2: number | null;
  gamesLast3: number | null;
  gamesLast7: number | null;
  daysSincePreviousGame: number | null;
  hoursSincePreviousScheduledStart: number | null;
  consecutiveHomeGames: number | null;
  consecutiveAwayGames: number | null;
  doubleheaderStatus: DoubleheaderStatus;
};

export type TravelRestDatasetRow = {
  schemaVersion: typeof TRAVEL_REST_SCHEMA_VERSION;
  builderVersion: typeof TRAVEL_REST_BUILDER_VERSION;
  generatedAt: string;
  gameDate: string;
  gameId: string;
  gamePk: number;
  teamId: number;
  teamName: string;
  side: "home" | "away";
  collectionPhase: typeof TRAVEL_REST_COLLECTION_PHASE;
  cutoffTime: string | null;
  researchOnly: true;
  legalStatus: "INTERNAL_RESEARCH_ONLY";
  engineUseAllowed: false;
  joinQuality: TravelRestJoinQuality;
  travel: TravelSnapshot;
  rest: RestSnapshot;
  missing: string[];
  warnings: string[];
  inputHash: string;
  resultHash: string;
};

export type TravelRestDatasetDocument = {
  meta: {
    datasetId: typeof TRAVEL_REST_DATASET_ID;
    schemaVersion: typeof TRAVEL_REST_SCHEMA_VERSION;
    builderVersion: typeof TRAVEL_REST_BUILDER_VERSION;
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
      routeInference: false;
    };
    notes: string[];
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
    travelResolved: number;
    restResolved: number;
    venueChanges: number;
    timezoneChanges: number;
    joinQuality: Record<TravelRestJoinQuality, number>;
  };
  rows: TravelRestDatasetRow[];
};

export type BuildTravelRestDatasetResult = {
  document: TravelRestDatasetDocument;
  usage: import("./research-stats-cache").CacheUsageStats;
};
