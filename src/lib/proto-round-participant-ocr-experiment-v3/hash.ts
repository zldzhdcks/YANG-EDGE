import { createHash } from "node:crypto";

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function identifyFreshUnseenImages(input: {
  canonicalImages: Array<{ sha256: string }>;
  firstShotSourceImages: Array<{ sourceImageSha256: string }>;
}): { freshUnseenImageCount: number; freshUnseenImageSha256: string[] } {
  const firstShot = new Set(
    input.firstShotSourceImages.map((img) => img.sourceImageSha256),
  );
  const shas: string[] = [];
  for (const img of input.canonicalImages) {
    if (firstShot.has(img.sha256)) continue;
    shas.push(img.sha256);
  }
  shas.sort();
  return {
    freshUnseenImageCount: shas.length,
    freshUnseenImageSha256: shas,
  };
}
