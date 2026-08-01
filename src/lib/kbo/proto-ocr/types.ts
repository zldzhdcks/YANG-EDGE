/**
 * KBO Domestic Proto OCR-assisted draft types.
 * OCR is a Draft Generator — Source of Truth is admin-approved Operator Input.
 */

export const PROTO_OCR_PARSER_VERSION = "kbo-proto-ocr-parser-v1";

export type ProtoOcrExecutionMode = "LOCAL" | "EXTERNAL_API" | "FIXTURE";

export type ProtoOcrParserStatus =
  | "PARSED"
  | "PARTIAL"
  | "AMBIGUOUS"
  | "NOT_RECOGNIZED";

export type ProtoOcrMappingStatus =
  | "MATCHED_EXACT"
  | "MATCHED_ALIAS"
  | "AMBIGUOUS"
  | "UNKNOWN_TEAM"
  | "DIRECTION_MISMATCH"
  | "GAME_NOT_IN_SCHEDULE"
  | "DUPLICATE_CANDIDATE"
  | "CONFLICTING_CANDIDATES"
  | "UNMAPPED";

export type ProtoOcrConfidenceGrade =
  | "VERY_HIGH"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "UNKNOWN";

export type ProtoOcrConfidence = {
  textRecognitionConfidence: number | null;
  teamResolutionConfidence: number | null;
  oddsRecognitionConfidence: number | null;
  layoutAssociationConfidence: number | null;
  scheduleIdentityConfidence: number | null;
  overallConfidence: number | null;
  grade: ProtoOcrConfidenceGrade;
  reviewRequired: boolean;
  reviewReasons: string[];
};

export type ProtoOcrTextBlock = {
  blockId: string;
  text: string;
  confidence: number | null;
  bbox: { x: number; y: number; w: number; h: number } | null;
};

export type ProtoOcrImageInput = {
  imageId: string;
  bytes: Uint8Array;
  mimeType: string;
  originalFilename: string;
};

export type ProtoOcrRawImageResult = {
  imageId: string;
  imageSha256: string;
  width: number;
  height: number;
  rawText: string;
  rawConfidence: number | null;
  blocks: ProtoOcrTextBlock[];
  warnings: string[];
};

export type ProtoOcrRawResult = {
  ocrRunId: string;
  providerName: string;
  executionMode: ProtoOcrExecutionMode;
  extractedAt: string;
  images: ProtoOcrRawImageResult[];
  durationMs: number;
  warnings: string[];
  errorCode?: string;
};

export type ProtoOcrCandidate = {
  candidateId: string;
  sourceImageId: string;
  sourceBlockIds: string[];
  eventNumber: string | null;
  scheduledTimeText: string | null;
  awayTeamText: string | null;
  homeTeamText: string | null;
  screenshotFirstTeam: string | null;
  screenshotSecondTeam: string | null;
  awayPriceText: string | null;
  homePriceText: string | null;
  awayPriceCandidate: number | null;
  homePriceCandidate: number | null;
  marketLabel: string | null;
  parserStatus: ProtoOcrParserStatus;
  parserWarnings: string[];
  rawSnippet: string;
};

export type ProtoOcrCorrection = {
  field: string;
  rawValue: string | null;
  parsedValue: string | number | null;
  approvedValue: string | number | null;
  correctionReason: string;
  gameId: string | null;
};

export type ProtoOcrAdminDecision =
  | "PENDING"
  | "APPROVED"
  | "CORRECTED"
  | "REJECTED";

export type KboProtoOcrDraftRow = {
  draftRowId: string;
  ocrRunId: string;
  sourceImageIds: string[];
  rawTeamTexts: string[];
  rawPriceTexts: string[];
  screenshotFirstTeam: string | null;
  screenshotSecondTeam: string | null;
  resolvedAwayTeam: string | null;
  resolvedHomeTeam: string | null;
  gameId: string | null;
  awayTeamId: string | null;
  homeTeamId: string | null;
  awayPrice: number | null;
  homePrice: number | null;
  mappingStatus: ProtoOcrMappingStatus;
  parserStatus: ProtoOcrParserStatus;
  confidence: ProtoOcrConfidence;
  warnings: string[];
  errors: string[];
  adminDecision: ProtoOcrAdminDecision;
  adminCorrections: ProtoOcrCorrection[];
  displayOrder: "SCREENSHOT" | "CANONICAL";
};

export type ProtoOcrExtractResponse = {
  ok: boolean;
  ocrRunId: string;
  dateKst: string;
  engineStatus: "READY" | "OCR_ENGINE_NOT_CONFIGURED" | "FIXTURE";
  executionMode: ProtoOcrExecutionMode;
  externalImageTransfer: boolean;
  rows: KboProtoOcrDraftRow[];
  unmatchedBlocks: string[];
  warnings: string[];
  durationMs: number;
  imageFingerprints: string[];
  mutationPerformed: false;
  errorCode?: string;
  message?: string;
};

export type ProtoOcrValidateResponse = {
  ok: boolean;
  dateKst: string;
  rows: KboProtoOcrDraftRow[];
  globalErrors: string[];
  mutationPerformed: false;
  errorCode?: string;
};

export type ProtoOcrApproveResponse = {
  ok: boolean;
  dateKst: string;
  pathRel: string | null;
  previousHash: string | null;
  nextHash: string | null;
  version: number;
  approvedGameIds: string[];
  auditPathRel: string | null;
  mutationPerformed: boolean;
  t45AutoRun: false;
  t30AutoRun: false;
  message: string;
  errorCode?: string;
  validation?: ProtoOcrValidateResponse;
};
