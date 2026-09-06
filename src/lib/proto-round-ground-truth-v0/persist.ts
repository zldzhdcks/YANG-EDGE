import { GroundTruthError } from "./error";
import { canonicalJson, rowIdentityKey, sha256Utf8 } from "./hash";
import {
  DISCOVERY_ANNOTATION_SCHEMA_VERSION,
  DISCOVERY_SAMPLE_SIZE,
  HOLDOUT_SAMPLE_SIZE,
  HOLDOUT_SEAL_SCHEMA_VERSION,
  HUMAN_TRUTH_FIELD_NAMES,
  SELECTION_ALGORITHM,
  SELECTION_SALT,
  SELECTION_SCHEMA_VERSION,
  type AnnotationStatusV0,
  type DiscoveryAnnotationDocumentV0,
  type DiscoveryAnnotationRecordV0,
  type FrozenRowKeyV0,
  type HoldoutSealV0,
  type SelectionManifestV0,
} from "./types";

const ANNOTATION_STATUSES = new Set<AnnotationStatusV0>([
  "UNANNOTATED",
  "COMPLETE",
  "UNCERTAIN",
  "UNREADABLE",
]);

export type HumanTruthFieldsV0 = Pick<
  DiscoveryAnnotationRecordV0,
  (typeof HUMAN_TRUTH_FIELD_NAMES)[number]
>;

export type ExistingGroundTruthArtifactsV0 = {
  selectionManifestRaw?: string | null;
  holdoutSealRaw?: string | null;
  discoveryAnnotationRaw?: string | null;
};

export type PreservedArtifactV0<T> = {
  value: T;
  raw: string;
  sha256: string;
  write: boolean;
  action: "CREATED" | "PRESERVED";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function parseJsonObject(raw: string, code: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GroundTruthError(code);
  }
  if (!isRecord(parsed)) throw new GroundTruthError(code);
  return parsed;
}

function assertFrozenRowKey(value: unknown, code: string): FrozenRowKeyV0 {
  if (!isRecord(value)) throw new GroundTruthError(code);
  if (typeof value.sourceImageSha256 !== "string" || value.sourceImageSha256.length === 0) {
    throw new GroundTruthError(code);
  }
  if (typeof value.visualRowIndex !== "number" || !Number.isInteger(value.visualRowIndex)) {
    throw new GroundTruthError(code);
  }
  return {
    sourceImageSha256: value.sourceImageSha256,
    visualRowIndex: value.visualRowIndex,
  };
}

function assertFrozenRowKeys(value: unknown, size: number, code: string): FrozenRowKeyV0[] {
  if (!Array.isArray(value) || value.length !== size) throw new GroundTruthError(code);
  return value.map((item) => assertFrozenRowKey(item, code));
}

export function parseSelectionManifestV0(
  raw: string,
  protoRoundKey: string,
): SelectionManifestV0 {
  const parsed = parseJsonObject(raw, "INVALID_SELECTION_MANIFEST");
  if (parsed.schemaVersion !== SELECTION_SCHEMA_VERSION) {
    throw new GroundTruthError("INVALID_SELECTION_MANIFEST");
  }
  if (parsed.protoRoundKey !== protoRoundKey) {
    throw new GroundTruthError("SELECTION_PROTO_ROUND_KEY_MISMATCH");
  }
  if (parsed.selectionAlgorithm !== SELECTION_ALGORITHM) {
    throw new GroundTruthError("INVALID_SELECTION_MANIFEST");
  }
  if (parsed.selectionSalt !== SELECTION_SALT) {
    throw new GroundTruthError("INVALID_SELECTION_MANIFEST");
  }
  if (parsed.discoverySampleSize !== DISCOVERY_SAMPLE_SIZE) {
    throw new GroundTruthError("INVALID_SELECTION_MANIFEST");
  }
  if (parsed.holdoutSampleSize !== HOLDOUT_SAMPLE_SIZE) {
    throw new GroundTruthError("INVALID_SELECTION_MANIFEST");
  }
  if (typeof parsed.eligibleRowCount !== "number" || !Number.isInteger(parsed.eligibleRowCount)) {
    throw new GroundTruthError("INVALID_SELECTION_MANIFEST");
  }
  return {
    schemaVersion: SELECTION_SCHEMA_VERSION,
    protoRoundKey,
    selectionAlgorithm: SELECTION_ALGORITHM,
    selectionSalt: SELECTION_SALT,
    eligibleRowCount: parsed.eligibleRowCount,
    discoverySampleSize: DISCOVERY_SAMPLE_SIZE,
    holdoutSampleSize: HOLDOUT_SAMPLE_SIZE,
    discoveryRowKeys: assertFrozenRowKeys(
      parsed.discoveryRowKeys,
      DISCOVERY_SAMPLE_SIZE,
      "INVALID_SELECTION_MANIFEST",
    ),
    holdoutRowKeys: assertFrozenRowKeys(
      parsed.holdoutRowKeys,
      HOLDOUT_SAMPLE_SIZE,
      "INVALID_SELECTION_MANIFEST",
    ),
  };
}

