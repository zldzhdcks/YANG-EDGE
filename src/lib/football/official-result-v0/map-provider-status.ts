/**
 * API-Football fixture.status.short → Result Foundation status.
 * Mapping is taken from core/status.ts plus Result Foundation FINAL split.
 * Unknown codes stay UNKNOWN. Do not invent FINAL.
 */
import type { FootballResultStatus } from "../result-foundation-v0/types";
import { isFinalStatus } from "../result-foundation-v0/derive-one-x-two-outcome";

export function mapApiFootballShortStatusToResultStatus(
  shortRaw: string | null | undefined,
): FootballResultStatus {
  const short = (shortRaw ?? "").trim().toUpperCase();
  if (!short) return "UNKNOWN";
  switch (short) {
    case "NS":
    case "TBD":
      return "SCHEDULED";
    case "HT":
      return "HALFTIME";
    case "1H":
    case "2H":
    case "ET":
    case "BT":
    case "P":
    case "LIVE":
      return "LIVE";
    case "FT":
      return "FINAL";
    case "AET":
      return "FINAL_AFTER_EXTRA_TIME";
    case "PEN":
      return "FINAL_AFTER_PENALTIES";
    case "PST":
      return "POSTPONED";
    case "CANC":
      return "CANCELLED";
    case "ABD":
      return "ABANDONED";
    case "SUSP":
    case "INT":
      return "SUSPENDED";
    default:
      return "UNKNOWN";
  }
}

export function isApiFootballTerminalFinalShort(
  shortRaw: string | null | undefined,
): boolean {
  return isFinalStatus(mapApiFootballShortStatusToResultStatus(shortRaw));
}

export function isWaitingFinalStatus(status: FootballResultStatus): boolean {
  return (
    status === "SCHEDULED" ||
    status === "LIVE" ||
    status === "HALFTIME" ||
    status === "UNKNOWN"
  );
}

export function isNonFinalTerminalStatus(status: FootballResultStatus): boolean {
  return (
    status === "POSTPONED" ||
    status === "CANCELLED" ||
    status === "ABANDONED" ||
    status === "SUSPENDED" ||
    status === "VOID"
  );
}
