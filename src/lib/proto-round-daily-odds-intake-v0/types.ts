/**
 * Isolated daily odds screenshot intake audit v0.
 *
 * Inventories newly added proto-round screenshots as operational evidence.
 * Does not run OCR. Does not feed Discovery-2, Validation-2, or Holdout.
 */

export const DAILY_ODDS_INTAKE_SCHEMA_VERSION =
  "proto-round-daily-odds-intake-v0" as const;
export const DAILY_ODDS_INTAKE_LOCAL_DIR_NAME = "daily-odds-intake" as const;
export const DAILY_ODDS_INTAKE_PURPOSE = "NEW_DAILY_ODDS_EVIDENCE" as const;
export const DAILY_ODDS_INTAKE_TIMEZONE = "Asia/Seoul" as const;

export type DailyOddsImageV0 = {
  sourceFileName: string;
  sourceImageSha256: string;
  relativePath: string;
};

export type DailyOddsScanSummaryV0 = {
  physical: number;
  canonical: number;
  duplicates: number;
  unsupported: number;
  eligible: number;
  previousCanonicalImageCount: number;
  canonicalImageDelta: number;
};

export type DailyOddsIntakeSealV0 = {
  schemaVersion: typeof DAILY_ODDS_INTAKE_SCHEMA_VERSION;
  purpose: typeof DAILY_ODDS_INTAKE_PURPOSE;
  capturedInventoryDate: string;
  year: number;
  round: number;
  roundLabel: string;
  protoRoundKey: string;
  USED_FOR_OCR_RULE_DESIGN: false;
  USED_FOR_DISCOVERY2_TRUTH: false;
  USED_FOR_VALIDATION2: false;
  USED_FOR_HOLDOUT: false;
  OCR_RUN: false;
  NETWORK_CALLS: 0;
  scanSummary: DailyOddsScanSummaryV0;
  images: DailyOddsImageV0[];
};

export type DailyOddsInventoryHitV0 = {
  year: number;
  round: number;
  roundLabel: string;
  roundAbs: string;
  sourceFileName: string;
  relativePath: string;
  absPath: string;
};
