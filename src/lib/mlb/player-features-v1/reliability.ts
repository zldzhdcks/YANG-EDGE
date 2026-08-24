/**
 * Sample-size labels for research display only.
 * These are NOT sports-performance weights and MUST NOT feed
 * Prediction, Player Strength, or Engine admission.
 */
import type { SampleReliability } from "./types";

export const BATTER_PA_RELIABILITY_THRESHOLDS = {
  insufficientBelow: 20,
  lowBelow: 50,
  moderateBelow: 150,
} as const;

export const PITCHER_IP_RELIABILITY_THRESHOLDS = {
  insufficientBelow: 10,
  lowBelow: 30,
  moderateBelow: 80,
} as const;

export function batterPaReliability(pa: number | null): SampleReliability {
  if (pa == null || pa < BATTER_PA_RELIABILITY_THRESHOLDS.insufficientBelow) {
    return "INSUFFICIENT";
  }
  if (pa < BATTER_PA_RELIABILITY_THRESHOLDS.lowBelow) return "LOW";
  if (pa < BATTER_PA_RELIABILITY_THRESHOLDS.moderateBelow) return "MODERATE";
  return "HIGH";
}

export function pitcherIpReliability(ip: number | null): SampleReliability {
  if (ip == null || ip < PITCHER_IP_RELIABILITY_THRESHOLDS.insufficientBelow) {
    return "INSUFFICIENT";
  }
  if (ip < PITCHER_IP_RELIABILITY_THRESHOLDS.lowBelow) return "LOW";
  if (ip < PITCHER_IP_RELIABILITY_THRESHOLDS.moderateBelow) return "MODERATE";
  return "HIGH";
}
