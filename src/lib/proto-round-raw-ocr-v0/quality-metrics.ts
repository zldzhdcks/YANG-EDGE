import type { ProtoRoundLocalOcrLine, RawOcrImageRecordV0 } from "./types";
import { OCR_ACCURACY_PERCENT } from "./types";

const HANGUL_CHAR = /^\p{Script=Hangul}$/u;
const ASCII_DIGIT = /^[0-9]$/;
const BRACKET = /^[()[\]{}]$/;

function countChars(text: string, pred: (ch: string) => boolean): number {
  let n = 0;
  for (const ch of text) {
    if (pred(ch)) n += 1;
  }
  return n;
}

export type RawOcrCharacterQuality = {
  lineCount: number;
  nonWhitespaceCharacterCount: number;
  hangulCharacterCount: number;
  digitCharacterCount: number;
  decimalPointCharacterCount: number;
  colonCharacterCount: number;
  parenthesisBracketCharacterCount: number;
};

export type RawOcrImageQualityRow = RawOcrCharacterQuality & {
  fileName: string;
  hangulPresent: boolean;
  decimalPresent: boolean;
  colonPresent: boolean;
};

function textFromRecord(image: Pick<RawOcrImageRecordV0, "rawText" | "rawLines" | "lineCount" | "nonWhitespaceCharacterCount">): {
  text: string;
  lineCount: number;
} {
  const text = image.rawText ?? "";
  return {
    text,
    lineCount: image.lineCount,
  };
}

export function measureRawOcrCharacterQuality(text: string, lineCount: number): RawOcrCharacterQuality {
  const nonWs = countChars(text, (ch) => !/\s/u.test(ch));
  return {
    lineCount,
    nonWhitespaceCharacterCount: nonWs,
    hangulCharacterCount: countChars(text, (ch) => HANGUL_CHAR.test(ch)),
    digitCharacterCount: countChars(text, (ch) => ASCII_DIGIT.test(ch)),
    decimalPointCharacterCount: countChars(text, (ch) => ch === "."),
    colonCharacterCount: countChars(text, (ch) => ch === ":"),
    parenthesisBracketCharacterCount: countChars(text, (ch) => BRACKET.test(ch)),
  };
}

export function measureImageRawOcrQuality(
  image: Pick<
    RawOcrImageRecordV0,
    "sourceFileName" | "rawText" | "rawLines" | "lineCount" | "nonWhitespaceCharacterCount"
  >,
): RawOcrImageQualityRow {
  const { text, lineCount } = textFromRecord(image);
  const q = measureRawOcrCharacterQuality(text, lineCount);
  return {
    fileName: image.sourceFileName,
    ...q,
    hangulPresent: q.hangulCharacterCount > 0,
    decimalPresent: q.decimalPointCharacterCount > 0,
    colonPresent: q.colonCharacterCount > 0,
  };
}

export function previewRawLinesContaining(
  rawLines: ProtoRoundLocalOcrLine[] | null,
  pred: (text: string) => boolean,
  max: number,
): string[] {
  if (!rawLines) return [];
  const out: string[] = [];
  for (const line of rawLines) {
    if (line.text.trim() === "") continue;
    if (!pred(line.text)) continue;
    out.push(line.text);
    if (out.length >= max) break;
  }
  return out;
}

export function previewHangulRawLines(
  rawLines: ProtoRoundLocalOcrLine[] | null,
  max = 5,
): string[] {
  return previewRawLinesContaining(
    rawLines,
    (text) => Array.from(text).some((ch) => HANGUL_CHAR.test(ch)),
    max,
  );
}

export function previewDecimalPointRawLines(
  rawLines: ProtoRoundLocalOcrLine[] | null,
  max = 5,
): string[] {
  return previewRawLinesContaining(rawLines, (text) => text.includes("."), max);
}

export function previewColonRawLines(
  rawLines: ProtoRoundLocalOcrLine[] | null,
  max = 3,
): string[] {
  return previewRawLinesContaining(rawLines, (text) => text.includes(":"), max);
}

export function summarizeRawOcrQuality(images: RawOcrImageRecordV0[]): {
  ocrAccuracyPercent: typeof OCR_ACCURACY_PERCENT;
  ocrLineOrderUsedAsRowStructure: false;
  totalRawLines: number;
  totalNonWhitespaceCharacters: number;
  hangulCharacterCount: number;
  asciiDigitCount: number;
  decimalPointCharacterCount: number;
  colonCharacterCount: number;
  parenthesisBracketCharacterCount: number;
  hangulPresentImages: string;
  decimalPresentImages: string;
  colonPresentImages: string;
  perImage: RawOcrImageQualityRow[];
} {
  const perImage = images.map(measureImageRawOcrQuality);
  const hangulImages = perImage.filter((r) => r.hangulPresent).length;
  const decimalImages = perImage.filter((r) => r.decimalPresent).length;
  const colonImages = perImage.filter((r) => r.colonPresent).length;
  const n = images.length;
  return {
    ocrAccuracyPercent: OCR_ACCURACY_PERCENT,
    ocrLineOrderUsedAsRowStructure: false,
    totalRawLines: perImage.reduce((s, r) => s + r.lineCount, 0),
    totalNonWhitespaceCharacters: perImage.reduce(
      (s, r) => s + r.nonWhitespaceCharacterCount,
      0,
    ),
    hangulCharacterCount: perImage.reduce((s, r) => s + r.hangulCharacterCount, 0),
    asciiDigitCount: perImage.reduce((s, r) => s + r.digitCharacterCount, 0),
    decimalPointCharacterCount: perImage.reduce(
      (s, r) => s + r.decimalPointCharacterCount,
      0,
    ),
    colonCharacterCount: perImage.reduce((s, r) => s + r.colonCharacterCount, 0),
    parenthesisBracketCharacterCount: perImage.reduce(
      (s, r) => s + r.parenthesisBracketCharacterCount,
      0,
    ),
    hangulPresentImages: `${hangulImages}/${n}`,
    decimalPresentImages: `${decimalImages}/${n}`,
    colonPresentImages: `${colonImages}/${n}`,
    perImage,
  };
}
