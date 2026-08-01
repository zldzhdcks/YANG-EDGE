/**
 * Idempotency checks for Scheduler stages.
 */

import { createHash } from "node:crypto";
import type {
  GameSchedulerState,
  PregameSchedulerStage,
  SchedulerExecutionStatus,
} from "./types";

export function computeInputHash(parts: Record<string, unknown>): string {
  const canonical = JSON.stringify(parts, Object.keys(parts).sort());
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

export function findSuccessfulStage(
  gameState: GameSchedulerState | undefined,
  stage: PregameSchedulerStage,
  inputHash: string,
): boolean {
  if (!gameState) return false;
  return gameState.stages.some(
    (s) =>
      s.stage === stage &&
      (s.status === "SUCCESS" || s.status === "PASS") &&
      s.inputHash === inputHash,
  );
}

export function isStageCompletedAnyHash(
  gameState: GameSchedulerState | undefined,
  stage: PregameSchedulerStage,
): boolean {
  if (!gameState) return false;
  return gameState.stages.some(
    (s) =>
      s.stage === stage && (s.status === "SUCCESS" || s.status === "PASS"),
  );
}

/** Locked prediction: do not allow pregame revision. */
export function revisionAllowed(input: {
  lockedPrediction: boolean;
  previousInputHash: string | null | undefined;
  nextInputHash: string;
}): { allowed: boolean; reason: string } {
  if (input.lockedPrediction) {
    return { allowed: false, reason: "LOCKED_PREDICTION" };
  }
  if (
    input.previousInputHash &&
    input.previousInputHash === input.nextInputHash
  ) {
    return { allowed: false, reason: "SAME_INPUT_HASH" };
  }
  return { allowed: true, reason: "NEW_INPUT" };
}

export function mapSkipStatus(
  code: "SKIPPED_DUPLICATE_RUN" | "SKIPPED_ALREADY_COMPLETED",
): SchedulerExecutionStatus {
  return "SKIPPED";
}
