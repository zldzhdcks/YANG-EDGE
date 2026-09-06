import type { PngIhdrDimensions } from "./types";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/** Read PNG IHDR width/height from raw bytes. Does not decompress pixels. */
export function readPngIhdrDimensions(
  bytes: Uint8Array,
): PngIhdrDimensions | null {
  if (bytes.length < 24) return null;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return null;
  }
  const type = Buffer.from(bytes.subarray(12, 16)).toString("ascii");
  if (type !== "IHDR") return null;
  const view = Buffer.from(bytes.subarray(16, 24));
  const width = view.readUInt32BE(0);
  const height = view.readUInt32BE(4);
  if (width === 0 || height === 0) return null;
  const g = gcd(width, height);
  return {
    width,
    height,
    aspectRatio: `${width / g}:${height / g}`,
  };
}
