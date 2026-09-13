export const DOMESTIC_ODDS_PROMOTION_SCHEMA =
  "yang-edge-domestic-odds-promotion-v1" as const;
export const DOMESTIC_ODDS_PROMOTION_TIMEZONE = "Asia/Seoul" as const;

export const ROUND_IDENTITY_UNCERTAIN = "ROUND_IDENTITY_UNCERTAIN" as const;

export type JoinStatusV1 =
  | "SCHEDULE_MATCHED"
  | "TEAM_ALIAS_MATCHED_NO_SCHEDULE"
  | "IDENTITY_REVIEW_REQUIRED"
  | "COMPETITION_REVIEW_REQUIRED"
  | "SOURCE_UNREADABLE"
  | "EXCLUDED_NON_TARGET_DATE";

export type ExtractionStatusV1 =
  | "PARSED"
  | "SOURCE_UNREADABLE"
  | "INSUFFICIENT_EVIDENCE";

export type StructuredOddsRowV1 = {
  operatingDateKst: string;
  claimedRound: number | null;
  roundIdentityStatus: typeof ROUND_IDENTITY_UNCERTAIN;
  sourceType: "MANUAL_SCREENSHOT";
  sourceFile: string;
  sourceSha256: string;
  boardGameNumber: string | null;
  competitionRawLabel: string | null;
  homeRawName: string | null;
  awayRawName: string | null;
  marketRaw: string | null;
  rawOddsText: string | null;
  parsedOddsValues: number[] | null;
  extractionStatus: ExtractionStatusV1;
  extractionConfidence: "HIGH" | "LOW" | "NONE";
  targetDateKst: string | null;
  displayedStartKst: string | null;
  screenVisibleStatusLabel: string | null;
  fileMtimeUtc: string | null;
  filenameTimestampCandidateKst: string | null;
  filenameTimestampCandidateUtc: string | null;
  operatorObservedAtUtc: string;
  verifiedCaptureTime: null;
  verifiedProviderTime: null;
  sourceProvenance: "WINDOWS_MEDIA_OCR_LOCAL" | "OCR_UNAVAILABLE";
  canonicalFixtureId: string | null;
  joinStatus: JoinStatusV1;
  predictionInputAllowed: false;
  rejectionReason: string[];
};

export type OcrGeometryLineV1 = {
  text: string;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
};
