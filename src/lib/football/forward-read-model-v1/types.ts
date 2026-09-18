import type { OutcomeClass } from "./constants";

export type ForwardIdentityStatus = "RESOLVED" | "UNRESOLVED";

export type ResolvedFixtureIdentity = {
  fixtureId: number;
  league: string;
  homeTeam: string;
  awayTeam: string;
};

export type ForwardHypothesisObservation = {
  flag: string;
  HYPOTHESIS_ONLY: true;
  detail: string;
};

export type ForwardGradedEventProvenance = {
  snapshotHash: string;
  receiptHash: string;
  gradeHash: string;
  validPregame: boolean;
  sealedBeforeKickoff: boolean;
  predictionCreatedBeforeKickoff: boolean;
  oddsUsed: boolean;
  marketUsed: boolean;
  providerPredictionUsed: boolean;
  targetResultDataUsed: boolean;
};

export type ForwardGradedEvent = {
  fixtureId: number;
  identityStatus: ForwardIdentityStatus;
  league: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  kickoffUtc: string;
  predictionCreatedAt: string;
  sealedAt: string;
  modelVersion: string;
  modelSourceHash: string;
  probabilities: {
    home: number;
    draw: number;
    away: number;
  };
  predictedClass: OutcomeClass;
  actualClass: OutcomeClass;
  correct: boolean;
  probabilityBucket: string;
  provenance: ForwardGradedEventProvenance;
};

export type FootballForwardEvidenceReadModel = {
  schemaVersion: "FOOTBALL_FORWARD_EVIDENCE_READ_MODEL_V1";
  generatedFrom: string;
  evaluatedAt: string;
  model: {
    version: string;
    sourceHash: string;
    researchOnly: true;
    calibrated: false;
    officialPick: null;
  };
  sample: {
    totalPredicted: number;
    totalGraded: number;
    pendingPredicted: number;
    correct: number;
    wrong: number;
    accuracy: number;
    pass: number;
    pendingPass: number;
    integrityExclusions: number;
    sampleInsufficient: boolean;
  };
  checkpoint: {
    currentN: number;
    targetN: number;
    remaining: number;
    reached: boolean;
    engineChangeAllowed: boolean;
  };
  integrity: {
    oddsRole: "OBSERVATION_ONLY";
    oddsUsed: boolean;
    marketUsed: boolean;
    providerPredictionUsed: boolean;
    targetResultDataUsed: boolean;
    postgameDataUsedInPrediction: boolean;
    integrityExclusions: number;
  };
  hypotheses: ForwardHypothesisObservation[];
  gradedEvents: ForwardGradedEvent[];
};

export type LoadForwardReadModelInput = {
  rootDir?: string;
  evalRel?: string;
  /** Injected eval envelope or payload. When set, the committed file is not read. */
  document?: unknown;
  /**
   * Optional identity join. `undefined` loads committed schedule + postgame
   * review artifacts. An empty map leaves every event UNRESOLVED.
   */
  identityIndex?: ReadonlyMap<number, ResolvedFixtureIdentity>;
};
