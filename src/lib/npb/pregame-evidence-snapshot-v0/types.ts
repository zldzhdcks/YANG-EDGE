/**
 * NPB Pregame Evidence Snapshot v0
 * Freezes schedule + MANUAL starter + MANUAL moneyline. No engine picks.
 */

export const NPB_PREGAME_EVIDENCE_SNAPSHOT_KIND =
  "PREGAME_EVIDENCE" as const;

/** Reuses prediction path; kind distinguishes evidence vs model prediction. */
export const NPB_PREDICTION_SNAPSHOT_SCHEMA =
  "npb-prediction-snapshot-v1" as const;

export type NpbEvidenceGameStatus =
  | "PASS"
  | "NO_ENGINE_AVAILABLE"
  | "BLOCKED_AFTER_START";

export type NpbEvidenceSnapshotStatus =
  | "PRE_GAME_SNAPSHOT_VERIFIED"
  | "PARTIAL_BLOCKED_AFTER_START"
  | "BLOCKED_AFTER_START"
  | "ALREADY_FROZEN"
  | "MISSING_INPUTS"
  | "FAILED";

export type NpbEvidenceStarterSide = {
  displayName: string | null;
  originalName: string | null;
  normalizedName: string | null;
  sourceType: "MANUAL_VERIFIED" | null;
  verifiedAt: string | null;
  verificationStatus: "CONFIRMED" | null;
};

export type NpbEvidenceMarketSide = {
  awayOdds: number | null;
  homeOdds: number | null;
  sourceType: "MANUAL_VERIFIED" | null;
  verifiedAt: string | null;
  /** Presentation only — not model probability. */
  awayImpliedProbability: number | null;
  homeImpliedProbability: number | null;
};

export type NpbEvidenceGameV0 = {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  firstPitchAt: string | null;
  matchup: string;
  starter: {
    away: NpbEvidenceStarterSide;
    home: NpbEvidenceStarterSide;
    sourceType: "MANUAL_VERIFIED" | null;
    verifiedAt: string | null;
  };
  market: NpbEvidenceMarketSide;
  lineup: {
    status: "NOT_RELEASED" | "MISSING";
  };
  prediction: {
    officialPick: null;
    researchPick: null;
    modelProbability: null;
    confidence: null;
  };
  status: NpbEvidenceGameStatus;
  officialStatus: "PASS" | "BLOCKED";
  officialPick: null;
  researchPick: null;
  modelProbability: null;
  confidence: null;
  marketProbability: null;
  warnings: string[];
  passReasons: string[];
  blockReasons: string[];
  generatedBeforeGame: boolean | null;
  snapshotCreatedAt: string;
};

export type NpbPregameEvidenceSnapshotV0 = {
  schemaVersion: typeof NPB_PREDICTION_SNAPSHOT_SCHEMA;
  snapshotKind: typeof NPB_PREGAME_EVIDENCE_SNAPSHOT_KIND;
  sport: "baseball";
  league: "NPB";
  date: string;
  dateKst: string;
  runId: string;
  snapshotCreatedAt: string;
  predictedAt: string;
  enginePolicy: "NO_ENGINE_AVAILABLE";
  evidenceNote: string;
  snapshotStatus: NpbEvidenceSnapshotStatus;
  generatedBeforeGameCount: number;
  blockedAfterStartCount: number;
  summary: {
    total: number;
    scheduleReady: number;
    starterConfirmed: number;
    marketVerified: number;
    lineupReleased: number;
    PASS: number;
    NO_ENGINE_AVAILABLE: number;
    BLOCKED: number;
  };
  games: NpbEvidenceGameV0[];
  predictionHashSha256: string;
  inputs: {
    schedulePath: string;
    starterPath: string;
    marketOddsPath: string;
  };
};

export type NpbPregameEvidenceFreezeResult = {
  wrote: boolean;
  pathRel: string;
  document: NpbPregameEvidenceSnapshotV0 | null;
  errors: string[];
  snapshotStatus: NpbEvidenceSnapshotStatus;
};
