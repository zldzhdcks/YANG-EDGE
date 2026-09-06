import type { VisualRowFragmentV0 } from "../proto-round-visual-rows-v0/types";
import {
  LAYOUT_DISCOVERY_BIN_WIDTH,
  LAYOUT_DISCOVERY_MIN_MODE_SHARE,
  type HistogramBinV0,
  type LayoutFragmentV0,
  type PercentileDistribution,
} from "./types";
import { classifyDescriptiveShape, classifyTokenShape } from "./token-shape";

export function normalizeX(x: number, imageWidth: number): number {
  if (!(imageWidth > 0) || !Number.isFinite(x)) {
    throw new Error("INVALID_IMAGE_WIDTH_FOR_NORMALIZED_X");
  }
  return x / imageWidth;
}

export function layoutFragmentFromVisual(
  frag: VisualRowFragmentV0,
  imageWidth: number,
): LayoutFragmentV0 {
  const left = normalizeX(frag.x, imageWidth);
  const right = normalizeX(frag.x + frag.width, imageWidth);
  return {
    rawLineIndex: frag.rawLineIndex,
    rawText: frag.rawText,
    x: frag.x,
    y: frag.y,
    width: frag.width,
    height: frag.height,
    normalizedLeftX: left,
    normalizedCenterX: (left + right) / 2,
    normalizedRightX: right,
    tokenShape: classifyTokenShape(frag.rawText),
    descriptiveShape: classifyDescriptiveShape(frag.rawText),
  };
}

export function sortByNormalizedX(frags: LayoutFragmentV0[]): LayoutFragmentV0[] {
  return [...frags].sort((a, b) => {
    if (a.normalizedLeftX !== b.normalizedLeftX) {
      return a.normalizedLeftX < b.normalizedLeftX ? -1 : 1;
    }
    return a.rawLineIndex - b.rawLineIndex;
  });
}

export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[idx]!;
}

export function distribution(values: number[]): PercentileDistribution {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    min: sorted.length ? sorted[0]! : null,
    p10: percentile(sorted, 0.1),
    median: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    max: sorted.length ? sorted[sorted.length - 1]! : null,
  };
}

export function histogramBinCount(): number {
  return Math.round(1 / LAYOUT_DISCOVERY_BIN_WIDTH);
}

export function binIndexForNormalizedX(x: number): number {
  const n = histogramBinCount();
  if (x >= 1) return n - 1;
  if (x < 0) return 0;
  return Math.min(n - 1, Math.floor(x / LAYOUT_DISCOVERY_BIN_WIDTH));
}

export function emptyHistogram(): HistogramBinV0[] {
  const n = histogramBinCount();
  const bins: HistogramBinV0[] = [];
  for (let i = 0; i < n; i++) {
    bins.push({
      binIndex: i,
      normalizedLeft: i * LAYOUT_DISCOVERY_BIN_WIDTH,
      normalizedRight: (i + 1) * LAYOUT_DISCOVERY_BIN_WIDTH,
      fragmentCount: 0,
      rowCoverage: 0,
      exampleRawTexts: [],
      descriptiveShapeCounts: {},
    });
  }
  return bins;
}

export function accumulateHistogram(
  bins: HistogramBinV0[],
  frag: LayoutFragmentV0,
  rowKeysSeen: Array<Set<string>>,
  rowKey: string,
): void {
  const i = binIndexForNormalizedX(frag.normalizedCenterX);
  const bin = bins[i]!;
  bin.fragmentCount += 1;
  const set = rowKeysSeen[i]!;
  set.add(rowKey);
  bin.rowCoverage = set.size;
  if (bin.exampleRawTexts.length < 8 && !bin.exampleRawTexts.includes(frag.rawText)) {
    bin.exampleRawTexts.push(frag.rawText);
  }
  const shape = frag.descriptiveShape;
  bin.descriptiveShapeCounts[shape] = (bin.descriptiveShapeCounts[shape] ?? 0) + 1;
}

/**
 * Stable modes = histogram local maxima meeting LAYOUT_DISCOVERY_MIN_MODE_SHARE.
 * Boundaries = midpoints between adjacent mode centers.
 */
export function modesFromHistogram(
  bins: HistogramBinV0[],
  remainderFragmentTotal: number,
): { center: number; binIndex: number; fragmentCount: number }[] {
  const minCount = Math.max(1, Math.ceil(remainderFragmentTotal * LAYOUT_DISCOVERY_MIN_MODE_SHARE));
  const modes: { center: number; binIndex: number; fragmentCount: number }[] = [];
  for (let i = 0; i < bins.length; i++) {
    const c = bins[i]!.fragmentCount;
    if (c < minCount) continue;
    const left = i === 0 ? 0 : bins[i - 1]!.fragmentCount;
    const right = i === bins.length - 1 ? 0 : bins[i + 1]!.fragmentCount;
    if (c >= left && c >= right && c > left && c > right) {
      modes.push({
        center: (bins[i]!.normalizedLeft + bins[i]!.normalizedRight) / 2,
        binIndex: i,
        fragmentCount: c,
      });
      continue;
    }
    // Plateau peak: first bin of a flat local max.
    if (c >= left && c >= right && c > 0) {
      const prevIsLower = i === 0 || left < c;
      const nextIsNotHigher = i === bins.length - 1 || right <= c;
      if (prevIsLower && nextIsNotHigher && c > left) {
        modes.push({
          center: (bins[i]!.normalizedLeft + bins[i]!.normalizedRight) / 2,
          binIndex: i,
          fragmentCount: c,
        });
      }
    }
  }
  return modes;
}

export function bandEdgesFromModeCenters(modeCenters: number[]): Array<{
  left: number;
  right: number;
  modeCenter: number;
}> {
  if (modeCenters.length === 0) return [];
  const edges: Array<{ left: number; right: number; modeCenter: number }> = [];
  for (let i = 0; i < modeCenters.length; i++) {
    const modeCenter = modeCenters[i]!;
    const left =
      i === 0 ? 0 : (modeCenters[i - 1]! + modeCenter) / 2;
    const right =
      i === modeCenters.length - 1
        ? 1
        : (modeCenter + modeCenters[i + 1]!) / 2;
    edges.push({ left, right, modeCenter });
  }
  return edges;
}

export function bandIndexForCenter(
  centerX: number,
  bands: Array<{ left: number; right: number }>,
): number | null {
  if (bands.length === 0) return null;
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i]!;
    if (centerX >= b.left && (centerX < b.right || i === bands.length - 1)) {
      return i;
    }
  }
  return bands.length - 1;
}
