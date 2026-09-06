import {
  AUTO_GROUND_TRUTH_COMPLETION,
  DISCOVERY_ANNOTATION_SCHEMA_VERSION,
  DISCOVERY_SAMPLE_SIZE,
  GROUND_TRUTH_ACCURACY_METRIC,
  GROUND_TRUTH_DISCOVERY_ANNOTATED,
  GROUND_TRUTH_DISCOVERY_TEMPLATE,
  GROUND_TRUTH_FROM_OCR,
  GROUND_TRUTH_HOME_AWAY_ASSIGNED,
  GROUND_TRUTH_LEAGUE_NORMALIZATION,
  GROUND_TRUTH_MARKET_NORMALIZATION,
  GROUND_TRUTH_SOURCE,
  GROUND_TRUTH_TEAM_NORMALIZATION,
  HOLDOUT_SAMPLE_SIZE,
  HOLDOUT_SEAL_SCHEMA_VERSION,
  OCR_VISIBLE_DURING_TRUTH_ENTRY,
  ANNOTATION_ANCHORED_BY_MODEL_OUTPUT,
  SELECTION_ALGORITHM,
  SELECTION_SALT,
  SELECTION_SCHEMA_VERSION,
  type DiscoveryAnnotationDocumentV0,
  type DiscoveryAnnotationRecordV0,
  type EligibleVisualRowV0,
  type FrozenRowKeyV0,
  type HoldoutSealV0,
  type SelectionManifestV0,
} from "./types";
import { hashRowIdentity } from "./hash";
import { GroundTruthError } from "./error";
import type { FrozenSelectionV0 } from "./select";

export function blankHumanTruthFields(): Pick<
  DiscoveryAnnotationRecordV0,
  | "annotationStatus"
  | "screenRowIdentifierRaw"
  | "screenDateRaw"
  | "screenTimeRaw"
  | "leagueDisplayRaw"
  | "participantLeftRaw"
  | "participantRightRaw"
  | "marketMarkerRaw"
  | "numericCellsRaw"
  | "statusTextRaw"
  | "otherVisibleTextRaw"
  | "annotatorNotes"
> {
  return {
    annotationStatus: "UNANNOTATED",
    screenRowIdentifierRaw: null,
    screenDateRaw: null,
    screenTimeRaw: null,
    leagueDisplayRaw: null,
    participantLeftRaw: null,
    participantRightRaw: null,
    marketMarkerRaw: null,
    numericCellsRaw: [],
    statusTextRaw: null,
    otherVisibleTextRaw: [],
    annotatorNotes: null,
  };
}

export function buildSelectionManifestV0(input: {
  protoRoundKey: string;
  selection: FrozenSelectionV0;
}): SelectionManifestV0 {
  return {
    schemaVersion: SELECTION_SCHEMA_VERSION,
    protoRoundKey: input.protoRoundKey,
    selectionAlgorithm: SELECTION_ALGORITHM,
    selectionSalt: SELECTION_SALT,
    eligibleRowCount: input.selection.eligibleRowCount,
    discoverySampleSize: DISCOVERY_SAMPLE_SIZE,
    holdoutSampleSize: HOLDOUT_SAMPLE_SIZE,
    discoveryRowKeys: input.selection.discovery.map((k) => ({
      sourceImageSha256: k.sourceImageSha256,
      visualRowIndex: k.visualRowIndex,
    })),
    holdoutRowKeys: input.selection.holdout.map((k) => ({
      sourceImageSha256: k.sourceImageSha256,
      visualRowIndex: k.visualRowIndex,
    })),
  };
}

export function buildHoldoutSealV0(input: {
  protoRoundKey: string;
  holdoutRowKeys: FrozenRowKeyV0[];
  selectionManifestSha256: string;
}): HoldoutSealV0 {
  return {
    schemaVersion: HOLDOUT_SEAL_SCHEMA_VERSION,
    protoRoundKey: input.protoRoundKey,
    holdoutSampleSize: HOLDOUT_SAMPLE_SIZE,
    selectionManifestSha256: input.selectionManifestSha256,
    holdoutRowKeyHashes: input.holdoutRowKeys.map(hashRowIdentity),
  };
}

function indexEligible(
  rows: EligibleVisualRowV0[],
): Map<string, EligibleVisualRowV0> {
  const map = new Map<string, EligibleVisualRowV0>();
  for (const row of rows) {
    map.set(`${row.sourceImageSha256}|${row.visualRowIndex}`, row);
  }
  return map;
}

export function buildDiscoveryAnnotationDocumentV0(input: {
  protoRoundKey: string;
  discoveryRowKeys: FrozenRowKeyV0[];
  eligibleRows: EligibleVisualRowV0[];
}): DiscoveryAnnotationDocumentV0 {
  const byKey = indexEligible(input.eligibleRows);
  const records: DiscoveryAnnotationRecordV0[] = input.discoveryRowKeys.map((key) => {
    const row = byKey.get(`${key.sourceImageSha256}|${key.visualRowIndex}`);
    if (!row) {
      throw new GroundTruthError("DISCOVERY_ROW_NOT_ELIGIBLE");
    }
    return {
      sourceImageSha256: row.sourceImageSha256,
      sourceFileName: row.sourceFileName,
      visualRowIndex: row.visualRowIndex,
      targetRowGeometry: {
        topY: row.topY,
        bottomY: row.bottomY,
        centerY: row.centerY,
        imageWidth: row.imageWidth,
        imageHeight: row.imageHeight,
      },
      screenshotRelativePath: row.screenshotRelativePath,
      ...blankHumanTruthFields(),
    };
  });

  return {
    schemaVersion: DISCOVERY_ANNOTATION_SCHEMA_VERSION,
    protoRoundKey: input.protoRoundKey,
    groundTruthSource: GROUND_TRUTH_SOURCE,
    groundTruthFromOcr: GROUND_TRUTH_FROM_OCR,
    autoGroundTruthCompletion: AUTO_GROUND_TRUTH_COMPLETION,
    homeAwayAssigned: GROUND_TRUTH_HOME_AWAY_ASSIGNED,
    marketNormalization: GROUND_TRUTH_MARKET_NORMALIZATION,
    teamNormalization: GROUND_TRUTH_TEAM_NORMALIZATION,
    leagueNormalization: GROUND_TRUTH_LEAGUE_NORMALIZATION,
    ocrVisibleDuringTruthEntry: OCR_VISIBLE_DURING_TRUTH_ENTRY,
    annotationAnchoredByModelOutput: ANNOTATION_ANCHORED_BY_MODEL_OUTPUT,
    discoveryTemplate: GROUND_TRUTH_DISCOVERY_TEMPLATE,
    discoveryAnnotated: GROUND_TRUTH_DISCOVERY_ANNOTATED,
    accuracyMetric: GROUND_TRUTH_ACCURACY_METRIC,
    records,
  };
}
