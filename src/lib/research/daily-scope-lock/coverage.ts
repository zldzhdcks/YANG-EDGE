import type {
  DecisionCoverageResult,
  ResearchTargetScopeLockDocument,
  ScopeResolutionState,
} from "./types";
import { isResearchTargetScopeLockDocument } from "./paths";

const AUTHORITATIVE: ReadonlySet<ScopeResolutionState> = new Set([
  "LOCKED",
  "IDEMPOTENT_EXISTING",
  "TARGET_SCOPE_NO_ADMISSIBLE_TARGETS",
]);

/**
 * Fail-closed decision coverage check at the scope-lock boundary.
 * Detection only — does not create PASS/PREDICTION.
 *
 * Requires explicit scopeResolution. Null scopeLock alone is never
 * collapsed into TARGET_SCOPE_SOURCE_MISSING.
 */
export function verifyDecisionCoverage(input: {
  scopeLock: ResearchTargetScopeLockDocument | null;
  sealedDecisionTargetIds: Iterable<string>;
  scopeResolution: ScopeResolutionState | null;
}): DecisionCoverageResult {
  const sealedCount = [...input.sealedDecisionTargetIds].length;
  const resolution = input.scopeResolution;

  if (resolution == null) {
    return {
      status: "COVERAGE_NOT_EVALUABLE",
      reason: "SCOPE_RESOLUTION_UNKNOWN",
      lockedTargetCount: null,
      sealedDecisionCount: sealedCount,
      missingTargetIds: [],
      unexpectedDecisionIds: [],
      targetCountAuthoritative: false,
    };
  }

  if (resolution === "TARGET_SCOPE_SOURCE_MISSING") {
    return {
      status: "TARGET_SCOPE_SOURCE_MISSING",
      reason: "TARGET_SCOPE_SOURCE_MISSING",
      lockedTargetCount: null,
      sealedDecisionCount: sealedCount,
      missingTargetIds: [],
      unexpectedDecisionIds: [],
      targetCountAuthoritative: false,
    };
  }

  if (
    resolution === "TARGET_SCOPE_SOURCE_INVALID" ||
    resolution === "TARGET_SCOPE_CONFLICT" ||
    resolution === "SCOPE_LOCK_CONFLICT"
  ) {
    return {
      status: "COVERAGE_NOT_EVALUABLE",
      reason: resolution,
      lockedTargetCount: null,
      sealedDecisionCount: sealedCount,
      missingTargetIds: [],
      unexpectedDecisionIds: [],
      targetCountAuthoritative: false,
    };
  }

  if (!AUTHORITATIVE.has(resolution)) {
    return {
      status: "COVERAGE_NOT_EVALUABLE",
      reason: "SCOPE_RESOLUTION_UNKNOWN",
      lockedTargetCount: null,
      sealedDecisionCount: sealedCount,
      missingTargetIds: [],
      unexpectedDecisionIds: [],
      targetCountAuthoritative: false,
    };
  }

  if (
    input.scopeLock == null ||
    !isResearchTargetScopeLockDocument(input.scopeLock)
  ) {
    return {
      status: "COVERAGE_NOT_EVALUABLE",
      reason: "SCOPE_RESOLUTION_UNKNOWN",
      lockedTargetCount: null,
      sealedDecisionCount: sealedCount,
      missingTargetIds: [],
      unexpectedDecisionIds: [],
      targetCountAuthoritative: false,
    };
  }

  const lockedIds = input.scopeLock.targets.map((t) => t.targetId);
  const lockedSet = new Set(lockedIds);
  const sealed = [...new Set(input.sealedDecisionTargetIds)];
  const sealedSet = new Set(sealed);

  const missingTargetIds = lockedIds
    .filter((id) => !sealedSet.has(id))
    .sort((a, b) => a.localeCompare(b));
  const unexpectedDecisionIds = sealed
    .filter((id) => !lockedSet.has(id))
    .sort((a, b) => a.localeCompare(b));

  return {
    status:
      missingTargetIds.length === 0
        ? "COVERAGE_COMPLETE"
        : "COVERAGE_INCOMPLETE",
    reason: "AUTHORITATIVE_SCOPE",
    lockedTargetCount: lockedIds.length,
    sealedDecisionCount: sealed.length,
    missingTargetIds,
    unexpectedDecisionIds,
    targetCountAuthoritative: true,
  };
}
