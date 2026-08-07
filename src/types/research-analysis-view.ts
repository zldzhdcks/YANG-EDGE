/**
 * Research Analysis Viewer v1 — view model (read-only display).
 * Values come from artifacts only; missing → Not Collected / Awaiting Research.
 */

export type FieldAvailability = "COLLECTED" | "NOT_COLLECTED" | "AWAITING_RESEARCH";

export type ResearchField<T> = {
  availability: FieldAvailability;
  value: T | null;
  label: string;
};

export type SuccessReviewValue = {
  primary: string | null;
  secondary: string[];
  note: string | null;
  match: string | null;
};

export type FailureReviewValue = {
  primary: string | null;
  secondary: string[];
  starterVerdict: string | null;
  bullpenVerdict: string | null;
  match: string | null;
  /** True when artifact exists but structured cause fields are empty */
  noClassifiedCause: boolean;
};

export type LearningSummaryValue = {
  feedbackClassification: string | null;
  predictionHit: boolean | null;
  reviewNotes: string[];
  /** Display-mapped hypotheses (original artifact strings remapped for UI only). */
  hypotheses: string[];
  homeScore: number | null;
  awayScore: number | null;
  /** Review hypotheses reflect prediction-time factors, not current datasets. */
  predictionTimeBasisNote: string;
};

export type ActualLineupBatter = {
  slot: number;
  playerName: string;
  defensivePosition: string | null;
  isDh: boolean;
};

export type ActualLineupSide = {
  teamName: string | null;
  lineupStatus: string | null;
  batters: ActualLineupBatter[];
};

export type ActualLineupValue = {
  /** Always post-game actual; never Engine input. */
  notice: string;
  preGameStatusLabel: string;
  home: ActualLineupSide | null;
  away: ActualLineupSide | null;
};

export type ConfirmedLineupValue = {
  reviewStatus: string;
  home: ActualLineupSide | null;
  away: ActualLineupSide | null;
};

export type StarterMetricsAtPrediction =
  | "INCLUDED"
  | "MISSING_DETAIL"
  | "UNKNOWN";

