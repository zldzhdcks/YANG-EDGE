import { DailyOddsIntakeV0Error } from "./error";
import {
  DAILY_ODDS_INTAKE_PURPOSE,
  DAILY_ODDS_INTAKE_SCHEMA_VERSION,
  type DailyOddsImageV0,
  type DailyOddsIntakeSealV0,
  type DailyOddsScanSummaryV0,
} from "./types";
import { assertInventoryDate } from "./inventory";

export function newCanonicalImages(input: {
  currentCanonical: DailyOddsImageV0[];
  previousCanonicalSha256: ReadonlySet<string>;
}): DailyOddsImageV0[] {
  const seen = new Set<string>();
  const out: DailyOddsImageV0[] = [];
  for (const image of input.currentCanonical) {
    if (input.previousCanonicalSha256.has(image.sourceImageSha256)) continue;
    if (seen.has(image.sourceImageSha256)) {
      throw new DailyOddsIntakeV0Error("DUPLICATE_CANONICAL_SHA256");
    }
    seen.add(image.sourceImageSha256);
    out.push({
      sourceFileName: image.sourceFileName,
      sourceImageSha256: image.sourceImageSha256,
      relativePath: image.relativePath,
    });
  }
  return out;
}

export function buildDailyOddsIntakeSealV0(input: {
  capturedInventoryDate: string;
  year: number;
  round: number;
  roundLabel: string;
  protoRoundKey: string;
  scanSummary: DailyOddsScanSummaryV0;
  images: DailyOddsImageV0[];
}): DailyOddsIntakeSealV0 {
  return {
    schemaVersion: DAILY_ODDS_INTAKE_SCHEMA_VERSION,
    purpose: DAILY_ODDS_INTAKE_PURPOSE,
    capturedInventoryDate: assertInventoryDate(input.capturedInventoryDate),
    year: input.year,
    round: input.round,
    roundLabel: input.roundLabel,
    protoRoundKey: input.protoRoundKey,
    USED_FOR_OCR_RULE_DESIGN: false,
    USED_FOR_DISCOVERY2_TRUTH: false,
    USED_FOR_VALIDATION2: false,
    USED_FOR_HOLDOUT: false,
    OCR_RUN: false,
    NETWORK_CALLS: 0,
    scanSummary: { ...input.scanSummary },
    images: input.images.map((image) => ({
      sourceFileName: image.sourceFileName,
      sourceImageSha256: image.sourceImageSha256,
      relativePath: image.relativePath,
    })),
  };
}
