/**
 * API-BASEBALL status mapping reused from KBO schedule provider semantics.
 * Unknown codes stay UNKNOWN. Do not invent FINAL.
 */
import type { KboGameStatus } from "../../kbo/schedule-result-identity-types";
import type { DailyStageEResultState } from "./types";

export function mapApiBaseballStatusToKboGameStatus(
  rawStatus: string | null,
): KboGameStatus {
  const raw = (rawStatus ?? "").trim().toUpperCase();
  if (raw === "NS" || raw === "TBD" || raw === "SCHEDULED") return "SCHEDULED";
  if (
    raw === "LIVE" ||
    raw === "IN_PLAY" ||
    raw === "INT" ||
    /^IN\d+$/i.test(raw) ||
    /^\d+$/.test(raw)
  ) {
    return "LIVE";
  }
  if (raw === "FT" || raw === "AOT" || raw === "FINAL") return "FINAL";
  if (raw === "POSTP" || raw === "POSTPONED") return "POSTPONED";
  if (raw === "CANC" || raw === "CANCELLED") return "CANCELLED";
  if (raw === "SUSP" || raw === "SUSPENDED") return "SUSPENDED";
  return "UNKNOWN";
}

export function baseballGameStatusToResultState(
  status: KboGameStatus,
  rawStatus?: string | null,
): DailyStageEResultState {
  const raw = (rawStatus ?? "").trim().toUpperCase();
  if (raw === "ABD" || raw === "ABANDONED") return "ABANDONED";
  switch (status) {
    case "FINAL":
    case "DRAW":
      return "FINAL";
    case "LIVE":
      return "LIVE";
    case "SCHEDULED":
      return "SCHEDULED";
    case "POSTPONED":
      return "POSTPONED";
    case "CANCELLED":
      return "CANCELLED";
    case "SUSPENDED":
      return "SUSPENDED";
    case "NO_GAME":
      return "CANCELLED";
    default:
      return "NOT_RESOLVED";
  }
}

export function isBaseballTerminalFinal(status: KboGameStatus): boolean {
  return status === "FINAL" || status === "DRAW";
}
