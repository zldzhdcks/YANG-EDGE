import { GroundTruthError } from "./error";
import { rowIdentityKey } from "./hash";
import {
  applyHumanTruthFields,
  assertDiscoveryAnnotationIdentities,
  readHumanTruthFields,
} from "./persist";
import {
  DISCOVERY_ANNOTATION_SCHEMA_VERSION,
  type DiscoveryAnnotationDocumentV0,
  type SelectionManifestV0,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function identityChanged(
  existing: { sourceImageSha256: string; sourceFileName: string; visualRowIndex: number },
  incoming: Record<string, unknown>,
): boolean {
  if (
    incoming.sourceImageSha256 != null &&
    incoming.sourceImageSha256 !== existing.sourceImageSha256
  ) {
    return true;
  }
  if (
    incoming.sourceFileName != null &&
    incoming.sourceFileName !== existing.sourceFileName
  ) {
    return true;
  }
  if (
    incoming.visualRowIndex != null &&
    incoming.visualRowIndex !== existing.visualRowIndex
  ) {
    return true;
  }
  return false;
}

function geometryChanged(
  existing: DiscoveryAnnotationDocumentV0["records"][number]["targetRowGeometry"],
  incoming: unknown,
): boolean {
  if (incoming == null) return false;
  if (!isRecord(incoming)) return true;
  return (
    incoming.topY !== existing.topY ||
    incoming.bottomY !== existing.bottomY ||
    incoming.centerY !== existing.centerY ||
    incoming.imageWidth !== existing.imageWidth ||
    incoming.imageHeight !== existing.imageHeight
  );
}

/**
 * Overlay exported/imported human truth onto the frozen discovery document.
 * Frozen identity, geometry, and screenshot path cannot change.
 */
export function importDiscoveryAnnotationV0(input: {
  protoRoundKey: string;
  selectionManifest: SelectionManifestV0;
  existingAnnotation: DiscoveryAnnotationDocumentV0;
  imported: unknown;
}): DiscoveryAnnotationDocumentV0 {
  if (!isRecord(input.imported)) {
    throw new GroundTruthError("INVALID_DISCOVERY_IMPORT");
  }
  if (
    input.imported.schemaVersion != null &&
    input.imported.schemaVersion !== DISCOVERY_ANNOTATION_SCHEMA_VERSION
  ) {
    throw new GroundTruthError("INVALID_DISCOVERY_IMPORT");
  }
  if (
    input.imported.protoRoundKey != null &&
    input.imported.protoRoundKey !== input.protoRoundKey
  ) {
    throw new GroundTruthError("DISCOVERY_ANNOTATION_PROTO_ROUND_KEY_MISMATCH");
  }
  if (!Array.isArray(input.imported.records)) {
    throw new GroundTruthError("INVALID_DISCOVERY_IMPORT");
  }

  assertDiscoveryAnnotationIdentities({
    records: input.imported.records.map((item) => {
      if (!isRecord(item)) throw new GroundTruthError("INVALID_DISCOVERY_IMPORT");
      if (typeof item.sourceImageSha256 !== "string") {
        throw new GroundTruthError("INVALID_DISCOVERY_IMPORT");
      }
      if (typeof item.visualRowIndex !== "number") {
        throw new GroundTruthError("INVALID_DISCOVERY_IMPORT");
      }
      return {
        sourceImageSha256: item.sourceImageSha256,
        visualRowIndex: item.visualRowIndex,
      };
    }),
    discoveryRowKeys: input.selectionManifest.discoveryRowKeys,
    holdoutRowKeys: input.selectionManifest.holdoutRowKeys,
  });

  const importedById = new Map<string, Record<string, unknown>>();
  for (const item of input.imported.records) {
    const rec = item as Record<string, unknown>;
    importedById.set(
      rowIdentityKey({
        sourceImageSha256: rec.sourceImageSha256 as string,
        visualRowIndex: rec.visualRowIndex as number,
      }),
      rec,
    );
  }

  const records = input.existingAnnotation.records.map((existing, index) => {
    const frozen = input.selectionManifest.discoveryRowKeys[index]!;
    const incoming = importedById.get(rowIdentityKey(frozen));
    if (!incoming) {
      throw new GroundTruthError("DISCOVERY_ANNOTATION_IDENTITY_DRIFT");
    }
    if (identityChanged(existing, incoming)) {
      throw new GroundTruthError("ANNOTATION_IMPORT_MUTATES_FROZEN_IDENTITY");
    }
    if (geometryChanged(existing.targetRowGeometry, incoming.targetRowGeometry)) {
      throw new GroundTruthError("ANNOTATION_IMPORT_MUTATES_FROZEN_IDENTITY");
    }
    if (
      incoming.screenshotRelativePath != null &&
      incoming.screenshotRelativePath !== existing.screenshotRelativePath
    ) {
      throw new GroundTruthError("ANNOTATION_IMPORT_MUTATES_FROZEN_IDENTITY");
    }
    return applyHumanTruthFields(existing, readHumanTruthFields(incoming));
  });

  assertDiscoveryAnnotationIdentities({
    records,
    discoveryRowKeys: input.selectionManifest.discoveryRowKeys,
    holdoutRowKeys: input.selectionManifest.holdoutRowKeys,
  });

  return {
    ...input.existingAnnotation,
    records,
  };
}
