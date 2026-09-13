import type { ColumnNameV2, PixelBoxV2 } from "./types";

export type GeometryLineV2 = {
  text: string;
  boundingBox: PixelBoxV2 | null;
};

export type ColumnBandsV2 = Record<ColumnNameV2, { x0: number; x1: number }>;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function maxRight(
  lines: GeometryLineV2[],
  fallback: number,
): number {
  let max = -Infinity;
  for (const line of lines) {
    if (!line.boundingBox) continue;
    max = Math.max(max, line.boundingBox.x + line.boundingBox.width);
  }
  return Number.isFinite(max) ? max : fallback;
}

function minX(lines: GeometryLineV2[], fallback: number): number {
  let min = Infinity;
  for (const line of lines) {
    if (!line.boundingBox) continue;
    min = Math.min(min, line.boundingBox.x);
  }
  return Number.isFinite(min) ? min : fallback;
}

function medianX(lines: GeometryLineV2[], fallback: number): number {
  const xs = lines
    .map((line) => line.boundingBox?.x)
    .filter((x): x is number => typeof x === "number")
    .sort((a, b) => a - b);
  if (xs.length === 0) return fallback;
  return xs[Math.floor(xs.length / 2)]!;
}

export function inferColumnBands(
  lines: GeometryLineV2[],
  imageWidth: number,
): ColumnBandsV2 {
  const width = Math.max(1, Math.floor(imageWidth));
  const boards = lines.filter((l) => /^1[3-6]\d{2}$/.test(l.text.trim()));
  const dates = lines.filter((l) => /09[ .\-]?1[34]/.test(l.text));
  const status = lines.filter((l) => /경기전|결가적|김기전/.test(l.text));
  const prices = lines.filter((l) =>
    /^\d{1,2}[ \-]\d{2}$/.test(l.text.trim()),
  );
  const boardEnd = clamp(Math.floor(maxRight(boards, 40) + 6), 8, width);
  const dateEnd = clamp(
    Math.floor(Math.max(maxRight(dates, boardEnd + 90) + 6, boardEnd + 24)),
    boardEnd + 1,
    width,
  );
  const statusStart = clamp(
    Math.floor(minX(status, width - 80) - 4),
    dateEnd + 8,
    width,
  );
  const oddsStart = clamp(
    Math.floor(medianX(prices, Math.floor((dateEnd + statusStart) / 2)) - 12),
    dateEnd + 1,
    statusStart - 1,
  );
  return {
    BOARD: { x0: 0, x1: boardEnd },
    DATE: { x0: boardEnd, x1: dateEnd },
    TEAM: { x0: dateEnd, x1: oddsStart },
    ODDS: { x0: oddsStart, x1: statusStart },
    STATUS: { x0: statusStart, x1: width },
  };
}

export function boardRowBands(
  lines: GeometryLineV2[],
  imageHeight: number,
): Array<{ board: string; y0: number; y1: number; box: PixelBoxV2 }> {
  const boards = lines
    .filter(
      (l) => l.boundingBox && /^1[3-6]\d{2}$/.test(l.text.trim()),
    )
    .map((l) => ({
      board: l.text.trim(),
      box: l.boundingBox!,
    }))
    .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  const height = Math.max(1, Math.floor(imageHeight));
  return boards.map((row, i) => {
    const next = boards[i + 1];
    const y0 = clamp(Math.floor(row.box.y - 3), 0, height - 1);
    const y1 = next
      ? clamp(Math.floor(next.box.y - 1), y0 + 1, height)
      : clamp(Math.floor(row.box.y + row.box.height + 8), y0 + 1, height);
    return { board: row.board, y0, y1, box: row.box };
  });
}

export function cellCropBox(input: {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  imageWidth: number;
  imageHeight: number;
}): PixelBoxV2 | null {
  const x = Math.max(0, Math.floor(input.x0));
  const y = Math.max(0, Math.floor(input.y0));
  const right = Math.min(input.imageWidth, Math.ceil(input.x1));
  const bottom = Math.min(input.imageHeight, Math.ceil(input.y1));
  const width = right - x;
  const height = bottom - y;
  if (width < 1 || height < 1) return null;
  return { x, y, width, height };
}

export function headerCropBox(input: {
  firstBoardY: number;
  imageWidth: number;
  imageHeight: number;
}): PixelBoxV2 | null {
  const bottom = Math.min(input.imageHeight, Math.max(4, Math.floor(input.firstBoardY)));
  if (bottom < 4) return null;
  return { x: 0, y: 0, width: input.imageWidth, height: bottom };
}

export function tokensInBox(
  lines: GeometryLineV2[],
  box: PixelBoxV2,
): GeometryLineV2[] {
  return lines.filter((line) => {
    if (!line.boundingBox) return false;
    const cx = line.boundingBox.x + line.boundingBox.width / 2;
    const cy = line.boundingBox.y + line.boundingBox.height / 2;
    return (
      cx >= box.x &&
      cx <= box.x + box.width &&
      cy >= box.y &&
      cy <= box.y + box.height
    );
  });
}

export function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
