import { createHash } from "node:crypto";

export function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

export function normTeam(name: string): string {
  return name.trim().toLowerCase();
}

export function resolvePickSide(
  pick: string | null,
  homeTeam: string,
  awayTeam: string,
): "HOME" | "AWAY" | null {
  if (!pick) return null;
  const p = normTeam(pick);
  if (p === normTeam(homeTeam)) return "HOME";
  if (p === normTeam(awayTeam)) return "AWAY";
  return null;
}

export function isNoPickStatus(baselineStatus: string | null): boolean {
  if (!baselineStatus) return false;
  const s = baselineStatus.toUpperCase();
  return s === "PASS" || s === "NO_PICK";
}

export function computeAccuracy(
  correct: number,
  incorrect: number,
): {
  numerator: number;
  denominator: number;
  percent: number | null;
  status: "OK" | "NO_GRADED_SAMPLE";
} {
  const denominator = correct + incorrect;
  if (denominator === 0) {
    return {
      numerator: 0,
      denominator: 0,
      percent: null,
      status: "NO_GRADED_SAMPLE",
    };
  }
  return {
    numerator: correct,
    denominator,
    percent: Math.round((correct / denominator) * 1000) / 10,
    status: "OK",
  };
}

export function computePredictionContentHash(
  prediction: Record<string, unknown>,
): string {
  const meta = asRecord(prediction.meta);
  const keys = Array.isArray(meta?.immutablePredictionFields)
    ? (meta!.immutablePredictionFields as string[])
    : [];
  const predictions = Array.isArray(prediction.predictions)
    ? prediction.predictions
    : [];
  const fingerprintList = predictions.map((raw) => {
    const row = asRecord(raw) ?? {};
    const payload: Record<string, unknown> = {};
    for (const key of keys) {
      payload[key] = row[key];
    }
    return JSON.stringify(payload);
  });
  return createHash("sha256")
    .update(JSON.stringify(fingerprintList), "utf8")
    .digest("hex");
}