export function parseHoldoutSealV0(raw: string, protoRoundKey: string): HoldoutSealV0 {
  const parsed = parseJsonObject(raw, "INVALID_HOLDOUT_SEAL");
  if (parsed.schemaVersion !== HOLDOUT_SEAL_SCHEMA_VERSION) {
    throw new GroundTruthError("INVALID_HOLDOUT_SEAL");
  }
  if (parsed.protoRoundKey !== protoRoundKey) {
    throw new GroundTruthError("HOLDOUT_SEAL_PROTO_ROUND_KEY_MISMATCH");
  }
  if (parsed.holdoutSampleSize !== HOLDOUT_SAMPLE_SIZE) {
    throw new GroundTruthError("INVALID_HOLDOUT_SEAL");
  }
  if (typeof parsed.selectionManifestSha256 !== "string") {
    throw new GroundTruthError("INVALID_HOLDOUT_SEAL");
  }
  if (
    !Array.isArray(parsed.holdoutRowKeyHashes) ||
    parsed.holdoutRowKeyHashes.length !== HOLDOUT_SAMPLE_SIZE ||
    parsed.holdoutRowKeyHashes.some((item) => typeof item !== "string")
  ) {
    throw new GroundTruthError("INVALID_HOLDOUT_SEAL");
  }
  return {
    schemaVersion: HOLDOUT_SEAL_SCHEMA_VERSION,
    protoRoundKey,
    holdoutSampleSize: HOLDOUT_SAMPLE_SIZE,
    selectionManifestSha256: parsed.selectionManifestSha256,
    holdoutRowKeyHashes: parsed.holdoutRowKeyHashes as string[],
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function readHumanTruthFields(record: unknown): HumanTruthFieldsV0 {
  if (!isRecord(record)) throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
  if (
    typeof record.annotationStatus !== "string" ||
    !ANNOTATION_STATUSES.has(record.annotationStatus as AnnotationStatusV0)
  ) {
    throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
  }
  if (!isNullableString(record.screenRowIdentifierRaw)) {
    throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
  }
  if (!isNullableString(record.screenDateRaw)) {
    throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
  }
  if (!isNullableString(record.screenTimeRaw)) {
    throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
  }
  if (!isNullableString(record.leagueDisplayRaw)) {
    throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
  }
  if (!isNullableString(record.participantLeftRaw)) {
    throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
  }
  if (!isNullableString(record.participantRightRaw)) {
    throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
  }
  if (!isNullableString(record.marketMarkerRaw)) {
    throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
  }
  if (!isStringArray(record.numericCellsRaw)) {
    throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
  }
  if (!isNullableString(record.statusTextRaw)) {
    throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
  }
  if (!isStringArray(record.otherVisibleTextRaw)) {
    throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
  }
  if (!isNullableString(record.annotatorNotes)) {
    throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
  }
  return {
    annotationStatus: record.annotationStatus as AnnotationStatusV0,
    screenRowIdentifierRaw: record.screenRowIdentifierRaw,
    screenDateRaw: record.screenDateRaw,
    screenTimeRaw: record.screenTimeRaw,
    leagueDisplayRaw: record.leagueDisplayRaw,
    participantLeftRaw: record.participantLeftRaw,
    participantRightRaw: record.participantRightRaw,
    marketMarkerRaw: record.marketMarkerRaw,
    numericCellsRaw: [...record.numericCellsRaw],
    statusTextRaw: record.statusTextRaw,
    otherVisibleTextRaw: [...record.otherVisibleTextRaw],
    annotatorNotes: record.annotatorNotes,
  };
}

export function applyHumanTruthFields(
  record: DiscoveryAnnotationRecordV0,
  truth: HumanTruthFieldsV0,
): DiscoveryAnnotationRecordV0 {
  return {
    ...record,
    annotationStatus: truth.annotationStatus,
    screenRowIdentifierRaw: truth.screenRowIdentifierRaw,
    screenDateRaw: truth.screenDateRaw,
    screenTimeRaw: truth.screenTimeRaw,
    leagueDisplayRaw: truth.leagueDisplayRaw,
    participantLeftRaw: truth.participantLeftRaw,
    participantRightRaw: truth.participantRightRaw,
    marketMarkerRaw: truth.marketMarkerRaw,
    numericCellsRaw: [...truth.numericCellsRaw],
    statusTextRaw: truth.statusTextRaw,
    otherVisibleTextRaw: [...truth.otherVisibleTextRaw],
    annotatorNotes: truth.annotatorNotes,
  };
}

function assertGeometry(value: unknown): DiscoveryAnnotationRecordV0["targetRowGeometry"] {
  if (!isRecord(value)) throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
  const { topY, bottomY, centerY, imageWidth, imageHeight } = value;
  if (
    typeof topY !== "number" ||
    typeof bottomY !== "number" ||
    typeof centerY !== "number" ||
    typeof imageWidth !== "number" ||
    typeof imageHeight !== "number"
  ) {
    throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
  }
  return { topY, bottomY, centerY, imageWidth, imageHeight };
}

export function parseDiscoveryAnnotationDocumentV0(
  raw: string,
  protoRoundKey: string,
): DiscoveryAnnotationDocumentV0 {
  const parsed = parseJsonObject(raw, "INVALID_DISCOVERY_ANNOTATION");
  if (parsed.schemaVersion !== DISCOVERY_ANNOTATION_SCHEMA_VERSION) {
    throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
  }
  if (parsed.protoRoundKey !== protoRoundKey) {
    throw new GroundTruthError("DISCOVERY_ANNOTATION_PROTO_ROUND_KEY_MISMATCH");
  }
  if (!Array.isArray(parsed.records)) {
    throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
  }
  const records: DiscoveryAnnotationRecordV0[] = parsed.records.map((item) => {
    if (!isRecord(item)) throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
    const identity = assertFrozenRowKey(item, "INVALID_DISCOVERY_ANNOTATION");
    if (typeof item.sourceFileName !== "string") {
      throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
    }
    if (typeof item.screenshotRelativePath !== "string") {
      throw new GroundTruthError("INVALID_DISCOVERY_ANNOTATION");
    }
    return {
      sourceImageSha256: identity.sourceImageSha256,
      sourceFileName: item.sourceFileName,
      visualRowIndex: identity.visualRowIndex,
      targetRowGeometry: assertGeometry(item.targetRowGeometry),
      screenshotRelativePath: item.screenshotRelativePath,
      ...readHumanTruthFields(item),
    };
  });
  return {
    ...(parsed as unknown as DiscoveryAnnotationDocumentV0),
    schemaVersion: DISCOVERY_ANNOTATION_SCHEMA_VERSION,
    protoRoundKey,
    records,
  };
}

export function selectionManifestEquals(
  a: SelectionManifestV0,
  b: SelectionManifestV0,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.protoRoundKey === b.protoRoundKey &&
    a.selectionAlgorithm === b.selectionAlgorithm &&
    a.selectionSalt === b.selectionSalt &&
    a.eligibleRowCount === b.eligibleRowCount &&
    a.discoverySampleSize === b.discoverySampleSize &&
    a.holdoutSampleSize === b.holdoutSampleSize &&
    JSON.stringify(a.discoveryRowKeys) === JSON.stringify(b.discoveryRowKeys) &&
    JSON.stringify(a.holdoutRowKeys) === JSON.stringify(b.holdoutRowKeys)
  );
}

export function holdoutSealEquals(a: HoldoutSealV0, b: HoldoutSealV0): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.protoRoundKey === b.protoRoundKey &&
    a.holdoutSampleSize === b.holdoutSampleSize &&
    a.selectionManifestSha256 === b.selectionManifestSha256 &&
    JSON.stringify(a.holdoutRowKeyHashes) === JSON.stringify(b.holdoutRowKeyHashes)
  );
}

