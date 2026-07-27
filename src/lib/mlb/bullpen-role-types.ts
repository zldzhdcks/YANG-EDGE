/**
 * MLB Bullpen Role Dataset — 타입 (v1.1 필드 포함).
 * 연구 전용. EDGE Engine / weights / UI 미연결.
 */
export type BullpenRole =
  | "CLOSER"
  | "SETUP"
  | "HIGH_LEVERAGE_RELIEF"
  | "MIDDLE_RELIEF"
  | "LONG_RELIEF"
  | "OPENER"
  | "MOP_UP"
  | "UNKNOWN";

export type RoleConfidence = "high" | "medium" | "low";

export type ClassificationStatus =
  | "INSUFFICIENT_SAMPLE"
  | "PROVISIONAL"
  | "CLASSIFIED";

export type OverallRoleComparison =
  | "ROLE_STRUCTURE_SUPPORTS_BASELINE"
  | "ROLE_STRUCTURE_CONFLICTS_BASELINE"
  | "ROLE_STRUCTURE_NEUTRAL"
  | "ROLE_STRUCTURE_INSUFFICIENT";

export type RoleRiskFlag =
  | "CLOSER_USED_PREVIOUS_DAY"
  | "CLOSER_BACK_TO_BACK"
  | "CLOSER_THIRD_DAY_RISK"
  | "CLOSER_STATUS_UNKNOWN"
  | "SETUP_CORE_HEAVY_USAGE"
  | "SETUP_CORE_BACK_TO_BACK"
  | "HIGH_LEVERAGE_GROUP_FATIGUED"
  | "MIDDLE_RELIEF_THIN"
  | "LONG_RELIEF_UNAVAILABLE"
  | "MULTIPLE_KEY_RELIEVERS_USED_PREVIOUS_DAY"
  | "ROLE_CLASSIFICATION_LOW_CONFIDENCE"
  | "DATA_UNAVAILABLE";

export type HypothesisStatus =
  | "UNTESTED"
  | "COLLECTING"
  | "PROMISING"
  | "WEAK"
  | "REJECTED"
  | "READY_FOR_BACKTEST";

export type RestBucketKey = "0" | "1" | "2" | "3" | "4plus";

export type BullpenAppearanceDerived = {
  playerId: number;
  playerName: string | null;
  teamId: number;
  gamePk: number;
  officialDate: string;
  gameDate: string;
  pitcherSlotIndex: number;
  outs: number;
  earnedRuns: number;
  hits: number;
  walks: number;
  strikeouts: number;
  homeRuns: number;
  pitches: number | null;
  battersFaced: number | null;
  saves: number;
  holds: number;
  blownSaves: number;
  wasLastPitcher: boolean;
  entryInning: number | null;
  entryScoreDiff: number | null;
  fromTargetGame: false;
};

export type RoleEvidence = {
  savesLast30: number;
  holdsLast30: number;
  /** 역할 feature에 사용된 appearance 수 (traditional starter 제외) */
  appearancesLast30: number;
  reliefAppearances: number;
  openerAppearances: number;
  traditionalStarterExcluded: number;
  finishRate: number | null;
  saveRate: number | null;
  holdRate: number | null;
  /** relief-only avg outs (traditional starter·선택적 opener 제외 정책 적용) */
  avgOuts: number | null;
  medianOuts: number | null;
  multiInningRate: number | null;
  earlyEntryRate: number | null;
  middleEntryRate: number | null;
  lateCloseEntryRate: number | null;
  setupInningCloseRate: number | null;
  highLeverageRate: number | null;
  mopUpRate: number | null;
  starterShortOutingRate: number | null;
  notes: string[];
};

export type RestBucketStats = {
  bucket: RestBucketKey;
  appearances: number;
  era: number | null;
  whip: number | null;
  runsAllowed: number;
  walks: number;
  strikeouts: number;
  homeRunsAllowed: number;
  sampleThin: boolean;
};

