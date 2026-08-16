/**
 * Football Observed Slate v0 — research overlay.
 * Preserves every manually observed fixture even when football-schedule-v1
 * drops unregistered competitions. Not a Prediction / Engine input.
 */

export const FOOTBALL_OBSERVED_SLATE_V0_SCHEMA =
  "football-observed-slate-v0" as const;
export const FOOTBALL_OBSERVED_SLATE_V0_BUILDER =
  "football-observed-slate-builder-v0" as const;

export type FootballObservationStatus = "OBSERVED";
export type FootballFixtureIdentityStatus = "MATCHED";
export type FootballCompetitionAdmissionStatus = "REGISTERED" | "UNREGISTERED";
export type FootballPregameEvidenceStatus = "ELIGIBLE" | "CUTOFF_BLOCKED";

/**
 * Overlay-only. Does not reuse football-schedule-v1 predictionEligibility
 * or prediction-snapshot-v0 snapshotStatus (no PASS_UNSUPPORTED_COMPETITION there).
 */
export type FootballSlatePredictionStatus =
  | "NOT_EVALUATED"
  | "NOT_SUPPORTED_COMPETITION"
  | "NOT_PREGAME_ELIGIBLE";

export type FootballResearchUsageEligibility =
  | "FUTURE_RESEARCH_ELIGIBLE"
  | "OBSERVED_UNSUPPORTED"
  | "NOT_PREGAME_ELIGIBLE";

export type FootballSlateResearchStatus =
  | "OBSERVED_REGISTERED"
  | "PASS_UNSUPPORTED_COMPETITION"
  | "CUTOFF_BLOCKED";

export type FootballObservedMarketKind =
  | "ONE_X_TWO"
  | "HANDICAP"
  | "TOTALS"
  | "SUM_RAW_ONLY"
  | "RAW_ONLY";

export type FootballCompetitionRegistrationCandidateStatus =
  | "CANDIDATE_FOR_RESEARCH_REGISTRATION"
  | "FORMAT_REVIEW_REQUIRED"
  | "LEGAL_REVIEW_REQUIRED"
  | "DO_NOT_REGISTER_YET";

export type FootballObservedMarketV0 = {
  rawMarketLabel: string;
  marketKind: FootballObservedMarketKind;
  line: number | null;
  prices: Array<number | null>;
  oneX2Joined: boolean;
};

export type FootballObservedSlateGameV0 = {
  rowId: number;
  fixtureId: number;
  observationStatus: FootballObservationStatus;
  fixtureIdentityStatus: FootballFixtureIdentityStatus;
  competitionAdmissionStatus: FootballCompetitionAdmissionStatus;
  pregameEvidenceStatus: FootballPregameEvidenceStatus;
  slatePredictionStatus: FootballSlatePredictionStatus;
  researchUsageEligibility: FootballResearchUsageEligibility;
  slateResearchStatus: FootballSlateResearchStatus;
  cutoffStatus: string;
  rawLeagueLabel: string;
  providerCompetitionId: number;
  providerCompetitionName: string;
  rawLeftTeam: string;
  rawRightTeam: string;
  candidateLeftTeam: string;
  candidateRightTeam: string;
  providerHomeTeamId: number | null;
  providerHomeTeamName: string | null;
  providerAwayTeamId: number | null;
  providerAwayTeamName: string | null;
  displayedDateKst: string;
  displayedStartKst: string;
  providerKickoffUtc: string | null;
  providerKickoffKst: string | null;
  sourceScreenshotFile: string;
  sourceScreenshotSha256: string;
  inScheduleArtifact: boolean;
  markets: FootballObservedMarketV0[];
};

export type FootballCompetitionGapRowV0 = {
  providerCompetitionId: number;
  providerCompetitionName: string;
  rawLeagueLabels: string[];
  observedFixtureCount: number;
  marketObservationPresent: true;
  legalStatus: "NEEDS_LEGAL_REVIEW";
  matchFormat: "LEAGUE_MATCH" | "CUP" | "UNKNOWN";
  potential1x2Compatibility: "LIKELY" | "REVIEW";
  currentReasonUnregistered: string;
  registrationCandidateStatus: FootballCompetitionRegistrationCandidateStatus;
};

export type FootballObservedSlateV0 = {
  schemaVersion: typeof FOOTBALL_OBSERVED_SLATE_V0_SCHEMA;
  builderVersion: typeof FOOTBALL_OBSERVED_SLATE_V0_BUILDER;
  batchId: string;
  dateKst: string;
  sourceObservationPath: string;
  sourceObservationHash: string;
  sourceMappingPath: string;
  sourceMappingHash: string;
  receivedAtKst: string;
  captureTime: unknown;
  generatedAt: string;
  researchOnly: true;
  engineAdmission: "PROHIBITED";
  engineConnected: false;
  autoApply: false;
  resultDataUsed: false;
  doesNotReplaceScheduleV1: true;
  scheduleFilterUnchanged: true;
  note: string;
  passSchemaAudit: {
    existingSnapshotHasPassUnsupportedCompetition: false;
    overlayUsesPassUnsupportedCompetition: true;
    enginePickSchemaChanged: false;
  };
  summary: {
    observedGames: number;
    fixtureMapped: number;
    registeredCompetition: number;
    unregisteredCompetition: number;
    pregameEligible: number;
    cutoffBlocked: number;
    droppedFromObservedSlate: number;
    marketRows: number;
    oneX2Observations: number;
    oneX2Joined: number;
    oneX2RegisteredEligible: number;
    oneX2UnsupportedObserved: number;
    oneX2CutoffBlocked: number;
  };
  competitionGap: FootballCompetitionGapRowV0[];
  games: FootballObservedSlateGameV0[];
};
