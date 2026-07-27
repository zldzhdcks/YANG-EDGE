/**
 * MLB Weather Dataset v1 — research-only environment snapshot.
 * Engine admission PROHIBITED. No Weather Score. Forecast provider not selected in v1.
 */

export const WEATHER_DATASET_ID = "mlb-weather";
export const WEATHER_SCHEMA_VERSION = "mlb-weather-dataset-v1";
export const WEATHER_BUILDER_VERSION = "weather-dataset-builder-v1";

export const WEATHER_COLLECTION_PHASE = "PRE_GAME_FORECAST" as const;

export const WEATHER_PROVIDER_CANDIDATES = [
  "noaa-nws-api",
  "open-meteo",
  "openweathermap-one-call",
] as const;

export type WeatherProviderCandidate = (typeof WEATHER_PROVIDER_CANDIDATES)[number];

export type WeatherRoofType = "OPEN" | "DOME" | "RETRACTABLE";
export type WeatherRoofStatus = "UNKNOWN";

export type WeatherFieldAvailability = "NOT_COLLECTED";

export type WeatherForecastSnapshot = {
  temperature: WeatherFieldAvailability | null;
  humidity: WeatherFieldAvailability | null;
  windSpeed: WeatherFieldAvailability | null;
  windDirection: WeatherFieldAvailability | null;
  precipProbability: WeatherFieldAvailability | null;
  condition: WeatherFieldAvailability | null;
};

export type WeatherVenueSnapshot = {
  id: number;
  name: string;
  roofType: WeatherRoofType | null;
  roofStatus: WeatherRoofStatus;
};

export type WeatherDatasetRow = {
  schemaVersion: typeof WEATHER_SCHEMA_VERSION;
  builderVersion: typeof WEATHER_BUILDER_VERSION;
  generatedAt: string;
  gameDate: string;
  gameId: string;
  gamePk: number;
  collectionPhase: typeof WEATHER_COLLECTION_PHASE;
  venue: WeatherVenueSnapshot;
  forecast: WeatherForecastSnapshot;
  forecastIssuedAt: null;
  cutoffTime: string | null;
  researchOnly: true;
  legalStatus: "INTERNAL_RESEARCH_ONLY";
  engineUseAllowed: false;
  missing: string[];
  warnings: string[];
  inputHash: string;
  resultHash: string;
};

export type WeatherDatasetDocument = {
  meta: {
    datasetId: typeof WEATHER_DATASET_ID;
    schemaVersion: typeof WEATHER_SCHEMA_VERSION;
    builderVersion: typeof WEATHER_BUILDER_VERSION;
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
    provider: {
      selected: null;
      candidates: WeatherProviderCandidate[];
      status: "NOT_SELECTED";
    };
    legal: {
      mlbStatsSource: "INTERNAL_RESEARCH_ONLY";
      publicRuntimeUseAllowed: false;
      commercialRuntimeUseAllowed: false;
      rawResponseInResearchCacheOnly: true;
      mlbHtmlCrawling: false;
      sportsDataIoScrambled: false;
      weatherProviderScraping: false;
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
    venuesResolved: number;
    roofTypes: Record<string, number>;
    forecastCollected: number;
    forecastMissing: number;
    weatherCollected: number;
    weatherMissing: number;
  };
  rows: WeatherDatasetRow[];
};

export type BuildWeatherDatasetResult = {
  document: WeatherDatasetDocument;
  usage: import("./research-stats-cache").CacheUsageStats;
};
