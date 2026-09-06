import type { OcrBoundingBox } from "../proto-round-raw-ocr-v0/types";
import type { DerivedBoxGeometry, ImageDimensions } from "./types";

export function isValidBoundingBox(
  box: OcrBoundingBox | null | undefined,
): box is OcrBoundingBox {
  if (!box) return false;
  return (
    Number.isFinite(box.x) &&
    Number.isFinite(box.y) &&
    Number.isFinite(box.width) &&
    Number.isFinite(box.height) &&
    box.width > 0 &&
    box.height > 0
  );
}

function normalize(value: number, denom: number | null): number | null {
  if (denom == null || !(denom > 0) || !Number.isFinite(value)) return null;
  return value / denom;
}

export function deriveBoxGeometry(
  box: OcrBoundingBox,
  dims: ImageDimensions | null,
): DerivedBoxGeometry {
  const rightX = box.x + box.width;
  const bottomY = box.y + box.height;
  const width = dims?.width ?? null;
  const height = dims?.height ?? null;
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    centerX: box.x + box.width / 2,
    centerY: box.y + box.height / 2,
    rightX,
    bottomY,
    normalizedX: normalize(box.x, width),
    normalizedY: normalize(box.y, height),
    normalizedWidth: normalize(box.width, width),
    normalizedHeight: normalize(box.height, height),
  };
}

export function overlapHeight(
  a: { y: number; bottomY: number },
  b: { y: number; bottomY: number },
): number {
  return Math.max(0, Math.min(a.bottomY, b.bottomY) - Math.max(a.y, b.y));
}

export function verticalOverlapRatio(
  a: { y: number; height: number; bottomY: number },
  b: { y: number; height: number; bottomY: number },
): number {
  const minH = Math.min(a.height, b.height);
  if (!(minH > 0)) return 0;
  return overlapHeight(a, b) / minH;
}

export function compareVisualReadingOrder(
  a: { centerY: number; x: number; rawLineIndex: number },
  b: { centerY: number; x: number; rawLineIndex: number },
): number {
  if (a.centerY !== b.centerY) return a.centerY < b.centerY ? -1 : 1;
  if (a.x !== b.x) return a.x < b.x ? -1 : 1;
  return a.rawLineIndex - b.rawLineIndex;
}

export function compareWithinRowX(
  a: { x: number; rawLineIndex: number },
  b: { x: number; rawLineIndex: number },
): number {
  if (a.x !== b.x) return a.x < b.x ? -1 : 1;
  return a.rawLineIndex - b.rawLineIndex;
}
