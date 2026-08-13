import type { FootballScheduleStatus } from "./types";

/**
 * API-Football fixture.status.short → research-safe lifecycle.
 * Unknown codes stay UNKNOWN. Do not invent FINISHED.
 */
export function normalizeFootballScheduleStatus(
  shortRaw: string | null | undefined,
): FootballScheduleStatus {
  const short = (shortRaw ?? "").trim().toUpperCase();
  if (!short) return "UNKNOWN";
  switch (short) {
    case "NS":
    case "TBD":
      return "SCHEDULED";
    case "1H":
    case "HT":
    case "2H":
    case "ET":
    case "BT":
    case "P":
    case "LIVE":
      return "LIVE";
    case "FT":
    case "AET":
    case "PEN":
      return "FINISHED";
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
