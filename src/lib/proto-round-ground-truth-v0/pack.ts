import type { IntakeManifestV1 } from "../proto-round-screenshot-intake-v1/types";
import type { SemanticRegionCandidatesDocumentV0 } from "../proto-round-semantic-region-candidates-v0/types";
import type { VisualRowsDocumentV0 } from "../proto-round-visual-rows-v0/types";
import { auditDiscoveryCoverage } from "./coverage";
import {
  buildDiscoveryAnnotationDocumentV0,
  buildHoldoutSealV0,
  buildSelectionManifestV0,
} from "./documents";
import { GroundTruthError } from "./error";
import { renderDiscoveryAnnotationHtml } from "./html";
import { sha256CanonicalJson, sha256Utf8 } from "./hash";
import { collectEligibleRows } from "./lineage";
import {
  holdoutSealEquals,
  parseHoldoutSealV0,
  parseSelectionManifestV0,
  preserveOrCreateArtifact,
  preserveOrCreateDiscoveryAnnotation,
  selectionManifestEquals,
  type ExistingGroundTruthArtifactsV0,
  type PreservedArtifactV0,
} from "./persist";
import { assertDiscoveryHoldoutDisjoint, selectFrozenSamples } from "./select";
import type {
  DiscoveryAnnotationDocumentV0,
  DiscoveryCoverageAuditV0,
  HoldoutSealV0,
  ScreenshotBytesProbe,
  SelectionManifestV0,
} from "./types";

export type GroundTruthPackV0 = {
  eligibleRowCount: number;
  selectionManifest: SelectionManifestV0;
  selectionManifestSha256: string;
  holdoutSeal: HoldoutSealV0;
  holdoutSealSha256: string;
  discoveryAnnotation: DiscoveryAnnotationDocumentV0;
  discoveryHtml: string;
  coverage: DiscoveryCoverageAuditV0;
  selectionArtifact: PreservedArtifactV0<SelectionManifestV0>;
  holdoutSealArtifact: PreservedArtifactV0<HoldoutSealV0>;
  discoveryAnnotationArtifact: PreservedArtifactV0<DiscoveryAnnotationDocumentV0>;
};

function assertCompleteOrEmptyFreeze(existing: ExistingGroundTruthArtifactsV0): void {
  const hasSelection = Boolean(existing.selectionManifestRaw);
  const hasSeal = Boolean(existing.holdoutSealRaw);
  if (hasSelection !== hasSeal) {
    throw new GroundTruthError("FROZEN_PACK_INCOMPLETE");
  }
}

export async function reconcileGroundTruthPackV0(input: {
  protoRoundKey: string;
  visualRows: VisualRowsDocumentV0;
  intake: IntakeManifestV1;
  screenshot: ScreenshotBytesProbe;
  semanticRegions?: SemanticRegionCandidatesDocumentV0 | null;
  existing?: ExistingGroundTruthArtifactsV0;
}): Promise<GroundTruthPackV0> {
  const existing = input.existing ?? {};
  assertCompleteOrEmptyFreeze(existing);

  const eligibleRows = await collectEligibleRows({
    protoRoundKey: input.protoRoundKey,
    visualRows: input.visualRows,
    intake: input.intake,
    screenshot: input.screenshot,
  });
  const recomputedSelection = selectFrozenSamples({
    protoRoundKey: input.protoRoundKey,
    eligibleRows,
  });
  assertDiscoveryHoldoutDisjoint(recomputedSelection);
  const recomputedManifest = buildSelectionManifestV0({
    protoRoundKey: input.protoRoundKey,
    selection: recomputedSelection,
  });

  const selectionArtifact = preserveOrCreateArtifact({
    existingRaw: existing.selectionManifestRaw,
    expected: recomputedManifest,
    parse: (raw) => parseSelectionManifestV0(raw, input.protoRoundKey),
    equals: selectionManifestEquals,
    driftCode: "FROZEN_SELECTION_DRIFT",
  });

  const frozenSelection = selectionArtifact.value;
  const expectedSeal = buildHoldoutSealV0({
    protoRoundKey: input.protoRoundKey,
    holdoutRowKeys: frozenSelection.holdoutRowKeys,
    selectionManifestSha256: selectionArtifact.sha256,
  });
  const holdoutSealArtifact = preserveOrCreateArtifact({
    existingRaw: existing.holdoutSealRaw,
    expected: expectedSeal,
    parse: (raw) => parseHoldoutSealV0(raw, input.protoRoundKey),
    equals: holdoutSealEquals,
    driftCode: "HOLDOUT_SEAL_DRIFT",
  });

  const expectedBlank = buildDiscoveryAnnotationDocumentV0({
    protoRoundKey: input.protoRoundKey,
    discoveryRowKeys: frozenSelection.discoveryRowKeys,
    eligibleRows,
  });
  const discoveryAnnotationArtifact = preserveOrCreateDiscoveryAnnotation({
    existingRaw: existing.discoveryAnnotationRaw,
    protoRoundKey: input.protoRoundKey,
    expectedBlank,
    discoveryRowKeys: frozenSelection.discoveryRowKeys,
    holdoutRowKeys: frozenSelection.holdoutRowKeys,
  });

  const coverage = auditDiscoveryCoverage({
    discoveryRowKeys: frozenSelection.discoveryRowKeys,
    semanticRegions: input.semanticRegions ?? null,
  });

  return {
    eligibleRowCount: eligibleRows.length,
    selectionManifest: frozenSelection,
    selectionManifestSha256: selectionArtifact.sha256,
    holdoutSeal: holdoutSealArtifact.value,
    holdoutSealSha256: holdoutSealArtifact.sha256,
    discoveryAnnotation: discoveryAnnotationArtifact.value,
    discoveryHtml: renderDiscoveryAnnotationHtml(discoveryAnnotationArtifact.value),
    coverage,
    selectionArtifact,
    holdoutSealArtifact,
    discoveryAnnotationArtifact,
  };
}

/** First-init helper. Does not read existing artifacts. */
export async function buildGroundTruthPackV0(input: {
  protoRoundKey: string;
  visualRows: VisualRowsDocumentV0;
  intake: IntakeManifestV1;
  screenshot: ScreenshotBytesProbe;
  semanticRegions?: SemanticRegionCandidatesDocumentV0 | null;
}): Promise<GroundTruthPackV0> {
  return reconcileGroundTruthPackV0(input);
}

export function sha256ExistingOrCanonical(raw: string | null | undefined, value: unknown): string {
  if (raw != null && raw !== "") return sha256Utf8(raw);
  return sha256CanonicalJson(value);
}