export type PitcherFatigueSnapshot = {
  daysSinceLastAppearance: number | null;
  appearancesLast2Days: number;
  appearancesLast3Days: number;
  appearancesLast5Days: number;
  consecutiveDaysPitched: number;
  pitchesPreviousDay: number | null;
  pitchesLast2Days: number | null;
  pitchesLast3Days: number | null;
  inningsLast3Days: number | null;
  battersFacedLast3Days: number | null;
  restDaysBeforeGame: number | null;
  usedPreviousDay: boolean;
  usedBackToBack: boolean;
  possibleThirdConsecutiveDay: boolean;
};

export type ClassifiedBullpenPitcher = {
  playerId: number;
  playerName: string | null;
  teamId: number;
  teamName: string;
  cutoffTime: string;
  /** v1.1 */
  primaryRole: BullpenRole;
  secondaryRoles: BullpenRole[];
  roleScores: Partial<Record<BullpenRole, number>>;
  classificationStatus: ClassificationStatus;
  /** v1 호환 alias = primaryRole */
  inferredRole: BullpenRole;
  confidence: RoleConfidence;
  evidence: RoleEvidence;
  sampleSize: number;
  starterAppearancesExcluded: number;
  warnings: string[];
  fatigue: PitcherFatigueSnapshot;
  restBuckets: RestBucketStats[];
  engineEligible: false;
};

export type RoleGroupSnapshot = {
  role: BullpenRole;
  playerIds: number[];
  availableCount: number;
  usedPreviousDayCount: number;
  backToBackCount: number;
  possibleThirdDayCount: number;
  pitchesLast3Days: number | null;
  inningsLast3Days: number | null;
  avgRestDays: number | null;
  unavailableOrHighRiskCount: number;
  availabilityUnknown: true;
};

export type TeamBullpenRoleSnapshot = {
  teamId: number;
  teamName: string;
  cutoffTime: string;
  closerCandidate: ClassifiedBullpenPitcher | null;
  setupCandidates: ClassifiedBullpenPitcher[];
  highLeverageCandidates: ClassifiedBullpenPitcher[];
  middleReliefCandidates: ClassifiedBullpenPitcher[];
  longReliefCandidates: ClassifiedBullpenPitcher[];
  openerCandidates: ClassifiedBullpenPitcher[];
  mopUpCandidates: ClassifiedBullpenPitcher[];
  unknownRelievers: ClassifiedBullpenPitcher[];
  groups: RoleGroupSnapshot[];
  roleFlags: RoleRiskFlag[];
  thresholdsUsed: Record<string, { median: number | null; p75: number | null }>;
};

export type SideRoleCompare = {
  pickRiskFlags: RoleRiskFlag[];
  oppRiskFlags: RoleRiskFlag[];
  pickKeyFatigueCount: number;
  oppKeyFatigueCount: number;
  note: string;
};

export type GameBullpenRoleCompare = {
  gameId: string;
  match: string;
  baselinePick: string;
  pickSide: "home" | "away";
  cutoffTime: string;
  pick: TeamBullpenRoleSnapshot;
  opp: TeamBullpenRoleSnapshot;
  closerCompare: SideRoleCompare;
  setupCompare: SideRoleCompare;
  highLeverageCompare: SideRoleCompare;
  middleLongCompare: SideRoleCompare;
  overallRoleComparison: OverallRoleComparison;
  postGame?: {
    outcome: "HIT" | "MISS";
    bullpenVerdict: string | null;
    actualProtected: boolean;
    actualCollapse: boolean;
  };
};

export type BullpenHypothesis = {
  hypothesisId: string;
  description: string;
  requiredFields: string[];
  sampleCount: number;
  supportingCount: number;
  contradictingCount: number;
  inconclusiveCount: number;
  currentStatus: HypothesisStatus;
  minimumSampleTarget: number;
  autoApply: false;
  lastEvaluatedAt: string | null;
  notes?: string[];
};

export type DerivedCacheMeta = {
  schemaVersion: string;
  classifierVersion: string;
  generatedAt: string;
  dataThroughDate: string;
  source: "INTERNAL_RESEARCH_ONLY";
  inputHash: string;
  recordCount: number;
};
