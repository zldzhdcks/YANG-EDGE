import type { ProtoRoundLocalOcrLine } from "../proto-round-raw-ocr-v0/types";
import { clusterPlacedLines } from "./cluster";
import {
  compareVisualReadingOrder,
  compareWithinRowX,
  deriveBoxGeometry,
  isValidBoundingBox,
} from "./geometry";
import type {
  ImageDimensions,
  PlacedOcrLineV0,
  UnplacedOcrLineV0,
  VisualRowCandidateV0,
  VisualRowFragmentV0,
  VisualRowsImageRecordV0,
} from "./types";

function joinFragmentText(fragments: VisualRowFragmentV0[]): string {
  return fragments.map((f) => f.rawText).join(" ");
}

export function classifyOcrLines(
  rawLines: ProtoRoundLocalOcrLine[],
  dims: ImageDimensions | null,
): { placed: PlacedOcrLineV0[]; unplaced: UnplacedOcrLineV0[] } {
  const placed: PlacedOcrLineV0[] = [];
  const unplaced: UnplacedOcrLineV0[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]!;
    const rawText = line.text;
    if (!line.boundingBox) {
      unplaced.push({
        rawLineIndex: i,
        rawText,
        reason: "MISSING_BOUNDING_BOX",
      });
      continue;
    }
    if (!isValidBoundingBox(line.boundingBox)) {
      unplaced.push({
        rawLineIndex: i,
        rawText,
        reason: "INVALID_BOUNDING_BOX",
      });
      continue;
    }
    placed.push({
      rawLineIndex: i,
      rawText,
      ...deriveBoxGeometry(line.boundingBox, dims),
    });
  }
  return { placed, unplaced };
}

export function buildVisualRowCandidates(input: {
  sourceImageSha256: string;
  sourceFileName: string;
  placed: PlacedOcrLineV0[];
  dims: ImageDimensions | null;
}): VisualRowCandidateV0[] {
  const clusters = clusterPlacedLines(input.placed);
  const ranked = clusters.map((members) => {
    const sorted = [...members].sort(compareWithinRowX);
    const topY = Math.min(...sorted.map((m) => m.y));
    const bottomY = Math.max(...sorted.map((m) => m.bottomY));
    const centerY =
      sorted.reduce((s, m) => s + m.centerY, 0) / sorted.length;
    const minX = Math.min(...sorted.map((m) => m.x));
    const fragments: VisualRowFragmentV0[] = sorted.map((m) => ({
      rawLineIndex: m.rawLineIndex,
      rawText: m.rawText,
      boundingBox: {
        x: m.x,
        y: m.y,
        width: m.width,
        height: m.height,
      },
      x: m.x,
      y: m.y,
      width: m.width,
      height: m.height,
    }));
    return {
      sortCenterY: centerY,
      sortX: minX,
      sortIndex: sorted[0]!.rawLineIndex,
      row: {
        sourceImageSha256: input.sourceImageSha256,
        sourceFileName: input.sourceFileName,
        visualRowIndex: 0,
        topY,
        bottomY,
        centerY,
        normalizedTopY:
          input.dims && input.dims.height > 0 ? topY / input.dims.height : null,
        normalizedBottomY:
          input.dims && input.dims.height > 0
            ? bottomY / input.dims.height
            : null,
        fragmentCount: fragments.length,
        fragments,
        visualJoinedTextCandidate: joinFragmentText(fragments),
        semanticStatus: "UNINTERPRETED" as const,
        officialOddsStatus: "NOT_EXTRACTED" as const,
        gameMatchStatus: "NOT_MATCHED" as const,
      },
    };
  });

  ranked.sort((a, b) =>
    compareVisualReadingOrder(
      { centerY: a.sortCenterY, x: a.sortX, rawLineIndex: a.sortIndex },
      { centerY: b.sortCenterY, x: b.sortX, rawLineIndex: b.sortIndex },
    ),
  );

  return ranked.map((item, i) => ({
    ...item.row,
    visualRowIndex: i,
  }));
}

export function reconstructVisualRowsForImage(input: {
  sourceImageSha256: string;
  sourceFileName: string;
  rawLines: ProtoRoundLocalOcrLine[];
  dims: ImageDimensions | null;
}): VisualRowsImageRecordV0 {
  const { placed, unplaced } = classifyOcrLines(input.rawLines, input.dims);
  const visualRows = buildVisualRowCandidates({
    sourceImageSha256: input.sourceImageSha256,
    sourceFileName: input.sourceFileName,
    placed,
    dims: input.dims,
  });
  return {
    sourceImageSha256: input.sourceImageSha256,
    sourceFileName: input.sourceFileName,
    acceptedObservationTime: null,
    observationTimeProvenance: null,
    imageWidth: input.dims?.width ?? null,
    imageHeight: input.dims?.height ?? null,
    placedLineCount: placed.length,
    unplacedLineCount: unplaced.length,
    visualRowCandidateCount: visualRows.length,
    unplacedLines: unplaced,
    visualRows,
  };
}
