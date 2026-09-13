export const DOMESTIC_ODDS_OCR_EXTRACTION_V2_SCHEMA =
  "yang-edge-domestic-odds-ocr-extraction-v2" as const;
export const V2_TIMEZONE = "Asia/Seoul" as const;
export const ROUND_IDENTITY_UNCERTAIN = "ROUND_IDENTITY_UNCERTAIN" as const;

export const V1_GEOMETRY_REL =
  "data/audits/2026-09-13-domestic-odds-ocr-geometry-v1.json" as const;
export const V1_STRUCTURED_REL =
  "data/audits/2026-09-13-domestic-odds-structured-v1.json" as const;

export type OcrFailureFamilyV2 =
  | "DECIMAL_SEPARATOR_DROPPED"
  | "DECIMAL_SEPARATOR_REPLACED"
  | "DIGIT_MERGED"
  | "TEAM_TEXT_PARTIAL"
  | "ROW_BOUNDARY_ERROR"
  | "DATE_PARSE_FAILURE"
  | "TIME_TEXT_CONFUSION"
  | "UNKNOWN";

export type OddsVerificationStatusV2 =
  | "ODDS_VERIFIED"
  | "ODDS_CANDIDATE_UNVERIFIED"
  | "ODDS_UNREADABLE";

export type TeamTextStatusV2 =
  | "TEAM_TEXT_VERIFIED"
  | "TEAM_TEXT_PARTIAL"
  | "TEAM_TEXT_UNREADABLE";

export type ColumnNameV2 = "BOARD" | "DATE" | "TEAM" | "ODDS" | "STATUS";

export type PixelBoxV2 = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrPassNameV2 = "BASELINE_V1" | "KO_SCALE3_CROP" | "KO_SCALE3_GRAY";

export type OcrPassEvidenceV2 = {
  pass: OcrPassNameV2;
  rawText: string;
};

export type OddsFieldV2 = {
  rawText: string | null;
  normalizedCandidate: number | null;
  verificationEvidence: {
    passes: OcrPassEvidenceV2[];
    agreeingDigitSequence: string | null;
    splitDetectedInCell: boolean;
    punctuationEvidence: boolean;
    independentPassCount: number;
  };
  verificationStatus: OddsVerificationStatusV2;
};

export type TeamFieldV2 = {
  rawText: string | null;
  status: TeamTextStatusV2;
  aliasCandidate: string | null;
  passes: OcrPassEvidenceV2[];
};