export function assertDiscoveryAnnotationIdentities(input: {
  records: Array<Pick<DiscoveryAnnotationRecordV0, "sourceImageSha256" | "visualRowIndex">>;
  discoveryRowKeys: FrozenRowKeyV0[];
  holdoutRowKeys: FrozenRowKeyV0[];
}): void {
  const discoveryIds = input.discoveryRowKeys.map(rowIdentityKey);
  const holdoutIds = new Set(input.holdoutRowKeys.map(rowIdentityKey));
  const seen = new Set<string>();

  if (input.records.length !== discoveryIds.length) {
    throw new GroundTruthError("DISCOVERY_ANNOTATION_IDENTITY_DRIFT");
  }

  for (let i = 0; i < input.records.length; i++) {
    const rec = input.records[i]!;
    const id = rowIdentityKey(rec);
    if (seen.has(id)) {
      throw new GroundTruthError("DISCOVERY_ANNOTATION_DUPLICATE_ROW");
    }
    seen.add(id);
    if (holdoutIds.has(id)) {
      throw new GroundTruthError("DISCOVERY_ANNOTATION_HOLDOUT_LEAK");
    }
    if (id !== discoveryIds[i]) {
      throw new GroundTruthError("DISCOVERY_ANNOTATION_IDENTITY_DRIFT");
    }
  }
}