export type ResearchAnalysisView = {
  version: "research-analysis-viewer-v1";
  gameId: string;
  researchStatus: "COLLECTED" | "PARTIAL" | "AWAITING_RESEARCH";
  /** Short definition aligned with artifact presence. */
  researchStatusNote: string;
  sampleNotice: string;
  /** graded 등 종료 경기가 아니면 Review 카드 비표시 */
  isFinishedGame: boolean;
  gameInfo: {
    availability: FieldAvailability;
    league: string | null;
    homeTeam: string | null;
    awayTeam: string | null;
    dateKst: string | null;
    startTimeKst: string | null;
    matchLabel: string;
  };
  prediction: ResearchField<string>;
  /**
   * Official Prediction Snapshot view model (PASS / ELIGIBLE / BLOCKED).
   * Separate from Engine live recompute and researchBaseline observation.
   */
  researchPrediction: {
    artifactAvailable: boolean;
    loadReason: string;
    debugStatus:
      | "PASS"
      | "AVAILABLE"
      | "BLOCKED"
      | "FAIL"
      | "NOT_CREATED"
      | "WAITING";
    debugLabel: string;
    officialStatus: "ELIGIBLE" | "PASS" | "BLOCKED" | "UNKNOWN";
    officialPick: "HOME" | "AWAY" | "DRAW" | null;
    passReasons: string[];
    missingInputs: string[];
    inputWarnings: string[];
    predictedAt: string | null;
    lockedAt: string | null;
    engineVersion: string | null;
    predictionHash: string | null;
    pathRel: string | null;
    runId: string | null;
    researchBaseline: {
      available: boolean;
      researchOnly: boolean;
      pick: string | null;
      confidence: number | null;
    } | null;
  };
  /** KBO Unified Operational State — shared with Research Lab (null for non-KBO). */
  kboOperational: {
    overallStatus: string;
    readinessPercent: number;
    schedule: { status: string; sourcePath: string | null; sourceType: string };
    domesticOdds: {
      status: string;
      sourcePath: string | null;
      sourceType: string;
    };
    overseasOdds: {
      status: string;
      sourcePath: string | null;
      sourceType: string;
    };
    starter: { status: string; sourcePath: string | null; sourceType: string };
    lineup: { status: string; sourcePath: string | null; sourceType: string };
    prediction: {
      status: string;
      sourcePath: string | null;
      sourceType: string;
    };
    review: { status: string; sourcePath: string | null; sourceType: string };
  } | null;
  /** Read-only summary of existing Starter + Bullpen artifact fields (no new scores). */
  pitchingSnapshot: ResearchField<{
    starterStatus: string | null;
    bullpenStatus: string | null;
    starterDataAvailable: FieldAvailability;
    bullpenDataAvailable: FieldAvailability;
    starterIdentityAvailable: FieldAvailability;
    starterMetricsAtPrediction: StarterMetricsAtPrediction;
    starterMetricsLabel: string;
    researchCompleteness: string;
  }>;
  probability: ResearchField<number>;
  confidence: ResearchField<number>;
  edgeScore: ResearchField<number>;
  valueEdge: ResearchField<number>;
  startingPitchers: ResearchField<{
    home: { name: string | null; status: string | null };
    away: { name: string | null; status: string | null };
    identityAvailable: FieldAvailability;
    metricsAtPrediction: StarterMetricsAtPrediction;
    metricsLabel: string;
  }>;
  bullpenStatus: ResearchField<{
    overallRoleComparison: string | null;
    pickTeam: string | null;
    oppTeam: string | null;
  }>;
  marketOdds: ResearchField<{
    openingOdds: number | null;
    latestOdds: number | null;
    oddsMovement: string | null;
    marketProbability: number | null;
  }>;
  snapshotGeneratedAt: ResearchField<string>;
  predictionHash: ResearchField<string>;
  confirmedLineup: ResearchField<ConfirmedLineupValue> | null;
  /** Finished games only — omit from UI when null */
  successReview: ResearchField<SuccessReviewValue> | null;
  failureReview: ResearchField<FailureReviewValue> | null;
  learningSummary: ResearchField<LearningSummaryValue> | null;
  /**
   * Finished games only. Post-game actual starting lineup (research label).
   * Null for pre-game / unfinished — must not display actual lineup.
   */
  actualLineup: ResearchField<ActualLineupValue> | null;
  researchScore: {
    total: number;
    max: number;
    items: {
      label: string;
      score: number;
      max: number;
      status: "OK" | "MISSING" | "PASS_RECORDED" | "BLOCKED" | "NOT_ELIGIBLE";
    }[];
    overallLabel:
      | "READY"
      | "PARTIAL"
      | "BLOCKED"
      | "UNKNOWN"
      | "PARTIAL_READY"
      | "WAITING_FOR_PREDICTION"
      | "WAITING_FOR_LINEUP"
      | "NOT_APPLICABLE";
  };
  oddsComparison: {
    available: boolean;
    domesticHome: number | null;
    domesticAway: number | null;
    overseasHome: number | null;
    overseasAway: number | null;
    diffHome: number | null;
    diffAway: number | null;
    homeTeamName: string | null;
    awayTeamName: string | null;
    domesticSourceLabel: string | null;
    overseasSourceLabel: string | null;
    domesticPass: boolean;
    overseasPass: boolean;
    frozenLabel: string;
  };
  dataFreshness: { label: string; updatedAt: string | null }[];
  timeline: { time: string; event: string }[];
  sources: {
    predictionPath: string | null;
    starterPath: string | null;
    bullpenPath: string | null;
    lineupPath: string | null;
    reviewPath: string | null;
    successFlowPath: string | null;
    failureFlowPath: string | null;
    oddsPath: string | null;
    schedulePath: string | null;
  };
};
