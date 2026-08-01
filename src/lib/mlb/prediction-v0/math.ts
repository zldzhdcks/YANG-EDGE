/**
 * Deterministic helpers for MLB prediction v0.
 */
import { createHash } from "node:crypto";
import { stableStringify, sha256 } from "@/lib/mlb/mlb-review-hash";
import {
  MLB_PREDICTION_V0_CALIBRATION,
  MLB_PREDICTION_V0_MODEL_VERSION,
  MLB_PREDICTION_V0_WEIGHTS,
} from "./config";

export { stableStringify, sha256 };

export function configHash(): string {
  return sha256({
    modelVersion: MLB_PREDICTION_V0_MODEL_VERSION,
    weights: MLB_PREDICTION_V0_WEIGHTS,
    calibration: MLB_PREDICTION_V0_CALIBRATION,
  });
}

export function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function sigmoid(x: number): number {
  if (x >= 20) return 1;
  if (x <= -20) return 0;
  return 1 / (1 + Math.exp(-x));
}

export function logit(p: number): number {
  const eps = 1e-9;
  const x = clamp(p, eps, 1 - eps);
  return Math.log(x / (1 - x));
}

export function fileContentHash(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}
