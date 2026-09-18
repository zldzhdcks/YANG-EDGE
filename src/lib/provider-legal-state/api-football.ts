import {
  LEGAL_BLOCK,
  LEGAL_CONDITIONAL,
  LEGAL_PASS,
  LEGAL_REVIEW_REQUIRED,
  NOT_REQUIRED_BY_PROVIDER,
  type ProviderAttributionStatus,
  type ProviderLegalStatus,
} from "./types";

export const API_FOOTBALL_LEGAL_PROVIDER = "API-SPORTS / API-Football" as const;

export const API_FOOTBALL_LEGAL_EVIDENCE_DATE = "2026-09-19" as const;

export const API_FOOTBALL_LEGAL_EVIDENCE_REL =
  "data/compliance/providers/api-football-provider-legal-evidence-2026-09-19-v1.json" as const;

export const API_FOOTBALL_TERMS_LAST_UPDATED = "2025-05-21" as const;

/** Provider-license HOLD on unattended automation is removed. Not operational enablement. */
export const API_FOOTBALL_LAUNCHD: ProviderLegalStatus = LEGAL_PASS;

export const API_FOOTBALL_LAUNCHD_ENABLED = false;

export const API_FOOTBALL_RAW_STORAGE: ProviderLegalStatus = LEGAL_CONDITIONAL;
export const API_FOOTBALL_CACHE: ProviderLegalStatus = LEGAL_CONDITIONAL;
export const API_FOOTBALL_HISTORICAL_RETENTION: ProviderLegalStatus =
  LEGAL_CONDITIONAL;

export const API_FOOTBALL_DERIVED_STORAGE: ProviderLegalStatus = LEGAL_PASS;
export const API_FOOTBALL_PREDICTION_INPUT: ProviderLegalStatus = LEGAL_PASS;
export const API_FOOTBALL_AI_ML_INPUT: ProviderLegalStatus = LEGAL_PASS;

export const API_FOOTBALL_PUBLIC_FIXTURE_DISPLAY: ProviderLegalStatus =
  LEGAL_CONDITIONAL;
export const API_FOOTBALL_TEAM_NAME_DISPLAY: ProviderLegalStatus =
  LEGAL_CONDITIONAL;
export const API_FOOTBALL_LEAGUE_NAME_DISPLAY: ProviderLegalStatus =
  LEGAL_CONDITIONAL;

export const API_FOOTBALL_DERIVED_PUBLIC_ANALYSIS: ProviderLegalStatus =
  LEGAL_CONDITIONAL;

export const API_FOOTBALL_RAW_RESALE: ProviderLegalStatus = LEGAL_BLOCK;
export const API_FOOTBALL_RAW_API_REDISTRIBUTION: ProviderLegalStatus =
  LEGAL_BLOCK;
export const API_FOOTBALL_CUSTOMER_DATA_FEED: ProviderLegalStatus = LEGAL_BLOCK;

export const API_FOOTBALL_TEAM_LOGO: ProviderLegalStatus = LEGAL_REVIEW_REQUIRED;
export const API_FOOTBALL_LEAGUE_LOGO: ProviderLegalStatus =
  LEGAL_REVIEW_REQUIRED;
export const API_FOOTBALL_PLAYER_PHOTO: ProviderLegalStatus =
  LEGAL_REVIEW_REQUIRED;
export const API_FOOTBALL_BRANDED_IMAGE: ProviderLegalStatus =
  LEGAL_REVIEW_REQUIRED;

export const API_FOOTBALL_COMMERCIAL_USE: ProviderLegalStatus =
  LEGAL_REVIEW_REQUIRED;

export const API_FOOTBALL_ATTRIBUTION: ProviderAttributionStatus =
  NOT_REQUIRED_BY_PROVIDER;

export const API_FOOTBALL_LAUNCHD_CONDITIONS = [
  "official API key",
  "actual subscription quota respected",
  "per-minute rate limit respected",
  "API key never stored in Repository/Git",
] as const;

export const API_FOOTBALL_LAUNCHD_REMAINING_OPERATIONAL_GATES = [
  "actual subscription/quota evidence",
  "actual rate-limit evidence",
  "key presence boolean",
  "operational scheduling design",
  "Mac environment readiness",
] as const;

export const API_FOOTBALL_STORAGE_CONDITIONS = [
  "internal storage permitted",
  "caching permitted",
  "no documented maximum retention period",
  "internal historical retention permitted",
  "retention after subscription termination permitted",
  "stored raw/cached data MUST NOT become an external API/feed/resale product",
] as const;

export const API_FOOTBALL_PUBLIC_FACTUAL_FIELDS = [
  "team names",
  "league / competition names",
  "match date",
  "kickoff time",
  "match status",
] as const;

export const API_FOOTBALL_PROHIBITED_REDISTRIBUTION = [
  "raw API-Football data resale",
  "a YANG EDGE API exposing API-Football data",
  "customer-facing raw data feed",
  "rename-and-republish raw fields",
  "subset raw-field resale",
] as const;

