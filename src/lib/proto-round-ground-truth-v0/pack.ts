import type { IntakeManifestV1 } from "../proto-round-screenshot-intake-v1/types";
import type { SemanticRegionCandidatesDocumentV0 } from "../proto-round-semantic-region-candidates-v0/types";
import type { VisualRowsDocumentV0 } from "../proto-round-visual-rows-v0/types";
import { auditDiscoveryCoverage } from "./coverage";
import {
  buildDiscoveryAnnotationDocumentV0,
  buildHoldoutSealV0,
  buildSelectionManifestV0,
} from "./documents";
import { renderDiscoveryAnnotationHtml } from "./html";
import { sha256CanonicalJson } from "./hash";
import { collectEligibleRows } from "./lineage";
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
};

export async function buildGroundTruthPackV0(input: {
  protoRoundKey: string;
  visualRows: VisualRowsDocumentV0;
  intake: IntakeManifestV1;
  screenshot: ScreenshotBytesProbe;
  semanticRegions?: SemanticRegionCandidatesDocumentV0 | null;
}): Promise<GroundTruthPackV0> {
  const eligibleRows = await collectEligibleRows({
    protoRoundKey: input.protoRoundKey,
    visualRows: input.visualRows,
    intake: input.intake,
    screenshot: input.screenshot,
  });
  const selection = selectFrozenSamples({
    protoRoundKey: input.protoRoundKey,
    eligibleRows,
  });
  assertDiscoveryHoldoutDisjoint(selection);

  const selectionManifest = buildSelectionManifestV0({
    protoRoundKey: input.protoRoundKey,
    selection,
  });
  const selectionManifestSha256 = sha256CanonicalJson(selectionManifest);
  const holdoutSeal = buildHoldoutSealV0({
    protoRoundKey: input.protoRoundKey,
    holdoutRowKeys: selection.holdout,
    selectionManifestSha256,
  });
  const holdoutSealSha256 = sha256CanonicalJson(holdoutSeal);
  const discoveryAnnotation = buildDiscoveryAnnotationDocumentV0({
    protoRoundKey: input.protoRoundKey,
    discoveryRowKeys: selection.discovery,
    eligibleRows,
  });
  const coverage = auditDiscoveryCoverage({
    discoveryRowKeys: selection.discovery,
    semanticRegions: input.semanticRegions ?? null,
  });

  return {
    eligibleRowCount: eligibleRows.length,
    selectionManifest,
    selectionManifestSha256,
    holdoutSeal,
    holdoutSealSha256,
    discoveryAnnotation,
    discoveryHtml: renderDiscoveryAnnotationHtml(discoveryAnnotation),
    coverage,
  };
}
