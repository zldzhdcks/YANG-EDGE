import type { ProtoRoundRowAnchorScheduleCandidateV0 } from "../proto-round-row-anchor-schedule-v0/types";
import type {
  VisualRowCandidateV0,
  VisualRowsDocumentV0,
} from "../proto-round-visual-rows-v0/types";
import type { RowAnchorScheduleDocumentV0 } from "../proto-round-row-anchor-schedule-v0/types";

export class ColumnLayoutLineageError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "ColumnLayoutLineageError";
    this.code = code;
  }
}

export function rowKey(sha: string, visualRowIndex: number): string {
  return `${sha}::${visualRowIndex}`;
}

export type JoinedLayoutRowV0 = {
  visual: VisualRowCandidateV0;
  semantic: ProtoRoundRowAnchorScheduleCandidateV0;
  imageWidth: number | null;
};

export function joinVisualAndAnchorRows(input: {
  visual: VisualRowsDocumentV0;
  semantic: RowAnchorScheduleDocumentV0;
}): JoinedLayoutRowV0[] {
  if (input.visual.meta.protoRoundKey !== input.semantic.meta.protoRoundKey) {
    throw new ColumnLayoutLineageError("PROTO_ROUND_KEY_MISMATCH");
  }
  if (input.visual.meta.year !== input.semantic.meta.year) {
    throw new ColumnLayoutLineageError("YEAR_MISMATCH");
  }
  if (input.visual.meta.round !== input.semantic.meta.round) {
    throw new ColumnLayoutLineageError("ROUND_MISMATCH");
  }
  if (input.visual.images.length !== input.semantic.meta.sourceImages) {
    throw new ColumnLayoutLineageError("SOURCE_IMAGE_COUNT_MISMATCH");
  }

  const widthBySha = new Map<string, number | null>();
  const visualByKey = new Map<string, VisualRowCandidateV0>();
  for (const img of input.visual.images) {
    if (widthBySha.has(img.sourceImageSha256)) {
      throw new ColumnLayoutLineageError("DUPLICATE_VISUAL_SOURCE_SHA");
    }
    widthBySha.set(img.sourceImageSha256, img.imageWidth);
    for (const row of img.visualRows) {
      if (row.sourceImageSha256 !== img.sourceImageSha256) {
        throw new ColumnLayoutLineageError("VISUAL_ROW_SHA_IMAGE_MISMATCH");
      }
      const key = rowKey(row.sourceImageSha256, row.visualRowIndex);
      if (visualByKey.has(key)) {
        throw new ColumnLayoutLineageError("DUPLICATE_VISUAL_ROW_KEY");
      }
      visualByKey.set(key, row);
    }
  }

  const seenSemantic = new Set<string>();
  const joined: JoinedLayoutRowV0[] = [];
  for (const sem of input.semantic.rows) {
    const key = rowKey(sem.sourceImageSha256, sem.visualRowIndex);
    if (seenSemantic.has(key)) {
      throw new ColumnLayoutLineageError("DUPLICATE_SEMANTIC_ROW_KEY");
    }
    seenSemantic.add(key);
    if (!widthBySha.has(sem.sourceImageSha256)) {
      throw new ColumnLayoutLineageError("UNKNOWN_SOURCE_SHA");
    }
    const visual = visualByKey.get(key);
    if (!visual) {
      throw new ColumnLayoutLineageError("MISSING_VISUAL_ROW");
    }
    joined.push({
      visual,
      semantic: sem,
      imageWidth: widthBySha.get(sem.sourceImageSha256) ?? null,
    });
  }

  for (const key of visualByKey.keys()) {
    if (!seenSemantic.has(key)) {
      throw new ColumnLayoutLineageError("MISSING_SEMANTIC_ROW");
    }
  }
  return joined;
}
