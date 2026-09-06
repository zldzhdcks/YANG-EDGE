import type { PhysicalFileRecordV1 } from "../proto-round-screenshot-intake-v1/types";
import { sha256FileBytes } from "../proto-round-screenshot-intake-v1/hash";
import { parseScreenshotFilenameTimestamp } from "../proto-round-extraction-design-v0/filename-timestamp";
import { CAPTURE_SEQUENCE_RULE, CROSS_IMAGE_ROW_AUTO_DEDUPE } from "../proto-round-extraction-design-v0/types";
import { isAutoMergeEligible } from "./auto-merge";
import { ManifestPathEscapeError, resolveContainedCanonicalImageAbs } from "./path-containment";
import type {
  ProtoRoundLocalOcrLine,
  ProtoRoundLocalOcrProvider,
  RawOcrDocumentV0,
  RawOcrImageRecordV0,
  RawOcrStatus,
} from "./types";
import {
  OCR_ACCURACY_PERCENT,
  OCR_LINE_ORDER_USED_AS_ROW_STRUCTURE,
  RAW_OCR_SCHEMA_VERSION,
} from "./types";

export function selectCanonicalExtractionRows(
  files: PhysicalFileRecordV1[],
): PhysicalFileRecordV1[] {
  return files.filter(
    (f) => f.fileStatus === "CANONICAL_IMAGE" && f.extractionEligible === true,
  );
}

export function nonWhitespaceCharacterCount(text: string): number {
  return Array.from(text).filter((ch) => !/\s/u.test(ch)).length;
}

export function classifyOcrStatus(rawText: string): Exclude<RawOcrStatus, "OCR_ERROR"> {
  return nonWhitespaceCharacterCount(rawText) === 0 ? "OCR_EMPTY" : "OCR_OK";
}

export function previewNonEmptyRawLines(
  rawLines: ProtoRoundLocalOcrLine[] | null,
  max = 8,
): string[] {
  if (!rawLines) return [];
  const out: string[] = [];
  for (const line of rawLines) {
    if (line.text.trim() === "") continue;
    out.push(line.text);
    if (out.length >= max) break;
  }
  return out;
}

function errorRecord(input: {
  row: PhysicalFileRecordV1;
  year: number;
  round: number;
  protoRoundKey: string;
  provider: ProtoRoundLocalOcrProvider;
  errorCode: string;
}): RawOcrImageRecordV0 {
  const ts = parseScreenshotFilenameTimestamp(input.row.fileName);
  return {
    sourceImageSha256: input.row.sha256,
    sourceFileName: input.row.fileName,
    protoRoundKey: input.protoRoundKey,
    year: input.year,
    round: input.round,
    filenameTimestampCandidateKst: ts.filenameTimestampCandidateKst,
    filenameTimestampCandidateUtc: ts.filenameTimestampCandidateUtc,
    filenameTimestampParseStatus: ts.filenameTimestampParseStatus,
    candidateProvenance: ts.candidateProvenance,
    acceptedObservationTime: null,
    observationTimeProvenance: null,
    ocrProvider: input.provider.providerKind,
    ocrLanguage: input.provider.languages,
    ocrStatus: "OCR_ERROR",
    rawText: null,
    rawLines: null,
    lineCount: 0,
    nonWhitespaceCharacterCount: 0,
    AUTO_MERGE_ELIGIBLE: isAutoMergeEligible(null),
    errorCode: input.errorCode,
  };
}

export async function extractRawOcrV0(input: {
  year: number;
  round: number;
  protoRoundKey: string;
  roundAbs: string;
  files: PhysicalFileRecordV1[];
  provider: ProtoRoundLocalOcrProvider;
}): Promise<RawOcrDocumentV0> {
  const rows = selectCanonicalExtractionRows(input.files);
  const images: RawOcrImageRecordV0[] = [];

  for (const row of rows) {
    let abs: string;
    try {
      abs = resolveContainedCanonicalImageAbs(input.roundAbs, row.relativePath);
    } catch (err) {
      if (err instanceof ManifestPathEscapeError) throw err;
      throw new ManifestPathEscapeError(row.relativePath);
    }

    let sha: string;
    try {
      sha = await sha256FileBytes(abs);
    } catch {
      images.push(
        errorRecord({
          row,
          year: input.year,
          round: input.round,
          protoRoundKey: input.protoRoundKey,
          provider: input.provider,
          errorCode: "IMAGE_READ_ERROR",
        }),
      );
      continue;
    }
    if (sha !== row.sha256) {
      images.push(
        errorRecord({
          row,
          year: input.year,
          round: input.round,
          protoRoundKey: input.protoRoundKey,
          provider: input.provider,
          errorCode: "HASH_MISMATCH",
        }),
      );
      continue;
    }

    const ts = parseScreenshotFilenameTimestamp(row.fileName);
    try {
      const ocr = await input.provider.extract(abs);
      const rawText = ocr.rawText;
      const rawLines = ocr.rawLines;
      images.push({
        sourceImageSha256: sha,
        sourceFileName: row.fileName,
        protoRoundKey: input.protoRoundKey,
        year: input.year,
        round: input.round,
        filenameTimestampCandidateKst: ts.filenameTimestampCandidateKst,
        filenameTimestampCandidateUtc: ts.filenameTimestampCandidateUtc,
        filenameTimestampParseStatus: ts.filenameTimestampParseStatus,
        candidateProvenance: ts.candidateProvenance,
        acceptedObservationTime: null,
        observationTimeProvenance: null,
        ocrProvider: input.provider.providerKind,
        ocrLanguage: input.provider.languages,
        ocrStatus: classifyOcrStatus(rawText),
        rawText,
        rawLines,
        lineCount: rawLines.length,
        nonWhitespaceCharacterCount: nonWhitespaceCharacterCount(rawText),
        AUTO_MERGE_ELIGIBLE: isAutoMergeEligible(null),
        errorCode: null,
      });
    } catch {
      images.push(
        errorRecord({
          row,
          year: input.year,
          round: input.round,
          protoRoundKey: input.protoRoundKey,
          provider: input.provider,
          errorCode: "OCR_PROVIDER_ERROR",
        }),
      );
    }
  }

  return {
    meta: {
      schemaVersion: RAW_OCR_SCHEMA_VERSION,
      protoRoundKey: input.protoRoundKey,
      year: input.year,
      round: input.round,
      sourceCanonicalImages: images.length,
      ocrProvider: input.provider.providerKind,
      ocrProviderVersion: input.provider.providerVersion,
      ocrLanguages: input.provider.languages,
      networkUsed: false,
      officialOddsExtraction: "NOT_PERFORMED",
      gameMatching: "NOT_PERFORMED",
      crossImageRowDedupe: CROSS_IMAGE_ROW_AUTO_DEDUPE,
      captureSequenceRule: CAPTURE_SEQUENCE_RULE,
      acceptedObservationTimes: "NOT_ASSIGNED",
      filenameTimestampUsedAsCapturedAt: false,
      filesystemTimeUsedAsCapturedAt: false,
      autoMergeWithNullTime: false,
      ocrLineOrderUsedAsRowStructure: OCR_LINE_ORDER_USED_AS_ROW_STRUCTURE,
      ocrAccuracyPercent: OCR_ACCURACY_PERCENT,
    },
    images,
  };
}
