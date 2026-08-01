/**
 * Quota gate for Scheduler — does not call providers.
 * remaining < 20 warn; < 10 block provider; unknown → prefer cache/artifact.
 */

import {
  QUOTA_BLOCK_REMAINING,
  QUOTA_WARN_REMAINING,
} from "./windows";
import type { QuotaDecision } from "./types";

export function evaluateQuotaGate(remaining: number | null | undefined): QuotaDecision {
  if (remaining == null || Number.isNaN(remaining)) {
    return {
      allowProvider: true,
      warn: true,
      remaining: null,
    };
  }
  if (remaining < QUOTA_BLOCK_REMAINING) {
    return {
      allowProvider: false,
      warn: true,
      remaining,
      reason: "QUOTA_BLOCKED",
    };
  }
  if (remaining < QUOTA_WARN_REMAINING) {
    return {
      allowProvider: true,
      warn: true,
      remaining,
    };
  }
  return {
    allowProvider: true,
    warn: false,
    remaining,
  };
}