export const API_FOOTBALL_CURRENT_PUBLIC_EXPOSURE = {
  frozen: true,
  competitionLevelReviewExists: false,
  routes: ["/games", "/api/football/fixtures"],
  note: "Existing public rows are current-state only. They are not a Legal Room approval to expand competitions, fields, logos, or endpoints.",
} as const;

export const API_FOOTBALL_SCOPE_STATUSES = {
  API_FOOTBALL_LAUNCHD,
  API_FOOTBALL_RAW_STORAGE,
  API_FOOTBALL_CACHE,
  API_FOOTBALL_HISTORICAL_RETENTION,
  API_FOOTBALL_DERIVED_STORAGE,
  API_FOOTBALL_PREDICTION_INPUT,
  API_FOOTBALL_AI_ML_INPUT,
  API_FOOTBALL_PUBLIC_FIXTURE_DISPLAY,
  API_FOOTBALL_TEAM_NAME_DISPLAY,
  API_FOOTBALL_LEAGUE_NAME_DISPLAY,
  API_FOOTBALL_DERIVED_PUBLIC_ANALYSIS,
  API_FOOTBALL_RAW_RESALE,
  API_FOOTBALL_RAW_API_REDISTRIBUTION,
  API_FOOTBALL_CUSTOMER_DATA_FEED,
  API_FOOTBALL_TEAM_LOGO,
  API_FOOTBALL_LEAGUE_LOGO,
  API_FOOTBALL_PLAYER_PHOTO,
  API_FOOTBALL_BRANDED_IMAGE,
  API_FOOTBALL_COMMERCIAL_USE,
  API_FOOTBALL_ATTRIBUTION,
} as const;

/**
 * Runtime legal state. LEGAL_PASS on launchd removes Provider HOLD only.
 * It does not enable launchd, choose cadence, or assume quota.
 */
export const API_FOOTBALL_LEGAL_STATE = {
  provider: API_FOOTBALL_LEGAL_PROVIDER,
  evidenceDate: API_FOOTBALL_LEGAL_EVIDENCE_DATE,
  termsLastUpdated: API_FOOTBALL_TERMS_LAST_UPDATED,
  supersededPriorState: "API_FOOTBALL_PUBLIC_DISPLAY=HOLD",
  automation: {
    launchd: API_FOOTBALL_LAUNCHD,
    legalHoldRemoved: true,
    launchdEnabled: API_FOOTBALL_LAUNCHD_ENABLED,
    quotaEvidenceAdded: false,
    rateLimitEvidenceAdded: false,
    conditions: API_FOOTBALL_LAUNCHD_CONDITIONS,
    remainingOperationalGates: API_FOOTBALL_LAUNCHD_REMAINING_OPERATIONAL_GATES,
  },
  storage: {
    raw: API_FOOTBALL_RAW_STORAGE,
    cache: API_FOOTBALL_CACHE,
    historicalRetention: API_FOOTBALL_HISTORICAL_RETENTION,
    conditions: API_FOOTBALL_STORAGE_CONDITIONS,
  },
  derived: {
    storage: API_FOOTBALL_DERIVED_STORAGE,
    predictionInput: API_FOOTBALL_PREDICTION_INPUT,
    aiMlInput: API_FOOTBALL_AI_ML_INPUT,
    note: "Legal permission is not an Engine instruction. No model, weight, or threshold change.",
  },
  publicFactualDisplay: {
    fixture: API_FOOTBALL_PUBLIC_FIXTURE_DISPLAY,
    teamName: API_FOOTBALL_TEAM_NAME_DISPLAY,
    leagueName: API_FOOTBALL_LEAGUE_NAME_DISPLAY,
    coveredFields: API_FOOTBALL_PUBLIC_FACTUAL_FIELDS,
    currentExposure: API_FOOTBALL_CURRENT_PUBLIC_EXPOSURE,
    newCompetitionPolicy:
      "NEW PUBLIC COMPETITION → LEAGUE RIGHTS REVIEW → LEGAL RESULT → PUBLIC ENABLE",
  },
  derivedPublicAnalysis: API_FOOTBALL_DERIVED_PUBLIC_ANALYSIS,
  redistribution: {
    rawResale: API_FOOTBALL_RAW_RESALE,
    rawApiRedistribution: API_FOOTBALL_RAW_API_REDISTRIBUTION,
    customerDataFeed: API_FOOTBALL_CUSTOMER_DATA_FEED,
    prohibited: API_FOOTBALL_PROHIBITED_REDISTRIBUTION,
    note: "Application UI factual display and raw feed/API redistribution are separate policy concepts.",
  },
  visualAssets: {
    teamLogo: API_FOOTBALL_TEAM_LOGO,
    leagueLogo: API_FOOTBALL_LEAGUE_LOGO,
    playerPhoto: API_FOOTBALL_PLAYER_PHOTO,
    brandedImage: API_FOOTBALL_BRANDED_IMAGE,
    publicPrototypePolicy: "text-first",
  },
  commercialUse: API_FOOTBALL_COMMERCIAL_USE,
  attribution: API_FOOTBALL_ATTRIBUTION,
} as const;
