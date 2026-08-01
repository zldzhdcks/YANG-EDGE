/**
 * Merge draft rows across multiple images for the same gameId.
 */
import type { KboProtoOcrDraftRow } from "./types";
import { computeProtoOcrConfidence } from "./confidence";

function pricesEqual(
  a: number | null,
  b: number | null,
): boolean {
  if (a == null || b == null) return a === b;
  return Math.abs(a - b) < 1e-9;
}

export function mergeProtoOcrDraftRows(
  rows: KboProtoOcrDraftRow[],
): KboProtoOcrDraftRow[] {
  const byGame = new Map<string, KboProtoOcrDraftRow[]>();
  const unmatched: KboProtoOcrDraftRow[] = [];

  for (const row of rows) {
    if (!row.gameId) {
      unmatched.push(row);
      continue;
    }
    const list = byGame.get(row.gameId) ?? [];
    list.push(row);
    byGame.set(row.gameId, list);
  }

  const merged: KboProtoOcrDraftRow[] = [];
  for (const [, group] of byGame) {
    if (group.length === 1) {
      merged.push(group[0]!);
      continue;
    }
    const base = { ...group[0]! };
    const sourceImageIds = [...new Set(group.flatMap((g) => g.sourceImageIds))];
    const conflict = group.some(
      (g) =>
        !pricesEqual(g.awayPrice, base.awayPrice) ||
        !pricesEqual(g.homePrice, base.homePrice),
    );
    if (conflict) {
      base.mappingStatus = "CONFLICTING_CANDIDATES";
      base.errors = [...new Set([...base.errors, "CONFLICTING_CANDIDATES"])];
      base.warnings = [
        ...new Set([...base.warnings, "CONFLICTING_CANDIDATES"]),
      ];
      base.awayPrice = null;
      base.homePrice = null;
      base.confidence = computeProtoOcrConfidence({
        textRecognitionConfidence: 0.5,
        teamResolved: true,
        pricesResolved: false,
        scheduleMatched: true,
        ambiguous: false,
        directionMismatch: false,
        invalidPrice: false,
        parserWarnings: base.warnings,
        mappingStatus: "CONFLICTING_CANDIDATES",
      });
    } else {
      base.mappingStatus =
        base.mappingStatus === "MATCHED_EXACT"
          ? "DUPLICATE_CANDIDATE"
          : base.mappingStatus;
      base.warnings = [
        ...new Set([...base.warnings, "MERGED_IDENTICAL_CANDIDATES"]),
      ];
    }
    base.sourceImageIds = sourceImageIds;
    merged.push(base);
  }

  return [...merged, ...unmatched];
}
