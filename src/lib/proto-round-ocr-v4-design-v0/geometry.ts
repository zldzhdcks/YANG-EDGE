import {
  toInclusivePixelBox,
  type PixelBoxV3,
} from "../proto-round-participant-ocr-experiment-v3";

export type RowGeometryForBandsV0 = {
  topY: number;
  bottomY: number;
  imageWidth: number;
  imageHeight: number;
};

export function leftRightHalfRowBands(input: RowGeometryForBandsV0): {
  left: PixelBoxV3 | null;
  right: PixelBoxV3 | null;
  deterministic: boolean;
} {
  const mid = Math.floor(input.imageWidth / 2);
  const height = input.bottomY - input.topY;
  const left = toInclusivePixelBox({
    x: 0,
    y: input.topY,
    width: mid,
    height,
    imageWidth: input.imageWidth,
    imageHeight: input.imageHeight,
  });
  const right = toInclusivePixelBox({
    x: mid,
    y: input.topY,
    width: input.imageWidth - mid,
    height,
    imageWidth: input.imageWidth,
    imageHeight: input.imageHeight,
  });
  return {
    left,
    right,
    deterministic: left != null && right != null,
  };
}

export function partitionBoxesByImageMidpoint(input: {
  boxes: PixelBoxV3[];
  imageWidth: number;
}): { left: PixelBoxV3[]; right: PixelBoxV3[] } {
  const mid = input.imageWidth / 2;
  const left: PixelBoxV3[] = [];
  const right: PixelBoxV3[] = [];
  for (const box of input.boxes) {
    const centerX = box.x + box.width / 2;
    if (centerX < mid) left.push(box);
    else right.push(box);
  }
  return { left, right };
}
