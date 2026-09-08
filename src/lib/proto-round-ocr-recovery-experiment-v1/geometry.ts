import type { PixelBoxV1 } from "./types";

export function toInclusivePixelBox(input: {
  x: number;
  y: number;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
}): PixelBoxV1 | null {
  const imageWidth = input.imageWidth;
  const imageHeight = input.imageHeight;
  if (
    !Number.isFinite(imageWidth) ||
    !Number.isFinite(imageHeight) ||
    imageWidth < 1 ||
    imageHeight < 1
  ) {
    return null;
  }
  if (
    !Number.isFinite(input.x) ||
    !Number.isFinite(input.y) ||
    !Number.isFinite(input.width) ||
    !Number.isFinite(input.height) ||
    input.width <= 0 ||
    input.height <= 0
  ) {
    return null;
  }
  const x0 = Math.floor(input.x);
  const y0 = Math.floor(input.y);
  const x1 = Math.ceil(input.x + input.width);
  const y1 = Math.ceil(input.y + input.height);
  const x = Math.max(0, Math.min(imageWidth - 1, x0));
  const y = Math.max(0, Math.min(imageHeight - 1, y0));
  const right = Math.max(x + 1, Math.min(imageWidth, x1));
  const bottom = Math.max(y + 1, Math.min(imageHeight, y1));
  const width = right - x;
  const height = bottom - y;
  if (width < 1 || height < 1) return null;
  return { x, y, width, height };
}

/**
 * Full-width crop of an existing visual-row vertical band.
 * Geometry comes from machine visual-row reconstruction, not human pixels.
 */
export function visualRowCropBox(input: {
  topY: number;
  bottomY: number;
  imageWidth: number;
  imageHeight: number;
}): PixelBoxV1 | null {
  return toInclusivePixelBox({
    x: 0,
    y: input.topY,
    width: input.imageWidth,
    height: input.bottomY - input.topY,
    imageWidth: input.imageWidth,
    imageHeight: input.imageHeight,
  });
}

function fragmentUnionBox(
  fragments: Array<{ x: number; y: number; width: number; height: number }>,
): { x: number; y: number; width: number; height: number } | null {
  if (fragments.length === 0) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const f of fragments) {
    if (
      !Number.isFinite(f.x) ||
      !Number.isFinite(f.y) ||
      !Number.isFinite(f.width) ||
      !Number.isFinite(f.height) ||
      f.width <= 0 ||
      f.height <= 0
    ) {
      continue;
    }
    left = Math.min(left, f.x);
    top = Math.min(top, f.y);
    right = Math.max(right, f.x + f.width);
    bottom = Math.max(bottom, f.y + f.height);
  }
  if (!Number.isFinite(left) || right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Crop boxes from existing semantic-region fragment geometry.
 * One box per region. Empty/invalid regions are skipped.
 */
export function semanticRegionCropBoxes(input: {
  imageWidth: number;
  imageHeight: number;
  regions: Array<{
    fragments: Array<{ x: number; y: number; width: number; height: number }>;
  }>;
}): PixelBoxV1[] {
  const out: PixelBoxV1[] = [];
  for (const region of input.regions) {
    const union = fragmentUnionBox(region.fragments);
    if (!union) continue;
    const box = toInclusivePixelBox({
      ...union,
      imageWidth: input.imageWidth,
      imageHeight: input.imageHeight,
    });
    if (box) out.push(box);
  }
  return out;
}