export function preserveOrCreateArtifact<T>(input: {
  existingRaw: string | null | undefined;
  expected: T;
  parse: (raw: string) => T;
  equals: (existing: T, expected: T) => boolean;
  driftCode: string;
}): PreservedArtifactV0<T> {
  if (input.existingRaw == null || input.existingRaw === "") {
    const raw = canonicalJson(input.expected);
    return {
      value: input.expected,
      raw,
      sha256: sha256Utf8(raw),
      write: true,
      action: "CREATED",
    };
  }
  const existing = input.parse(input.existingRaw);
  if (!input.equals(existing, input.expected)) {
    throw new GroundTruthError(input.driftCode);
  }
  return {
    value: existing,
    raw: input.existingRaw,
    sha256: sha256Utf8(input.existingRaw),
    write: false,
    action: "PRESERVED",
  };
}

export function preserveOrCreateDiscoveryAnnotation(input: {
  existingRaw: string | null | undefined;
  protoRoundKey: string;
  expectedBlank: DiscoveryAnnotationDocumentV0;
  discoveryRowKeys: FrozenRowKeyV0[];
  holdoutRowKeys: FrozenRowKeyV0[];
}): PreservedArtifactV0<DiscoveryAnnotationDocumentV0> {
  if (input.existingRaw == null || input.existingRaw === "") {
    const raw = canonicalJson(input.expectedBlank);
    return {
      value: input.expectedBlank,
      raw,
      sha256: sha256Utf8(raw),
      write: true,
      action: "CREATED",
    };
  }
  const existing = parseDiscoveryAnnotationDocumentV0(
    input.existingRaw,
    input.protoRoundKey,
  );
  assertDiscoveryAnnotationIdentities({
    records: existing.records,
    discoveryRowKeys: input.discoveryRowKeys,
    holdoutRowKeys: input.holdoutRowKeys,
  });
  return {
    value: existing,
    raw: input.existingRaw,
    sha256: sha256Utf8(input.existingRaw),
    write: false,
    action: "PRESERVED",
  };
}
