/**
 * Football Odds Bridge Candidate Intake v1.
 * Event identity discovery only. Does not mutate team-bridge.ts.
 * Does not collect bookmaker prices. Does not feed Prediction.
 */
import type { FootballLegalStatus } from "../core/types";
import { FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES } from "../odds-1x2-v1/types";

export const FOOTBALL_ODDS_BRIDGE_INTAKE_V1_SCHEMA =
  "football-odds-bridge-candidate-intake-v1" as const;
export const FOOTBALL_ODDS_BRIDGE_INTAKE_V1_BUILDER =
  "football-odds-bridge-candidate-intake-builder-v1" as const;

export { FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES };

export type FootballOddsBridgeCandidateStatus =
  | "NO_CANDIDATE_NEEDED"
  | "CANONICAL_IDENTITY_BLOCKED"
  | "NOT_SUPPORTED_FORMAT"
  | "COMPETITION_BLOCKED"
  | "UNKNOWN_ELIGIBILITY"
  | "SPORT_KEY_NOT_MAPPED"
  | "SPORT_KEY_ENDPOINT_FAILED"
  | "PROVIDER_NOT_CALLED"
  | "NO_EVENT_CANDIDATE"
  | "AMBIGUOUS_EVENT_CANDIDATES"
  | "ORIENTATION_CONFLICT"
  | "PENDING_REVIEW_SINGLE_SIDE_ANCHORED"
  | "PENDING_REVIEW_SINGLE_EVENT_UNANCHORED";

export type FootballOddsBridgeReviewStatus = "PENDING" | "NOT_APPLICABLE";

export type FootballOddsBridgeTimingClass =
  | "PREGAME_REVIEW_CANDIDATE"
  | "LATE_IDENTITY_EVIDENCE"
  | "NOT_APPLICABLE";

export type FootballOddsBridgeAnchorType =
  | "EXISTING_BRIDGE_HOME"
  | "EXISTING_BRIDGE_AWAY"
  | "KICKOFF_SPORT_KEY_ONLY"
  | "NONE";

export type FootballOddsBridgeConfidenceClass =
  | "HIGH_CONFIDENCE_REVIEW_CANDIDATE"
  | "MANUAL_REVIEW_REQUIRED"
  | "NON_ACTIONABLE";

export type FootballOddsBridgeCandidateEvent = {
  externalEventId: string;
  sportKey: string;
  homeTeamExact: string;
  awayTeamExact: string;
  commenceTime: string;
  kickoffDeltaMinutes: number | null;
};

export type FootballOddsBridgeCandidateMapping = {
  canonicalTeamId: string;
  side: "home" | "away";
  oddsExactName: string;
  anchorType: FootballOddsBridgeAnchorType;
  confidenceClass: FootballOddsBridgeConfidenceClass;
};

export type FootballOddsBridgeSideView = {
  providerTeamId: string;
  canonicalTeamId: string | null;
  scheduleDisplayName: string;
  existingBridgeNames: string[];
};

export type FootballOddsBridgeCandidateRow = {
  matchId: string;
  competitionId: string;
  sportKey: string | null;
  schedule: {
    providerMatchId: string;
    kickoffTimeUtc: string | null;
  };
  home: FootballOddsBridgeSideView;
  away: FootballOddsBridgeSideView;
  candidateEvents: FootballOddsBridgeCandidateEvent[];
  candidateStatus: FootballOddsBridgeCandidateStatus;
  candidateMappings: FootballOddsBridgeCandidateMapping[];
  reviewStatus: FootballOddsBridgeReviewStatus;
  timingClass: FootballOddsBridgeTimingClass;
  pregameUsable: boolean;
  reasonCodes: string[];
};

export type FootballOddsBridgeIntakeCounts = {
  noCandidateNeeded: number;
  canonicalIdentityBlocked: number;
  notSupported: number;
  candidateIntakeTarget: number;
  sportKeyNotMapped: number;
  sportKeyEndpointFailed: number;
  noEventCandidate: number;
  ambiguousEventCandidates: number;
  orientationConflict: number;
  pendingReviewSingleSideAnchored: number;
  pendingReviewSingleEventUnanchored: number;
};

export type FootballOddsBridgeIntakeArtifactV1 = {
  meta: {
    schemaVersion: typeof FOOTBALL_ODDS_BRIDGE_INTAKE_V1_SCHEMA;
    builderVersion: typeof FOOTBALL_ODDS_BRIDGE_INTAKE_V1_BUILDER;
    dateKst: string;
    generatedAt: string;
    observedAt: string;
    researchOnly: true;
    legalStatus: FootballLegalStatus;
    predictionInput: false;
    engineAdmission: "PROHIBITED";
    engineConnected: false;
    sourceScheduleRel: string;
    sourceScheduleArtifactHash: string;
    oddsProvider: "THE_ODDS_API";
    providerMethod: "listEvents";
    providerCalls: number;
    uniqueSportKeysRequested: string[];
    eventsObserved: number;
    candidateRows: number;
    reviewRequired: number;
    blockedRows: number;
    kickoffToleranceMinutes: number;
    counts: FootballOddsBridgeIntakeCounts;
    artifactHash: string;
  };
  rows: FootballOddsBridgeCandidateRow[];
};
