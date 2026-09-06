import type { GroundTruthLineageImageV0, GroundTruthLineageVisualRowV0 } from "./types";

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Eligible target-row geometry: finite box on a finite positive image.
 * Does not inspect OCR strings or layout/market tags.
 */
export function hasFiniteTargetRowGeometry(input: {
  row: GroundTruthLineageVisualRowV0;
  image: Pick<GroundTruthLineageImageV0, "imageWidth" | "imageHeight">;
}): boolean {
  const { row, image } = input;
  if (!isFiniteNumber(image.imageWidth) || !isFiniteNumber(image.imageHeight)) {
    return false;
  }
  if (image.imageWidth <= 0 || image.imageHeight <= 0) return false;
  if (
    !isFiniteNumber(row.topY) ||
    !isFiniteNumber(row.bottomY) ||
    !isFiniteNumber(row.centerY)
  ) {
    return false;
  }
  return row.topY <= row.bottomY;
}
