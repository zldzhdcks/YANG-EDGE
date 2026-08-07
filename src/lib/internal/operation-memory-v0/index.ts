export * from "./types";
export * from "./decision-registry";
export * from "./load-operation-memory";
export * from "./build-operation-memory-view";
export * from "./feature-usefulness-audit";

import { loadOperationMemorySources } from "./load-operation-memory";
import { buildOperationMemoryV0 } from "./build-operation-memory-view";
import type { YangEdgeOsPresentation } from "../yang-edge-os-presenter";
import type { OperationMemoryV0 } from "./types";
import { buildFeatureUsefulnessAudit } from "./feature-usefulness-audit";

export async function loadOperationMemoryV0(input: {
  dateKst: string;
  os: YangEdgeOsPresentation;
  cwd?: string;
}): Promise<OperationMemoryV0> {
  const sources = await loadOperationMemorySources({
    dateKst: input.dateKst,
    cwd: input.cwd,
  });
  return buildOperationMemoryV0({
    dateKst: input.dateKst,
    sources,
    os: input.os,
  });
}

export function getFeatureUsefulnessAudit() {
  return buildFeatureUsefulnessAudit();
}
