import type { IntakeManifestV1 } from "../proto-round-screenshot-intake-v1/types";
import type { VisualRowsDocumentV0 } from "../proto-round-visual-rows-v0/types";
import { GroundTruthError } from "./error";
import { hasFiniteTargetRowGeometry } from "./geometry";
import type {
  EligibleVisualRowV0,
  GroundTruthLineageImageV0,
  ScreenshotBytesProbe,
} from "./types";
import { rowIdentityKey } from "./hash";

function assertNoPathEscape(relativePath: string): string {
  const posix = relativePath.replaceAll("\\", "/");
  if (
    posix.startsWith("/") ||
    posix.split("/").includes("..") ||
    posix.split("/").includes("")
  ) {
    throw new GroundTruthError("PROTO_ROUND_PATH_ESCAPE");
  }
  return posix;
}

/**
 * Copy identity + target-row geometry only.
 * Fragments / joined OCR text are intentionally not copied.
 */
export function lineageImagesFromVisualRows(
  doc: VisualRowsDocumentV0,
): GroundTruthLineageImageV0[] {
  return doc.images.map((image) => ({
    sourceImageSha256: image.sourceImageSha256,
    sourceFileName: image.sourceFileName,
    imageWidth: image.imageWidth,
    imageHeight: image.imageHeight,
    visualRows: image.visualRows.map((row) => ({
      sourceImageSha256: row.sourceImageSha256,
      sourceFileName: row.sourceFileName,
      visualRowIndex: row.visualRowIndex,
      topY: row.topY,
      bottomY: row.bottomY,
      centerY: row.centerY,
    })),
  }));
}

function canonicalIntakeBySha(
  intake: IntakeManifestV1,
): Map<
  string,
  {
    sha256: string;
    fileName: string;
    relativePath: string;
  }
> {
  const map = new Map<
    string,
    { sha256: string; fileName: string; relativePath: string }
  >();
  for (const file of intake.files) {
    if (file.fileStatus !== "CANONICAL_IMAGE" || file.extractionEligible !== true) {
      continue;
    }
    if (map.has(file.sha256)) {
      throw new GroundTruthError("DUPLICATE_INTAKE_CANONICAL_SHA");
    }
    map.set(file.sha256, {
      sha256: file.sha256,
      fileName: file.fileName,
      relativePath: assertNoPathEscape(file.relativePath),
    });
  }
  return map;
}

/**
 * Fail-closed eligible universe from visual-rows-v0 + intake + screenshot bytes.
 * Does not inspect OCR strings, layout pattern identifiers, or market tags.
 */
export async function collectEligibleRows(input: {
  protoRoundKey: string;
  visualRows: VisualRowsDocumentV0;
  intake: IntakeManifestV1;
  screenshot: ScreenshotBytesProbe;
}): Promise<EligibleVisualRowV0[]> {
  if (input.visualRows.meta.protoRoundKey !== input.protoRoundKey) {
    throw new GroundTruthError("VISUAL_ROWS_PROTO_ROUND_KEY_MISMATCH");
  }
  if (input.intake.meta.protoRoundKey !== input.protoRoundKey) {
    throw new GroundTruthError("INTAKE_PROTO_ROUND_KEY_MISMATCH");
  }

  const intakeBySha = canonicalIntakeBySha(input.intake);
  const images = lineageImagesFromVisualRows(input.visualRows);
  const seen = new Set<string>();
  const eligible: EligibleVisualRowV0[] = [];

  for (const image of images) {
    const intake = intakeBySha.get(image.sourceImageSha256);
    if (!intake) {
      throw new GroundTruthError("UNKNOWN_SOURCE_SHA");
    }
    if (image.sourceFileName !== intake.fileName) {
      throw new GroundTruthError("SOURCE_FILE_NAME_MISMATCH");
    }

    const exists = await input.screenshot.fileExists(intake.relativePath);
    if (!exists) {
      throw new GroundTruthError("MISSING_SOURCE_SCREENSHOT");
    }
    const fileSha = await input.screenshot.fileSha256(intake.relativePath);
    if (fileSha !== intake.sha256 || fileSha !== image.sourceImageSha256) {
      throw new GroundTruthError("SOURCE_SHA_MISMATCH");
    }

    for (let i = 0; i < image.visualRows.length; i++) {
      const row = image.visualRows[i]!;
      if (row.sourceImageSha256 !== image.sourceImageSha256) {
        throw new GroundTruthError("VISUAL_ROW_IMAGE_SHA_MISMATCH");
      }
      if (row.sourceFileName !== image.sourceFileName) {
        throw new GroundTruthError("SOURCE_FILE_NAME_MISMATCH");
      }
      if (row.visualRowIndex !== i) {
        throw new GroundTruthError("VISUAL_ROW_INDEX_MISMATCH");
      }
      const identity = {
        sourceImageSha256: row.sourceImageSha256,
        visualRowIndex: row.visualRowIndex,
      };
      const key = rowIdentityKey(identity);
      if (seen.has(key)) {
        throw new GroundTruthError("DUPLICATE_ROW_KEY");
      }
      seen.add(key);

      if (
        !hasFiniteTargetRowGeometry({
          row,
          image,
        })
      ) {
        continue;
      }

      eligible.push({
        sourceImageSha256: row.sourceImageSha256,
        sourceFileName: row.sourceFileName,
        visualRowIndex: row.visualRowIndex,
        topY: row.topY,
        bottomY: row.bottomY,
        centerY: row.centerY,
        imageWidth: image.imageWidth as number,
        imageHeight: image.imageHeight as number,
        screenshotRelativePath: intake.relativePath,
      });
    }
  }

  return eligible;
}
