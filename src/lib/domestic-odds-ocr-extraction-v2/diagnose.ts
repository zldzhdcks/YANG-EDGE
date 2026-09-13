import type { OcrFailureFamilyV2 } from "./types";

const BOARD_RE = /^1[3-6]\d{2}$/;
const DATE_RE = /09[ .\-]?1[34]/;
const TIME_CONFUSION_RE =
  /[고T寸이卍로한가우]/u;
const SPACE_DECIMAL_RE = /^\d{1,2} \d{2}$/;
const HYPHEN_DECIMAL_RE = /^\d{1,2}-\d{2}$/;
const MERGED_DECIMAL_RE = /^\d{3}$/;
const STATUS_RE = /경기전|결가적|김기전/;
const MARKET_RE = /^(?:SUM|KBO|NPB|MLB|라리가|세리에|분데스|H[ +-]|U\d)/;

export function classifyV1Token(text: string): OcrFailureFamilyV2 | "BOARD" | "DATE_TOKEN" | "STATUS" | "MARKET" | "OTHER_OK" {
  const t = text.trim();
  if (BOARD_RE.test(t)) return "OTHER_OK";
  if (DATE_RE.test(t) && TIME_CONFUSION_RE.test(t)) return "TIME_TEXT_CONFUSION";
  if (DATE_RE.test(t)) return "DATE_TOKEN";
  if (TIME_CONFUSION_RE.test(t) && /\d/.test(t)) return "TIME_TEXT_CONFUSION";
  if (SPACE_DECIMAL_RE.test(t)) return "DECIMAL_SEPARATOR_DROPPED";
  if (HYPHEN_DECIMAL_RE.test(t)) return "DECIMAL_SEPARATOR_REPLACED";
  if (MERGED_DECIMAL_RE.test(t)) return "DIGIT_MERGED";
  if (STATUS_RE.test(t)) return "STATUS";
  if (MARKET_RE.test(t)) return "MARKET";
  if (t === "그" || t.startsWith("그 ") || t === "바르셀로") return "TEAM_TEXT_PARTIAL";
  if (/^[\uac00-\ud7a3]{1,3}$/.test(t) && t.length < 3) return "TEAM_TEXT_PARTIAL";
  return "UNKNOWN";
}

export function diagnoseV1Lines(
  lines: Array<{
    text: string;
    boundingBox: { x: number; y: number; width: number; height: number } | null;
  }>,
): {
  tokenCount: number;
  familyCounts: Record<OcrFailureFamilyV2, number>;
  samples: Partial<Record<OcrFailureFamilyV2, string[]>>;
} {
  const familyCounts: Record<OcrFailureFamilyV2, number> = {
    DECIMAL_SEPARATOR_DROPPED: 0,
    DECIMAL_SEPARATOR_REPLACED: 0,
    DIGIT_MERGED: 0,
    TEAM_TEXT_PARTIAL: 0,
    ROW_BOUNDARY_ERROR: 0,
    DATE_PARSE_FAILURE: 0,
    TIME_TEXT_CONFUSION: 0,
    UNKNOWN: 0,
  };
  const samples: Partial<Record<OcrFailureFamilyV2, string[]>> = {};
  const boards = lines.filter(
    (line) =>
      line.boundingBox && BOARD_RE.test(line.text.trim()),
  );
  for (const line of lines) {
    const family = classifyV1Token(line.text);
    if (
      family === "OTHER_OK" ||
      family === "DATE_TOKEN" ||
      family === "STATUS" ||
      family === "MARKET"
    ) {
      continue;
    }
    let tagged: OcrFailureFamilyV2 = family;
    if (line.boundingBox && boards.length >= 2) {
      const overlaps = boards.filter((board) => {
        const a = line.boundingBox!;
        const b = board.boundingBox!;
        const ay0 = a.y;
        const ay1 = a.y + a.height;
        const by0 = b.y;
        const by1 = b.y + b.height;
        const overlap = Math.max(0, Math.min(ay1, by1) - Math.max(ay0, by0));
        return overlap > 0 && overlap < Math.min(a.height, b.height) * 0.5;
      });
      if (overlaps.length >= 2) tagged = "ROW_BOUNDARY_ERROR";
    }
    familyCounts[tagged] += 1;
    const list = samples[tagged] ?? [];
    if (list.length < 8) list.push(line.text);
    samples[tagged] = list;
  }
  return {
    tokenCount: lines.length,
    familyCounts,
    samples,
  };
}
