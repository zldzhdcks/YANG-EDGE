import type {
  DecisionCoverageResult,
  DecisionCoverageStatus,
  ResearchTargetScopeLockDocument,
} from "./types";

/**
 * Fail-closed decision coverage check at the scope-lock boundary.
 * Detection only — does not create PASS/PREDICTION.
 */
export function verifyDecisionCoverage(input: {
  scopeLock: ResearchTargetScopeLockDocument | null;
  sealedDecisionTargetIds: Iterable<string>;
  sourceMissing?: boolean;
}): DecisionCoverageResult {
  if (input.sourceMissing || input.scopeLock == null) {
    return {
      status: "TARGET_SCOPE_SOURCE_MISSING",
      lockedTargetCount: null,
      sealedDecisionCount: [...input.sealedDecisionTargetIds].length,
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

  const status: DecisionCoverageStatus =
    missingTargetIds.length === 0
      ? "COVERAGE_COMPLETE"
      : "COVERAGE_INCOMPLETE";

  return {
    status,
    lockedTargetCount: lockedIds.length,
    sealedDecisionCount: sealed.length,
    missingTargetIds,
    unexpectedDecisionIds,
    targetCountAuthoritative: true,
  };
}
